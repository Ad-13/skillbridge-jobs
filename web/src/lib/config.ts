import { createRemoteJWKSet } from 'jose'

const required = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const IS_PRODUCTION = process.env.NODE_ENV === 'production'

export const BASE_URL = () => required('BASE_URL')
export const CLIENT_ID = () => required('OIDC_CLIENT_ID')
export const CLIENT_SECRET = () => required('OIDC_CLIENT_SECRET')
export const API_AUDIENCE = () => required('API_AUDIENCE')
export const SESSION_SECRET = () => required('SESSION_SECRET')
export const JOBS_API_URL = () => required('JOBS_API_URL')
export const SKILLS_API_URL = () => required('SKILLS_API_URL')
export const SKILLS_APP_URL = () => process.env.SKILLS_APP_URL ?? '#'

export const REDIRECT_URI = () => `${BASE_URL()}/auth/callback`

interface OidcDocument {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
  end_session_endpoint?: string
}

// Unlike the Express services, discovery here must NOT run at module load.
// Next evaluates route modules during `next build`, and a top-level await
// on a network call would make the build depend on the provider being
// reachable. Instead we fetch once, lazily, and cache the promise for the
// lifetime of the process.
let discovery: Promise<OidcDocument> | null = null

export const getOidc = (): Promise<OidcDocument> => {
  discovery ??= (async () => {
    const input = required('OIDC_ISSUER')
    const base = input.endsWith('/') ? input : `${input}/`
    const url = new URL('.well-known/openid-configuration', base)

    const response = await fetch(url)
    if (!response.ok) {
      discovery = null // let the next request retry instead of caching a failure
      throw new Error(`OIDC discovery failed with ${response.status} at ${url}`)
    }
    return (await response.json()) as OidcDocument
  })()

  return discovery
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

export const getJwks = async () => {
  if (!jwks) {
    const oidc = await getOidc()
    jwks = createRemoteJWKSet(new URL(oidc.jwks_uri))
  }
  return jwks
}
