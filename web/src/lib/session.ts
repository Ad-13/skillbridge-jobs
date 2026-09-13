import crypto from 'node:crypto'
import { EncryptJWT, jwtDecrypt } from 'jose'
import { SESSION_SECRET, IS_PRODUCTION } from './config'

export interface SessionData {
  sub: string
  name: string
  email: string | null
  accessToken: string
  [key: string]: unknown
}

export const SESSION_COOKIE = 'sid'
export const TRANSACTION_COOKIE = 'auth_tx'

export const SESSION_TTL_SECONDS = 8 * 60 * 60
export const TRANSACTION_TTL_SECONDS = 5 * 60

export const cookieOptions = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: IS_PRODUCTION,
  path: '/',
}

// A256GCM requires exactly 32 bytes; hashing the secret guarantees it.
const keyFor = () => crypto.createHash('sha256').update(SESSION_SECRET()).digest()

// Encrypted, not merely signed: the payload carries the user's access
// token, which must remain unreadable to the browser.
export const seal = (payload: Record<string, unknown>, expiresIn: string) =>
  new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .encrypt(keyFor())

export const unseal = async <T>(value: string | undefined): Promise<T | null> => {
  if (!value) return null
  try {
    const { payload } = await jwtDecrypt(value, keyFor())
    return payload as T
  } catch {
    // Tampered, wrong key, or expired — all mean "no session".
    return null
  }
}
