/** Staff accounts that administer the CRM but must never own deals. */
export const EXCLUDED_DEAL_OWNER_EMAILS = [
  'superadmin@theinternationalfootballgroup.com',
] as const

const excludedEmails = new Set<string>(EXCLUDED_DEAL_OWNER_EMAILS)

export function isExcludedDealOwnerEmail(email: string | null | undefined): boolean {
  return excludedEmails.has(email?.trim().toLowerCase() || '')
}

/**
 * The same exclusion as a PostgREST filter value, for queries that pick deal
 * owners server-side.
 *
 * Those queries each carried their own `.neq('email', 'superadmin@…')`
 * literal, so the list of accounts that must never own a deal lived in four
 * places and only one of them was this file. Adding a second exclusion would
 * have had to find all four.
 */
export function excludedDealOwnerFilter(): string {
  return `(${EXCLUDED_DEAL_OWNER_EMAILS.join(',')})`
}
