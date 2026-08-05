/**
 * The email domains verified with Resend for outbound sending.
 *
 * Internal CRM team members (recruiters, admins, super_admins) must be created
 * with an address on one of these professional domains. The CRM sends
 * automation emails *as the deal owner* (`from: <their address>`), and Resend
 * only permits sending from a verified domain — so a recruiter on, say,
 * gmail.com would have every outbound email silently rejected. Enforcing the
 * domain at invite time (and in the handle_new_user DB trigger) prevents that,
 * and blocks self-signup privilege escalation.
 *
 * Overridable via NEXT_PUBLIC_VERIFIED_EMAIL_DOMAINS (comma-separated) — must be
 * public so both the browser invite form and the API route read the same value.
 * The legacy singular NEXT_PUBLIC_VERIFIED_EMAIL_DOMAIN is still honoured.
 * Defaults to IFG's two production domains.
 *
 * NOTE: the same allow-list is hard-coded in the `handle_new_user` DB trigger
 * (migration 150). If you change the domains here, update that trigger too.
 */
export const VERIFIED_EMAIL_DOMAINS: string[] = (() => {
  const raw =
    process.env.NEXT_PUBLIC_VERIFIED_EMAIL_DOMAINS?.trim() ||
    process.env.NEXT_PUBLIC_VERIFIED_EMAIL_DOMAIN?.trim() ||
    'theinternationalfootballgroup.com,macclesfieldfc.com'
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
})()

/** Primary domain — used for input placeholders / single-domain copy. */
export const VERIFIED_EMAIL_DOMAIN = VERIFIED_EMAIL_DOMAINS[0]

/** Human label, e.g. "@theinternationalfootballgroup.com or @macclesfieldfc.com". */
export const VERIFIED_EMAIL_DOMAINS_LABEL = VERIFIED_EMAIL_DOMAINS.map((d) => `@${d}`).join(' or ')

/** True when `email`'s domain matches one of the verified sending domains (case-insensitive). */
export function isVerifiedDomainEmail(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at === -1) return false
  return VERIFIED_EMAIL_DOMAINS.includes(email.slice(at + 1).trim().toLowerCase())
}
