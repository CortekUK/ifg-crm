// Build the custom Message-ID we set on every outbound automation/campaign
// email. The local part is `email_sends.tracking_id` (a UUID we generate
// before sending). When the contact replies, their mail client copies this
// value into the `In-Reply-To` header — we extract it back out and look up
// the originating email_sends row directly, no UUID-guessing required.
//
// Format: <{tracking_id}@reply.{domain}>
//
// The reply subdomain is the same one we already use for inbound — it's the
// domain we own and have MX records on, so any address that ends in it is
// guaranteed to route back through Resend if a recipient ever tries to send
// to it. This makes the Message-ID a syntactically valid, addressable
// identity, which is what RFC 5322 requires.
//
// Falls back to "reply.local" only when INBOUND_REPLY_DOMAIN is unset (e.g.
// in tests). The actual matching code looks at the local-part UUID, so the
// domain doesn't have to match anything to find the row — but using a real
// owned domain prevents downstream anti-spam issues.

export function buildOutboundMessageId(trackingId: string, domainEnvVar = 'INBOUND_REPLY_DOMAIN'): string {
  const domain = (Deno.env.get(domainEnvVar) ?? 'reply.local').trim().replace(/^@+/, '')
  const replyDomain = domain.startsWith('reply.') ? domain : `reply.${domain}`
  return `<${trackingId}@${replyDomain}>`
}

// UUID v4 pattern (case-insensitive, anchored to grab the local part of a
// Message-ID like <UUID@host>).
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

// Extract every UUID from an In-Reply-To / References header blob. Replies
// typically reference one Message-ID, but References can list the whole
// thread chain — we match against any of them so a deeply-nested reply
// thread still resolves.
export function extractTrackingUuids(headerBlob: string | null | undefined): string[] {
  if (!headerBlob) return []
  const matches = headerBlob.match(UUID_PATTERN)
  if (!matches) return []
  return Array.from(new Set(matches.map((u) => u.toLowerCase())))
}

// Build a sub-addressed Reply-To that encodes the email_sends.tracking_id.
// Mail clients preserve the local part when replying, so we can pull the
// tracking_id back out of the inbound `To:` header and match exactly to the
// originating email_sends row — no Message-ID guessing required.
//
//   replies+{tracking_id}@reply.<domain>
//
// Returns null if INBOUND_REPLY_DOMAIN isn't configured; in that case the
// caller should fall back to whatever reply_to it would have used previously.
export function buildReplyToAddress(
  trackingId: string,
  domainEnvVar = 'INBOUND_REPLY_DOMAIN'
): string | null {
  const raw = (Deno.env.get(domainEnvVar) ?? '').trim().replace(/^@+/, '')
  if (!raw) return null
  const replyDomain = raw.startsWith('reply.') ? raw : `reply.${raw}`
  return `replies+${trackingId}@${replyDomain}`
}

// Recover the tracking_id from an inbound email's `To:` value. Accepts the
// raw header (a single string) or an array of recipients. Looks for the first
// `+UUID` segment in any address whose domain ends in our reply domain.
export function extractTrackingIdFromTo(
  to: string | string[] | null | undefined
): string | null {
  if (!to) return null
  const list = Array.isArray(to) ? to : [to]
  for (const addr of list) {
    if (!addr) continue
    const m = addr.match(/\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i)
    if (m) return m[1].toLowerCase()
  }
  return null
}
