// Signed unsubscribe links, for the Deno (Edge Function) side.
//
// MIRROR: lib/email/unsubscribe.ts
// tsconfig.json excludes supabase/functions/, so this file and its mirror
// cannot share an import. Any change here MUST be made in the mirror too.
// (Same arrangement as _shared/merge-tags.ts ↔ lib/utils/merge-tags-core.ts.)
//
// The link has to be unguessable, or anyone could unsubscribe anyone else by
// walking contact ids. It is a keyed hash of the contact id rather than a
// stored column because a stored token would need backfilling across 100k+
// existing contacts, and every one that came out null would be a dead
// unsubscribe link in a live email.
//
// Needs NEXT_PUBLIC_APP_URL (the CRM origin) in the function's secrets — the
// same variable the invoice payment links already use. Without it every
// function here returns null and the email falls back to its own default,
// which is a link that goes nowhere: set it.
//   supabase secrets set NEXT_PUBLIC_APP_URL=https://<crm-host>

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
  return (
    Deno.env.get('UNSUBSCRIBE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || null
  )
}

/** CRM origin (not the public website — the unsubscribe route needs the DB). */
function crmOrigin(): string | null {
  const raw = Deno.env.get('NEXT_PUBLIC_APP_URL') || Deno.env.get('APP_URL') || ''
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

/** The link that goes in the email body — a page, never an action on GET. */
export async function unsubscribeUrl(contactId: string): Promise<string | null> {
  const origin = crmOrigin()
  const token = await unsubscribeToken(contactId)
  if (!origin || !token) return null
  return `${origin}/unsubscribe?c=${encodeURIComponent(contactId)}&t=${token}`
}

/** The List-Unsubscribe target (RFC 8058): POST here unsubscribes directly. */
export async function oneClickUnsubscribeUrl(contactId: string): Promise<string | null> {
  const origin = crmOrigin()
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
): Promise<Record<string, string> | null> {
  if (!contactId) return null
  const url = await oneClickUnsubscribeUrl(contactId)
  if (!url) return null
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
