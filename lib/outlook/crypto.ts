import crypto from 'crypto'

/**
 * Encryption at rest for Microsoft tokens.
 *
 * A Microsoft REFRESH TOKEN is long-lived and grants ongoing Mail.Send and
 * Mail.ReadWrite on a real person's mailbox. The spec is explicit: store it
 * encrypted, never log it, never send it to the browser. Plaintext in a table
 * means a single leaked service key hands over every recruiter's mailbox, so
 * the database row is not the last line of defence here.
 *
 * AES-256-GCM, because it authenticates as well as encrypts: a tampered
 * ciphertext fails to decrypt rather than silently yielding garbage that we
 * would then send to Microsoft as a token.
 *
 * Stored format:  v1:<iv-base64>:<authTag-base64>:<ciphertext-base64>
 * The version prefix is there so the key can be rotated later without having
 * to guess what a given row was encrypted with.
 */

const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12 // GCM's standard nonce length

/**
 * The key, as 32 raw bytes.
 *
 * Accepts either 64 hex characters or base64. Generate one with:
 *   openssl rand -hex 32
 *
 * Throws rather than falling back to a default or to plaintext. A missing key
 * must make the Outlook connection unavailable, not quietly store live
 * mailbox credentials in the clear — that is the failure nobody would notice.
 */
function getKey(): Buffer {
  const raw = process.env.OUTLOOK_TOKEN_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'OUTLOOK_TOKEN_ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32` ' +
        'and add it to the environment. Outlook cannot be connected without it.',
    )
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw.trim())
    ? Buffer.from(raw.trim(), 'hex')
    : Buffer.from(raw.trim(), 'base64')

  if (key.length !== 32) {
    throw new Error(
      `OUTLOOK_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64); got ${key.length}.`,
    )
  }
  return key
}

/** True when a usable key is configured, without throwing. */
export function tokenEncryptionAvailable(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':')
}

/**
 * Reverse of encryptToken.
 *
 * Returns null instead of throwing when a value cannot be read — a row
 * encrypted under a rotated key, or truncated. The callers treat null as
 * "this connection needs reconnecting", which is a state the UI already
 * handles, rather than a 500 that takes the whole mailbox screen down.
 */
export function decryptToken(stored: string | null | undefined): string | null {
  if (!stored) return null
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== VERSION) return null
  try {
    const [, ivB64, tagB64, dataB64] = parts
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return null
  }
}
