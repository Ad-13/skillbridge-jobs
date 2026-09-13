import { NextResponse, type NextRequest } from 'next/server'
import { unseal, SESSION_COOKIE, type SessionData } from '@/lib/session'
import { SKILLS_APP_URL } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await unseal<SessionData>(
    request.cookies.get(SESSION_COOKIE)?.value,
  )

  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  // Never return the access token to the browser. It stays on the server.
  return NextResponse.json({
    sub: session.sub,
    name: session.name,
    email: session.email,
    app: 'jobs-app',
    skillsAppUrl: SKILLS_APP_URL(),
  })
}
