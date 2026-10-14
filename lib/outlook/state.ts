import crypto from 'crypto'

/**
 * Signed state for the Microsoft OAuth round trip.
 *
 * `state` guards against someone being walked through a consent flow that
 * attaches THEIR mailbox to SOMEONE ELSE'S CRM account. It carries the user
 * id, is HMAC-signed so it cannot be edited, and is short-lived. The nonce is
 * also echoed in an HttpOnly cookie, so a signed state lifted from a server
 * log still cannot be replayed from another browser.
 */

const MAX_AGE_MS = 10 * 60 * 1000 // consent should take seconds, not hours
export const OAUTH_STATE_COOKIE = 'ifg_ms_oauth_nonce'

function secret(): string {
  const value =
    process.env.OUTLOOK_TOKEN_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  if (!value) throw new Error('No secret available to sign the OAuth state.')
  return value
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createState(userId: string): { state: string; nonce: string } {
  const nonce = crypto.randomBytes(16).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, nonce, ts: Date.now() }),
  ).toString('base64url')
  return { state: `${payload}.${sign(payload)}`, nonce }
}

/** Returns the user id the state was minted for, or null if it fails any check. */
export function verifyState(state: string | null, cookieNonce: string | null): string | null {
  if (!state || !cookieNonce) return null
  const [payload, signature] = state.split('.')
  if (!payload || !signature) return null

  // Constant-time compare — a fast-exit string compare on an HMAC is a
  // textbook way to let the signature be guessed a byte at a time.
  const expected = sign(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const { uid, nonce, ts } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!uid || !nonce || typeof ts !== 'number') return null
    if (Date.now() - ts > MAX_AGE_MS) return null
    if (nonce !== cookieNonce) return null
    return uid as string
  } catch {
    return null
  }
}
