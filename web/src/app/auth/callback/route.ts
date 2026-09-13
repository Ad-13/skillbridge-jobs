import { jwtVerify } from 'jose'
import { NextResponse, type NextRequest } from 'next/server'
import {
  getOidc,
  getJwks,
  BASE_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
} from '@/lib/config'
import {
  seal,
  unseal,
  cookieOptions,
  SESSION_COOKIE,
  TRANSACTION_COOKIE,
  SESSION_TTL_SECONDS,
} from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Transaction {
  state: string
  nonce: string
  codeVerifier: string
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')

  if (error) {
    const description = params.get('error_description') ?? ''
    return new NextResponse(`Provider returned an error: ${error} — ${description}`, {
      status: 400,
    })
  }

  const transaction = await unseal<Transaction>(
    request.cookies.get(TRANSACTION_COOKIE)?.value,
  )

  if (!transaction || !code || transaction.state !== state) {
    return new NextResponse('State mismatch — the login did not start here.', {
      status: 400,
    })
  }

  const oidc = await getOidc()

  // Server-to-server exchange. The browser never holds a token, and the
  // client secret never leaves this process.
  const tokenResponse = await fetch(oidc.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI(),
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      code_verifier: transaction.codeVerifier,
    }),
  })

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text()
    return new NextResponse(`Token exchange failed: ${detail}`, { status: 502 })
  }

  const tokens = (await tokenResponse.json()) as {
    id_token: string
    access_token: string
  }

  // Verify the identity token. `audience` is our client id here, because
  // an id_token is addressed to the application, not to an API.
  let claims
  try {
    const verified = await jwtVerify(tokens.id_token, await getJwks(), {
      issuer: oidc.issuer,
      audience: CLIENT_ID(),
    })
    claims = verified.payload as Record<string, unknown>
  } catch (verifyError) {
    const message = verifyError instanceof Error ? verifyError.message : 'unknown'
    return new NextResponse(`Invalid id_token: ${message}`, { status: 401 })
  }

  // jwtVerify knows nothing about nonce — that check belongs to us.
  if (claims.nonce !== transaction.nonce) {
    return new NextResponse('Nonce mismatch.', { status: 401 })
  }

  const session = await seal(
    {
      sub: String(claims.sub),
      name: String(claims.name ?? claims.nickname ?? claims.email ?? 'Unknown user'),
      email: (claims.email as string | undefined) ?? null,
      accessToken: tokens.access_token,
    },
    `${SESSION_TTL_SECONDS}s`,
  )

  const response = NextResponse.redirect(BASE_URL())
  response.cookies.set(SESSION_COOKIE, session, {
    ...cookieOptions,
    maxAge: SESSION_TTL_SECONDS,
  })
  response.cookies.delete(TRANSACTION_COOKIE)

  return response
}
