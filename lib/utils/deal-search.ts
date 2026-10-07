/**
 * Quick search across a pipeline board.
 *
 * The board used to match with a single `includes()` against
 * `"<first> <last>"`, which failed the two things recruiters actually do:
 *
 *   * Typing a full name when the record carries a middle name. "John Smith"
 *     never matched "John Michael Smith", because the query has to appear as
 *     one unbroken run. Searching by tokens fixes it — every word must appear
 *     somewhere, in any order.
 *   * Pasting. A copied cell arrives as " john smith " or with a double space
 *     in the middle, and a raw `includes(" john")` matches nothing.
 *
 * It also only looked at the name and the deal title, so searching an email —
 * the one thing that is guaranteed unique and the thing people paste most —
 * returned nothing at all.
 */

import type { Deal } from '@/lib/types/pipelines'

/**
 * Lowercase, strip accents, collapse runs of whitespace, trim.
 *
 * Accent folding matters here: IFG's players are international, so a record
 * reading "José" has to be reachable by someone typing "Jose" on a UK
 * keyboard. NFD splits a letter from its diacritic so the combining marks can
 * be dropped on their own.
 */
function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** The query split into words. Empty when the query is blank or all spaces. */
export function searchTokens(query: string): string[] {
  const cleaned = normalise(query)
  return cleaned.length > 0 ? cleaned.split(' ') : []
}

/**
 * Everything about a deal worth matching against, as one string. The phone is
 * included both as stored and as bare digits, so "7123" finds it however the
 * spaces fell.
 */
function searchableText(deal: Deal): string {
  const contact = deal.contact
  const parts = [
    contact?.first_name,
    contact?.last_name,
    contact?.email,
    contact?.phone,
    contact?.graduation_year != null ? String(contact.graduation_year) : null,
    deal.title,
  ].filter((part): part is string => Boolean(part))

  const text = normalise(parts.join(' '))
  const digits = phoneDigits(contact?.phone)
  return digits ? `${text} ${digits}` : text
}

/** A phone reduced to digits with any leading trunk '0' dropped. */
function phoneDigits(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.startsWith('0') ? digits.slice(1) : digits
}

/**
 * The same number written two ways.
 *
 * "+44 7123 456789" is stored for one player and "07123 456789" for the next,
 * and they are the same number — a recruiter pasting one should find the
 * other. Comparing from the right-hand end is what makes that work: strip to
 * digits, drop the trunk '0', then accept when either ends with the other.
 * Six digits is the floor, below which a "match" is coincidence.
 */
const MIN_PHONE_DIGITS = 6

function matchesPhone(token: string, stored: string): boolean {
  if (!stored) return false
  const query = phoneDigits(token)
  if (query.length < MIN_PHONE_DIGITS) return false
  return stored.endsWith(query) || query.endsWith(stored)
}

/**
 * Does this deal match the search box?
 *
 * Every token must match something, which is what lets a first + last name
 * find a record that also holds a middle name. A blank query matches
 * everything, so the caller can pass the raw input without guarding.
 */
export function matchesDealSearch(deal: Deal, query: string): boolean {
  const tokens = searchTokens(query)
  if (tokens.length === 0) return true

  const text = searchableText(deal)
  const storedPhone = phoneDigits(deal.contact?.phone)

  return tokens.every((token) => text.includes(token) || matchesPhone(token, storedPhone))
}
