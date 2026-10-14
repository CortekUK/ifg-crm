import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchRankedContactIds } from '@/lib/contacts/search'

/**
 * Ranking contacts for an unmatched sender.
 *
 * The screen has to justify every suggestion, not just order them: it shows
 * WHICH name parts matched and how confident the match is. So the scorer
 * returns its reasoning, not a bare number.
 *
 * Scored against two things, because an address carries a name even when the
 * display name is missing:
 *   - the sender's display name   ("Hamna Ali")
 *   - the local part of the address ("hamna.ali.07" -> hamna, ali, 07)
 *
 * Each contact name part is compared in turn and earns the best match it can:
 *   exact   — the whole word, same spelling
 *   partial — one is a prefix of the other, at least 3 characters
 *   initial — a single letter against the first letter
 *
 * Why not a fuzzy string distance over the whole name: "Hamna Khan" and
 * "Hamna Mubarak Ali" score almost identically that way, yet one shares a
 * surname with the sender and the other does not. Scoring per part is what
 * makes the difference visible — and visible is the point, because somebody
 * has to accept or reject the suggestion.
 */

export type PartMatch = 'exact' | 'partial' | 'initial' | 'none'
export type Confidence = 'strong' | 'likely' | 'possible'

export interface NamePart {
  slot: 'FIRST' | 'MIDDLE' | 'LAST'
  value: string
  match: PartMatch
}

export interface ContactSuggestion {
  contactId: string
  firstName: string | null
  lastName: string | null
  middleName: string | null
  email: string | null
  country: string | null
  role: 'Player' | 'Parent'
  parts: NamePart[]
  /** 0-100, shown as the bar. */
  score: number
  confidence: Confidence
  emailMatched: boolean
  /** Already has an active deal — used only to break ties. */
  inPipeline: boolean
  deals: { pipeline: string | null; stage: string | null }[]
}

const STOP = new Set(['the', 'and', 'mr', 'mrs', 'ms', 'dr'])

/** Words from a display name and an email local part, lowercased. */
export function tokensFrom(displayName: string | null, email: string | null): string[] {
  const out: string[] = []
  for (const word of (displayName ?? '').split(/[\s,]+/)) {
    const w = word.trim().toLowerCase()
    if (w.length > 1 && !STOP.has(w)) out.push(w)
  }
  // Everything after a "+" is plus-addressing — a tag the person added for
  // their own filtering, never part of their name. Splitting on it turned
  // hamna+testing-horton@… into the tokens "hamna" and "testing", which then
  // matched a contact literally called "Hamna testing" and pushed it to the
  // top of every single suggestion list. It also inflated the token count,
  // diluting the scores of the genuine candidates underneath.
  const local = ((email ?? '').split('@')[0] ?? '').split('+')[0]
  for (const word of local.split(/[._\-]+/)) {
    const w = word.trim().toLowerCase()
    // Digits are dropped: "07" in hamna.ali.07 is a disambiguator the person
    // added for their own mailbox, never part of a name.
    if (w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w)) out.push(w)
  }
  return [...new Set(out)]
}

function matchPart(part: string, tokens: string[]): PartMatch {
  const p = part.trim().toLowerCase()
  if (!p) return 'none'
  if (tokens.includes(p)) return 'exact'
  if (p.length >= 3 && tokens.some((t) => t.length >= 3 && (t.startsWith(p) || p.startsWith(t)))) return 'partial'
  if (tokens.some((t) => t[0] === p[0] && (p.length === 1 || t.length === 1))) return 'initial'
  return 'none'
}

const WEIGHT: Record<PartMatch, number> = { exact: 1, partial: 0.5, initial: 0.25, none: 0 }

export function confidenceOf(score: number): Confidence {
  if (score >= 75) return 'strong'
  if (score >= 45) return 'likely'
  return 'possible'
}

/**
 * Rank candidates for an unmatched address.
 *
 * Candidates are fetched by name token through the existing ranked search, so
 * this reaches all 179,000 contacts rather than scoring whatever first page a
 * plain select returned.
 */
