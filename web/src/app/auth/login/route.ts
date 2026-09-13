import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  getOidc,
  CLIENT_ID,
  REDIRECT_URI,
  API_AUDIENCE,
} from '@/lib/config'
import {
  seal,
  cookieOptions,
  TRANSACTION_COOKIE,
  TRANSACTION_TTL_SECONDS,
} from '@/lib/session'

// node:crypto is used below, so pin the Node runtime explicitly.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const randomString = () => crypto.randomBytes(32).toString('base64url')

const challengeFrom = (verifier: string) =>
  crypto.createHash('sha256').update(verifier).digest('base64url')

export async function GET() {
  const oidc = await getOidc()

  const state = randomString() // blocks CSRF on the callback
  const nonce = randomString() // blocks replay of an id_token
  const codeVerifier = randomString() // blocks use of an intercepted code

  // The three secrets travel in a short-lived encrypted cookie rather than
  // in server memory, so the login completes even if this request and the
  // callback land on different serverless instances.
  const transaction = await seal(
    { state, nonce, codeVerifier },
    `${TRANSACTION_TTL_SECONDS}s`,
  )

  const url = new URL(oidc.authorization_endpoint)
  url.searchParams.set('client_id', CLIENT_ID())
  url.searchParams.set('redirect_uri', REDIRECT_URI())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid profile email')
  url.searchParams.set('state', state)
  url.searchParams.set('nonce', nonce)
  url.searchParams.set('code_challenge', challengeFrom(codeVerifier))
  url.searchParams.set('code_challenge_method', 'S256')

  // Without an audience the provider returns an opaque access token that
  // no downstream service can verify on its own.
  url.searchParams.set('audience', API_AUDIENCE())

  // Build the response explicitly and attach the cookie to it. Setting a
  // cookie and redirecting in one response is the one place where relying
  // on implicit behaviour bites, so we are explicit.
  const response = NextResponse.redirect(url.toString())
  response.cookies.set(TRANSACTION_COOKIE, transaction, {
    ...cookieOptions,
    maxAge: TRANSACTION_TTL_SECONDS,
  })

  return response
}
