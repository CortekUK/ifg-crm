/**
 * The email domain verified with Resend for outbound sending.
 *
 * Team members (recruiters, admins, super_admins) must be invited with an
 * address on this domain. The CRM sends automation emails *as the deal owner*
 * (`from: <their address>`), and Resend only permits sending from a verified
 * domain — so a recruiter on, say, gmail.com would have every outbound email
 * silently rejected. Enforcing the domain at invite time prevents that.
 *
 * Overridable via NEXT_PUBLIC_VERIFIED_EMAIL_DOMAIN (must be public so both the
 * browser invite form and the API route read the same value). Defaults to the
 * IFG production domain.
 */
export const VERIFIED_EMAIL_DOMAIN = (
  process.env.NEXT_PUBLIC_VERIFIED_EMAIL_DOMAIN?.trim().toLowerCase() ||
  'theinternationalfootballgroup.com'
)

/** True when `email`'s domain matches the verified sending domain (case-insensitive). */
export function isVerifiedDomainEmail(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at === -1) return false
  return email.slice(at + 1).trim().toLowerCase() === VERIFIED_EMAIL_DOMAIN
}
