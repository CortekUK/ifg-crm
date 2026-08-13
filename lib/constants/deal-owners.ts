/** Staff accounts that administer the CRM but must never own deals. */
export const EXCLUDED_DEAL_OWNER_EMAILS = [
  'superadmin@theinternationalfootballgroup.com',
] as const

const excludedEmails = new Set<string>(EXCLUDED_DEAL_OWNER_EMAILS)

export function isExcludedDealOwnerEmail(email: string | null | undefined): boolean {
  return excludedEmails.has(email?.trim().toLowerCase() || '')
}
