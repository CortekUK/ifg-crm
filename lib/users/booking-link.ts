/**
 * Validation for a staff member's Calendly booking link.
 *
 * Shared because the link can be set from two places — a user editing their
 * own profile (Settings → Profile) and an admin editing someone else's
 * (Users → Edit user) — and whatever is stored here is emailed to players as
 * their recruiter's "Book a meeting" link. Checking it in only one of the two
 * screens would leave the other as a way in.
 *
 * QA-49 Issue 4: the field only checked that the value was an http(s)
 * address, so a link to any site at all was accepted and sent to players.
 */

/** A full http(s) web address. Empty passes — the field is optional. */
export function isHttpUrl(url: string): boolean {
  if (!url) return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Whether the link really is a Calendly one.
 *
 * Matched on the hostname rather than as a substring, so
 * `https://evil.example.com/calendly.com` does not pass. Subdomains do, for
 * an organisation on `ifg.calendly.com`.
 */
export function isCalendlyUrl(url: string): boolean {
  if (!url) return true
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'calendly.com' || host.endsWith('.calendly.com')
  } catch {
    return false
  }
}

export const CALENDLY_HINT =
  'Use your Calendly booking link, e.g. https://calendly.com/your-name'

/** The message to show, or null when the value is acceptable. */
export function calendlyUrlError(url: string): string | null {
  if (!url) return null
  if (!isHttpUrl(url)) return `Please enter a full web address. ${CALENDLY_HINT}`
  if (!isCalendlyUrl(url)) {
    return `That is not a Calendly link, so players could not book with it. ${CALENDLY_HINT}`
  }
  return null
}
