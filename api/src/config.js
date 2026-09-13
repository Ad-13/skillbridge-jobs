import 'dotenv/config'
import { createRemoteJWKSet } from 'jose'

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const PORT = Number(process.env.PORT ?? 4000)
export const IS_PRODUCTION = process.env.NODE_ENV === 'production'
export const API_AUDIENCE = required('API_AUDIENCE')

const issuerInput = required('OIDC_ISSUER')
const issuerBase = issuerInput.endsWith('/') ? issuerInput : `${issuerInput}/`
const discoveryUrl = new URL('.well-known/openid-configuration', issuerBase)

const response = await fetch(discoveryUrl)

if (!response.ok) {
  throw new Error(
    `OIDC discovery failed with ${response.status} at ${discoveryUrl}. ` +
      'Check OIDC_ISSUER and that the provider is reachable.',
  )
}

export const oidc = await response.json()

// Verify against the issuer the provider declares, not our own env var.
export const ISSUER = oidc.issuer

export const JWKS = createRemoteJWKSet(new URL(oidc.jwks_uri))
