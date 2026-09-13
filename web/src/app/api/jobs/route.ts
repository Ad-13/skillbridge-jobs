import { NextResponse, type NextRequest } from 'next/server'
import { unseal, SESSION_COOKIE, type SessionData } from '@/lib/session'
import { JOBS_API_URL } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Calls OUR OWN Express API. The browser talks only to this Next.js
// application; Next talks to Express carrying the user's access token.
// Exactly the same mechanism as the cross-application call — the only
// difference is which service is on the other end.
export async function GET(request: NextRequest) {
  const session = await unseal<SessionData>(
    request.cookies.get(SESSION_COOKIE)?.value,
  )

  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const upstream = await fetch(`${JOBS_API_URL()}/api/jobs`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  })

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: 'upstream_failed',
        status: upstream.status,
        detail: await upstream.text(),
      },
      { status: 502 },
    )
  }

  return NextResponse.json(await upstream.json())
}
