/**
 * The rules half of the Outlook relevance filter: no database, no network.
 *
 * A connected mailbox is a person's whole work inbox, and that inbox also
 * receives their Instagram login codes, their bank's "new sign-in" alerts and
 * every shop they ever gave the address to. None of that is IFG business, and
 * none of it should ever be written into the CRM — not hidden, not stored.
 *
 * These checks only ever run on mail that NO keep rule has claimed (see
 * relevance.ts). A player, a parent, a colleague or a conversation the CRM is
 * already part of is kept before any of this is consulted, so a pattern here
 * can hide a robot or a promotion but never a person we work with.
 *
 * Kept free of imports so scripts/verify-outlook-relevance.mjs can exercise
 * every rule offline.
 */

export type DropReason =
  | 'otp'
  | 'account_security'
  | 'consumer_service'
  | 'automated_sender'
  | 'bulk_mail'
  | 'auto_generated'
  | 'ai_personal'

/**
 * One-time codes, sign-in alerts, password resets. Matched on the subject,
 * because that is where every service puts it — and because a subject is what
 * shows on the list row an admin would have seen.
 */
const OTP_SUBJECT = [
  /\botp\b/i,
  /\bone[- ]?time (pass ?(word|code)|code|pin|login)\b/i,
  /\b(verification|security|login|log-in|sign[- ]?in|confirmation|authentication|access|2fa|single-use) code\b/i,
  /\bpass ?code\b/i,
  /\byour (\w+ )?code is\b/i,
  /\bcode:\s*\d{4,8}\b/i,
  /^\s*\d{4,8}\s+is your\b/i,
]

const SECURITY_SUBJECT = [
  /\bverify your (email|e-mail|account|identity|login|device|phone|number|address)\b/i,
  /\bconfirm your (email|e-mail|account|email address|registration|sign[- ]?up)\b/i,
  /\b(password|passcode) (reset|change|changed|was changed|expir\w*)\b/i,
  /\breset your password\b/i,
  /\bnew (sign[- ]?in|login|log-in|device)\b/i,
  /\b(sign[- ]?in|login|log-in) (attempt|alert|activity|notification|detected|from)\b/i,
  /\b(unusual|suspicious|unrecognised|unrecognized) (sign[- ]?in|login|activity|device)\b/i,
  /\btwo[- ]?(factor|step)\b/i,
  /\b2-?step verification\b/i,
  /\b2fa\b/i,
  /\bsecurity (alert|notification|warning|check)\b/i,
  /\baccount (alert|security|recovery|locked|suspended)\b/i,
  /\bsomeone (tried to|signed in|logged in)\b/i,
]

/**
 * Codes that only show in the body. Narrow on purpose — it needs the word
 * "code" next to a kind of code, so a parent writing "the postcode is…" or
 * "my booking reference is 1234" is not caught.
 */
const OTP_BODY =
  /\b(verification|security|one[- ]time|login|log-in|sign[- ]?in|confirmation|authentication|access) (code|pin|passcode)\b/i

/**
 * Consumer services a work mailbox gets mail from because somebody used it to
 * sign up. Never a webmail provider: parents write from gmail.com, hotmail.com,
 * icloud.com and outlook.com, and listing those would drop every one of them.
 * Matched on the domain and its subdomains (mail.instagram.com, …).
 */
export const CONSUMER_SERVICE_DOMAINS = [
  'instagram.com',
  'facebookmail.com',
  'facebook.com',
  'meta.com',
  'whatsapp.com',
  'messenger.com',
  'threads.net',
  'tiktok.com',
  'snapchat.com',
  'x.com',
  'twitter.com',
  'pinterest.com',
  'reddit.com',
  'redditmail.com',
  'discord.com',
  'telegram.org',
  'linkedin.com',
  'google.com',
  'youtube.com',
  'apple.com',
  'accountprotection.microsoft.com',
  'amazon.com',
  'amazon.co.uk',
  'paypal.com',
  'paypal.co.uk',
  'ebay.com',
  'ebay.co.uk',
  'netflix.com',
  'spotify.com',
  'primevideo.com',
  'disneyplus.com',
  'uber.com',
  'deliveroo.co.uk',
  'just-eat.co.uk',
  'temu.com',
  'shein.com',
  'aliexpress.com',
]

