import { NextResponse, type NextRequest } from 'next/server'
import { unseal, SESSION_COOKIE, type SessionData } from '@/lib/session'
import { SKILLS_API_URL } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The cross-application call.
//
// The browser never contacts the other application's domain, so there is
// no CORS and no third-party cookie involved. This server sends the user's
// access token, and the other service verifies its signature, issuer and
// audience before answering. Both sides find the user by the same `sub`.
export async function GET(request: NextRequest) {
  const session = await unseal<SessionData>(
    request.cookies.get(SESSION_COOKIE)?.value,
  )

  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const upstream = await fetch(`${SKILLS_API_URL()}/api/skills`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  })

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: 'peer_request_failed',
        status: upstream.status,
        detail: await upstream.text(),
      },
      { status: 502 },
    )
  }

  return NextResponse.json(await upstream.json())
}
