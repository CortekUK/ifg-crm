/**
 * Signed unsubscribe links.
 *
 * MIRROR: supabase/functions/_shared/unsubscribe.ts
 * tsconfig.json excludes supabase/functions/, so this file and its mirror
 * cannot share an import. Any change here MUST be made in the mirror too.
 * (Same arrangement as lib/utils/merge-tags-core.ts ↔ _shared/merge-tags.ts.)
 *
 * The link has to be unguessable, or anyone could unsubscribe anyone else by
 * walking contact ids. It is a keyed hash of the contact id rather than a
 * stored column because a stored token would need backfilling across 100k+
 * existing contacts, and every one that came out null would be a dead
 * unsubscribe link in a live email.
 *
 * Key: UNSUBSCRIBE_SECRET if set, else derived from the service-role key. The
 * derivation (an HMAC over a fixed purpose string) is what keeps this from
 * being plain key reuse — the signing key is a one-way function of the
 * service key, so a token can never be walked back to it.
 */

const PURPOSE = 'ifg-unsubscribe-v1'

/** Base64url, unpadded — safe in a query string without escaping. */
function base64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
}

function rootSecret(): string | null {
  return process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null
}

/**
 * CRM origin (not the public website — the unsubscribe route needs the DB).
 *
 * `override` is for callers that already know which host they are serving, so
 * a test email sent from localhost links back to localhost rather than to
 * whatever NEXT_PUBLIC_APP_URL happens to point at.
 */
function crmOrigin(override?: string | null): string | null {
  const raw = override || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ''
  const trimmed = raw.trim().replace(/\/+$/, '')
  return /^https?:\/\//.test(trimmed) ? trimmed : null
}

/** Token for a contact id, or null when no signing key is configured. */
export async function unsubscribeToken(contactId: string): Promise<string | null> {
  const secret = rootSecret()
  if (!secret || !contactId) return null
  const derived = await hmac(new TextEncoder().encode(secret), PURPOSE)
  return base64url(await hmac(derived, contactId))
}

/**
 * Compare without leaking where two tokens diverge. Length is compared first
 * and is not itself a secret (every token is the same length).
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyUnsubscribeToken(contactId: string, token: string): Promise<boolean> {
  if (!contactId || !token) return false
  const expected = await unsubscribeToken(contactId)

  // Say WHY a token was rejected, server-side.
  //
  // A rejection has two very different causes that looked identical from the
  // outside: a genuinely bad link, or the signer and the verifier holding
  // different keys. The second one makes EVERY unsubscribe link in every email
  // dead, and it is invisible — the reader sees "This link isn't valid" and
  // nothing is logged, so it reads as one person mangling one URL.
  //
  // That is exactly what happened: the edge function signed with the
  // service-role key Supabase injects, the web app verified with the one in
  // its own environment, and after the project moved to the new API key format
  // those two stopped being the same value. Nobody could have diagnosed it
  // from the symptom. Hence the log line, and hence UNSUBSCRIBE_SECRET being
  // set explicitly on both sides rather than relying on key parity.
  if (expected === null) {
    console.error(
      '[unsubscribe] No signing key configured — set UNSUBSCRIBE_SECRET (or SUPABASE_SERVICE_ROLE_KEY). Every unsubscribe link will be rejected until this is set.',
    )
    return false
  }

  const ok = timingSafeEqual(expected, token)
  if (!ok) {
    console.warn(
      `[unsubscribe] Token rejected for contact ${contactId}. If this is happening for every reader, ` +
        'the signing key here differs from the one the sender used — UNSUBSCRIBE_SECRET must be byte-identical ' +
        'in Vercel and in the Supabase edge-function secrets.',
    )
  }
  return ok
}

/**
 * The link that goes in the email body. A page, not an action: mail clients
 * and security scanners follow links in email with GET, and an endpoint that
 * unsubscribed on GET would opt people out who never clicked anything.
 */
export async function unsubscribeUrl(contactId: string, origin_?: string | null): Promise<string | null> {
  const origin = crmOrigin(origin_)
  const token = await unsubscribeToken(contactId)
  if (!origin || !token) return null
  return `${origin}/unsubscribe?c=${encodeURIComponent(contactId)}&t=${token}`
}

/**
 * The List-Unsubscribe target (RFC 8058). Posting here unsubscribes with no
 * confirmation step, which is exactly what the spec requires of one-click —
 * the mail client has already confirmed with the reader.
 */
export async function oneClickUnsubscribeUrl(contactId: string, origin_?: string | null): Promise<string | null> {
  const origin = crmOrigin(origin_)
  const token = await unsubscribeToken(contactId)
  if (!origin || !token) return null
  return `${origin}/api/public/unsubscribe?c=${encodeURIComponent(contactId)}&t=${token}`
}

/**
 * The two headers that put a native "Unsubscribe" button in Gmail and Outlook.
 * Returns null when the link can't be built, so callers can spread it safely.
 */
export async function unsubscribeHeaders(
  contactId: string | null | undefined,
  origin?: string | null,
): Promise<Record<string, string> | null> {
  if (!contactId) return null
  const url = await oneClickUnsubscribeUrl(contactId, origin)
  if (!url) return null
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