export async function suggestContacts(
  supabase: SupabaseClient,
  senderName: string | null,
  senderEmail: string,
  limit = 5,
): Promise<ContactSuggestion[]> {
  const tokens = tokensFrom(senderName, senderEmail)
  if (!tokens.length) return []

  // Candidates come from search_contacts_ranked — the same relevance-ordered
  // search the Contacts page uses.
  //
  // The first version did its own `ilike %token%` across the name columns and
  // took the first 60 rows. Over 179,000 contacts that is useless: "ali"
  // substring-matches Alicia, Halim and Natalia, so the 60 rows came back full
  // of near-misses while the person actually being looked for was never
  // fetched at all. Ranking only works on candidates you have.
  // In parallel, and capped. Run one after another this took a visible few
  // seconds: each call is a ranked search over 179,000 contacts, and the
  // dialog did nothing until the last one returned. Three at once, 15 each,
  // is plenty — the scorer only shows five suggestions.
  const TOKEN_LIMIT = 3
  const searched = tokens.slice(0, TOKEN_LIMIT).map((token) =>
    fetchRankedContactIds(supabase, { search: token, contactIds: null, limit: 15, offset: 0 })
      .then((r) => r.ids)
      .catch(() => [] as string[]),
  )

  // Plus anyone whose name is EXACTLY one of the sender's words.
  //
  // The ranked search returns the most relevant 15 per token, which is the
  // wrong cut for a common surname: "Horton" fetched fifteen people and the
  // one we are actually mid-conversation with was not among them, so he could
  // never be suggested however good the scoring was. An exact surname or
  // forename is too strong a signal to lose to a relevance cap. `ilike` with
  // no wildcards is an exact, case-insensitive match — not a substring, so
  // this cannot drag in Alicia for "ali".
  // Wrapped in an async function: the Supabase builder is a thenable, not a
  // real Promise, so it has no .catch() to hang a fallback on.
  const exact: Promise<string[]> = (async () => {
    try {
      const { data } = await supabase
        .from('contacts')
        .select('id')
        .or(tokens.flatMap((t) => [`last_name.ilike.${t}`, `first_name.ilike.${t}`]).join(','))
        // Generous, because the cap is shared across every token: with a
        // common forename like "Sarah" a tight limit was spent entirely on
        // forename matches, and the surname match this is here to guarantee
        // was cut off again.
        .limit(200)
      return (data ?? []).map((c) => (c as { id: string }).id)
    } catch {
      return []
    }
  })()

  const results = await Promise.all([...searched, exact])
  const ids = new Set<string>(results.flat())
  if (!ids.size) return []

  // Candidates AND their open deals in one request.
  //
  // These were two sequential round trips — fetch the contacts, then fetch
  // their deals — on top of the searches above. Each hop is 150ms or so
  // against this dataset, and they were all waiting on each other, so the
  // dialog sat on a spinner for well over a second. Embedding the deals makes
  // it one.
  //
  // The deals are here to break ties: surnames tie constantly ("Horton"
  // matched four contacts on identical scores), and somebody writing in is far
  // more likely to mean the player we have an open deal with than a namesake
  // who has never been in touch. It only separates equal scores.
  const { data, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, parent_email, country, deals(id, status)')
    .in('id', [...ids])
  if (error) return []

  const inPipeline = new Set(
    (data ?? [])
      .filter((c) => ((c as { deals?: { status: string }[] }).deals ?? []).some((d) => d.status === 'active'))
      .map((c) => (c as { id: string }).id),
  )

  const rows = (data ?? []) as {
    id: string; first_name: string | null; last_name: string | null
    email: string | null; parent_email: string | null; country: string | null
  }[]

  const scored = rows.map((c) => {
    // A middle name is whatever sits between the first and last word of the
    // first_name field — IFG's contacts routinely carry "Hamna Mubarak" there.
    const firstWords = (c.first_name ?? '').trim().split(/\s+/).filter(Boolean)
    const first = firstWords[0] ?? ''
    const middle = firstWords.slice(1).join(' ')
    const last = c.last_name ?? ''

    const parts: NamePart[] = []
    if (first) parts.push({ slot: 'FIRST', value: first, match: matchPart(first, tokens) })
    if (middle) parts.push({ slot: 'MIDDLE', value: middle, match: matchPart(middle, tokens) })
    if (last) parts.push({ slot: 'LAST', value: last, match: matchPart(last, tokens) })

    const emailMatched = !!c.email && tokensFrom(null, c.email).some((t) => tokens.includes(t))

    const earned = parts.reduce((sum, p) => sum + WEIGHT[p.match], 0)

    // Measured against the SENDER'S words as well as the contact's name.
    //
    // Scoring against the contact's parts alone let a one-word contact win
    // outright: "Hamna Ali" against a contact simply called "hamna" is one
    // part, one exact match, 100% — ranked above "Hamna Mubarak Ali", who
    // matches both a first AND a last name. Taking the larger of the two
    // counts means half a name can only ever be a half match.
    // A middle name the sender did not use is not evidence AGAINST them.
    // "Hamna Ali" writing to us is still obviously Hamna Mubarak Ali; counting
    // the unused "Mubarak" as a miss dropped an exact first-and-last match to
    // "likely", which is the kind of hedging that makes people stop trusting
    // the ranking. An unmatched middle name is ignored; a matched one still
    // counts for.
    const counted = parts.filter((p) => !(p.slot === 'MIDDLE' && p.match === 'none'))
    const possible = Math.max(counted.length, tokens.length, 1)

    // The address agreeing is strong evidence on its own, so it lifts the
    // score rather than being one part among several.
    const raw = (earned / possible) * (emailMatched ? 1.15 : 1)
    const score = Math.round(Math.min(1, raw) * 100)
    const active = inPipeline.has(c.id)

    return {
      contactId: c.id,
      firstName: first || null,
      middleName: middle || null,
      lastName: last || null,
      email: c.email,
      country: c.country,
      role: 'Player' as const,
      parts,
      score,
      confidence: confidenceOf(score),
      emailMatched,
      inPipeline: active,
      deals: [],
    }
  })

  return scored
    .filter((s) => s.score > 0)
    // Score first; an open deal only separates candidates that already scored
    // the same, so the ranking still leads on the name.
    .sort((a, b) => b.score - a.score || Number(b.inPipeline) - Number(a.inPipeline))
    .slice(0, limit)
}