/**
 * Addresses no human writes from. Same patterns as classify-sender.ts
 * VENDOR_LOCAL_PART, which hid them from display; here they stop the mail
 * being stored at all. Calendly is the one robot kept — see relevance.ts.
 */
const AUTOMATED_LOCAL_PART =
  /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer[-_]?daemon$|postmaster$|notifications?([-_.]|$)|bounces?([-_.]|$)|automated|auto[-_]?reply|auto[-_]?confirm|messaging[-_]service$|microsoftexchange[0-9a-f]{16,}$|alerts?([-_.]|$)|security([-_.]|$)|account[-_.]?security|verify([-_.]|$)|marketing([-_.]|$)|newsletters?([-_.]|$)|promo(tions?)?([-_.]|$))/

const MAIL_INFRASTRUCTURE_DOMAINS = [
  'ccsend.com',
  'amazonses.com',
  'sendgrid.net',
  'mailchimp.com',
  'mcsv.net',
  'rsgsv.net',
  'sparkpostmail.com',
  'mandrillapp.com',
  'mailgun.org',
  'klaviyomail.com',
  'hubspotemail.net',
  'sendinblue.com',
  'brevo.com',
  'mailjet.com',
  'exacttarget.com',
  'cmail19.com',
  'cmail20.com',
]

function domainOf(address: string): { local: string; domain: string } | null {
  const a = address.trim().toLowerCase()
  const at = a.lastIndexOf('@')
  if (at < 1) return null
  return { local: a.slice(0, at), domain: a.slice(at + 1) }
}

function domainIn(domain: string, list: string[]): boolean {
  return list.some((d) => domain === d || domain.endsWith(`.${d}`))
}

export function isConsumerService(address: string | null | undefined): boolean {
  const parts = domainOf(address ?? '')
  return !!parts && domainIn(parts.domain, CONSUMER_SERVICE_DOMAINS)
}

export function isAutomatedAddress(address: string | null | undefined): boolean {
  const parts = domainOf(address ?? '')
  if (!parts) return false
  if (AUTOMATED_LOCAL_PART.test(parts.local)) return true
  return domainIn(parts.domain, MAIL_INFRASTRUCTURE_DOMAINS)
}

/** Header names are case-insensitive; Graph returns them as the sender wrote them. */
function header(headers: Record<string, string>, name: string): string | null {
  const wanted = name.toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === wanted) return v
  }
  return null
}

/**
 * Mailing lists, newsletters and promotions. Every bulk sender that respects
 * the law sets one of these; a parent typing an email sets none of them.
 */
export function bulkHeaderReason(headers: Record<string, string>): DropReason | null {
  if (header(headers, 'List-Unsubscribe') || header(headers, 'List-Id')) return 'bulk_mail'
  const precedence = (header(headers, 'Precedence') ?? '').toLowerCase()
  if (/\b(bulk|list|junk)\b/.test(precedence)) return 'bulk_mail'
  const autoSubmitted = (header(headers, 'Auto-Submitted') ?? '').toLowerCase()
  if (autoSubmitted && autoSubmitted !== 'no') return 'auto_generated'
  return null
}

export interface MarkerInput {
  /** The address the mail is with: the sender inbound, the recipient outbound. */
  counterparty: string | null
  subject: string | null
  /** Plain text with quoted history already removed. */
  text: string
}

/**
 * Does this message carry a sign of being personal or machine-sent?
 * Returns why, or null when nothing here can tell — which sends it on to the
 * AI check rather than keeping or dropping it by default.
 */
export function personalMarker(input: MarkerInput): DropReason | null {
  const subject = input.subject ?? ''
  if (OTP_SUBJECT.some((re) => re.test(subject))) return 'otp'
  if (SECURITY_SUBJECT.some((re) => re.test(subject))) return 'account_security'
  if (OTP_BODY.test(input.text.slice(0, 1500))) return 'otp'
  if (isConsumerService(input.counterparty)) return 'consumer_service'
  if (isAutomatedAddress(input.counterparty)) return 'automated_sender'
  // A footer link to unsubscribe is a newsletter, not a person — read on the
  // trimmed text so our own campaign, quoted under a reply, does not count.
  if (/\bunsubscribe\b/i.test(input.text) && /\b(preferences|view (it )?in (your )?browser|mailing list|marketing)\b/i.test(input.text)) {
    return 'bulk_mail'
  }
  return null
}
