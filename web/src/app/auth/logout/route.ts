import { NextResponse } from 'next/server'
import { getOidc, BASE_URL, CLIENT_ID } from '@/lib/config'
import { SESSION_COOKIE } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const oidc = await getOidc()

  // Dropping our own cookie is not enough: the session at the provider
  // would stay alive, and the next sign-in would pass silently — which
  // reads to the user as "logout is broken".
  //
  // Auth0 uses its own /v2/logout path instead of the standard
  // end_session_endpoint. This is the only provider-specific line here.
  const url = new URL('/v2/logout', oidc.issuer)
  url.searchParams.set('client_id', CLIENT_ID())
  url.searchParams.set('returnTo', BASE_URL())

  const response = NextResponse.redirect(url.toString())
  response.cookies.delete(SESSION_COOKIE)
  return response
}
