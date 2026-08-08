/**
 * Normalisation helpers for the historic ActiveCampaign data import.
 *
 * The exports carry a decade of free-text entry: 231 distinct position values,
 * 235 distinct state values and 102 country values, many of which are the same
 * thing typed differently ("CA" / "California" / "CALIFORNIA" / "Calfornia").
 * Tagging those raw would produce hundreds of near-duplicate tags, so we fold
 * them into a canonical set here.
 *
 * Two rules hold throughout:
 *   1. The contact's own field keeps the RAW value — we never overwrite what
 *      the client actually recorded. Normalisation only decides which TAG to
 *      attach, so nothing is lost and the tag list stays usable.
 *   2. Unrecognised values yield null (no tag) rather than a guess. A junk tag
 *      is worse than a missing one.
 *
 * The tag categories used here ('position', 'location', 'gender', 'year') match
 * lib/forms/lead-routing.ts so imported contacts and live website leads share
 * one vocabulary.
 */

// ---- Positions -------------------------------------------------------------

/** The nine positions every raw value folds into. */
export const CANONICAL_POSITIONS = [
  'Goalkeeper',
  'Center Back',
  'Outside Back',
  'Defender',
  'Defensive Midfielder',
  'Midfielder',
  'Attacking Midfielder',
  'Outside Midfielder',
  'Forward',
] as const

export type CanonicalPosition = (typeof CANONICAL_POSITIONS)[number]

/** Normalised token → canonical position. Keys are lowercased, non-alphanumerics stripped. */
const POSITION_ALIASES: Record<string, CanonicalPosition> = {
  // Goalkeeper
  goalkeeper: 'Goalkeeper',
  keeper: 'Goalkeeper',
  goalie: 'Goalkeeper',
  gk: 'Goalkeeper',
  // Centre backs
  centerback: 'Center Back',
  centreback: 'Center Back',
  centralstopper: 'Center Back',
  centraldefender: 'Center Back',
  centrehalf: 'Center Back',
  cb: 'Center Back',
  // Full backs / wing backs
  outsideback: 'Outside Back',
  fullback: 'Outside Back',
  wingback: 'Outside Back',
  rightback: 'Outside Back',
  leftback: 'Outside Back',
  rb: 'Outside Back',
  lb: 'Outside Back',
  rwb: 'Outside Back',
  lwb: 'Outside Back',
  // Generic defender
  defender: 'Defender',
  defence: 'Defender',
  defense: 'Defender',
  def: 'Defender',
  // Defensive midfield
  defensivemidfielder: 'Defensive Midfielder',
  defensivemid: 'Defensive Midfielder',
  holdingmidfielder: 'Defensive Midfielder',
  cdm: 'Defensive Midfielder',
  dm: 'Defensive Midfielder',
  // Generic midfield
  midfielder: 'Midfielder',
  midfield: 'Midfielder',
  centralmidfielder: 'Midfielder',
  centremidfielder: 'Midfielder',
  centermidfielder: 'Midfielder',
  boxtoboxmidfielder: 'Midfielder',
  mid: 'Midfielder',
  cm: 'Midfielder',
  // Attacking midfield
  attackingmidfielder: 'Attacking Midfielder',
  attackingmid: 'Attacking Midfielder',
  playmaker: 'Attacking Midfielder',
  cam: 'Attacking Midfielder',
  am: 'Attacking Midfielder',
  // Wide midfield / wingers
  outsidemidfielder: 'Outside Midfielder',
  widemidfielder: 'Outside Midfielder',
  winger: 'Outside Midfielder',
  leftwinger: 'Outside Midfielder',
  rightwinger: 'Outside Midfielder',
  leftwing: 'Outside Midfielder',
  rightwing: 'Outside Midfielder',
  rm: 'Outside Midfielder',
  lm: 'Outside Midfielder',
  lw: 'Outside Midfielder',
  rw: 'Outside Midfielder',
  // Forwards
  forward: 'Forward',
  striker: 'Forward',
  attacker: 'Forward',
  centreforward: 'Forward',
  centerforward: 'Forward',
  fwd: 'Forward',
  fw: 'Forward',
  st: 'Forward',
  cf: 'Forward',
}

/**
 * Values that appear in the position column but carry no football meaning —
 * form artefacts, other sports, placeholder text. Matched after normalisation.
 */
const POSITION_NOISE = new Set([
  'unknown',
  'footballposition',
  'array',
  'na',
  'none',
  'other',
  'pointguard',
  'shootingguard',
])

function normaliseToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents ("Milieu defensif")
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Split a raw position cell into canonical positions.
 *
 * Cells routinely hold several positions at once, in three different styles:
 *   "Attacking Midfielder, Forward"  → comma separated
 *   "Fwd/Midfielder"                 → slash separated
 *   "AttackingMidfielder,Forward"    → camel case, no spaces
 *
 * Returns a de-duplicated list preserving first-seen order, or [] when nothing
 * recognisable is present.
 */
export function normalisePositions(raw: string | null | undefined): CanonicalPosition[] {
  if (!raw?.trim()) return []

  const out: CanonicalPosition[] = []
  const seen = new Set<CanonicalPosition>()

  // Parentheses split too, so "Left Back (LB)" yields both spellings of the
  // same position and de-duplicates down to one tag.
  for (const part of raw.split(/[,;/|&()]+|\band\b/i)) {
    const token = normaliseToken(part)
    if (!token || POSITION_NOISE.has(token)) continue

    const match = POSITION_ALIASES[token]
    if (match && !seen.has(match)) {
      seen.add(match)
      out.push(match)
    }
  }

  return out
}

// ---- US states and Canadian provinces --------------------------------------

const US_STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  newhampshire: 'NH', newjersey: 'NJ', newmexico: 'NM', newyork: 'NY',
  northcarolina: 'NC', northdakota: 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', rhodeisland: 'RI', southcarolina: 'SC',
  southdakota: 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', westvirginia: 'WV', wisconsin: 'WI',
  wyoming: 'WY', districtofcolumbia: 'DC', washingtondc: 'DC',
  puertorico: 'PR', virginislands: 'VI',
}

const CA_PROVINCES: Record<string, string> = {
  alberta: 'AB', britishcolumbia: 'BC', manitoba: 'MB', newbrunswick: 'NB',
  newfoundland: 'NL', newfoundlandandlabrador: 'NL', novascotia: 'NS',
  northwestterritories: 'NT', nunavut: 'NU', ontario: 'ON',
  princeedwardisland: 'PE', quebec: 'QC', saskatchewan: 'SK', yukon: 'YT',
}

/** Misspellings observed in the real export, mapped to their correct key. */
const STATE_TYPOS: Record<string, string> = {
  calfornia: 'california',
  ilinois: 'illinois',
  illionios: 'illinois',
  wisonsin: 'wisconsin',
  tennesse: 'tennessee',
  missourri: 'missouri',
  massachussets: 'massachusetts',
  massachussetts: 'massachusetts',
  northcarloina: 'northcarolina',
}

const VALID_CODES = new Set([
  ...Object.values(US_STATES),
  ...Object.values(CA_PROVINCES),
])

/**
 * Fold a raw state value to a two-letter US state or Canadian province code.
 *
 * Returns null for anything else — "International", "INT", bare country names
 * that landed in the state column (Germany, Brazil), and city names (Toronto,
 * Albany). Those keep their raw value on the contact but get no location tag.
 */
export function normaliseState(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null

  const token = normaliseToken(raw)
  if (!token) return null

  // Already a valid code (the common case — "CA", "TX", "ON").
  const upper = raw.trim().toUpperCase()
  if (upper.length === 2 && VALID_CODES.has(upper)) return upper

  const corrected = STATE_TYPOS[token] ?? token
  return US_STATES[corrected] ?? CA_PROVINCES[corrected] ?? null
}

const US_CODES = new Set(Object.values(US_STATES))
const CA_CODES = new Set(Object.values(CA_PROVINCES))

/**
 * Infer the country a state or province belongs to.
 *
 * The historic data records a state far more often than a country — 31,182
 * contacts have a state against 2,089 with a country — and a recognised US
 * state or Canadian province settles the country on its own. Only ever used to
 * fill a blank country, never to overwrite one the contact actually gave.
 *
 * Takes an already-normalised two-letter code from normaliseState().
 */
export function countryFromState(stateCode: string | null | undefined): string | null {
  if (!stateCode) return null
  const code = stateCode.trim().toUpperCase()
  if (US_CODES.has(code)) return 'United States'
  if (CA_CODES.has(code)) return 'Canada'
  return null
}

// ---- Countries -------------------------------------------------------------

/**
 * Country spellings and ISO codes seen in the export, folded to one label each.
 * Deliberately excludes ambiguous two-letter codes that collide with US states
 * ("CA" is far more likely California than Canada in this dataset, "GA" Georgia
 * the state than Georgia the country) — those return null rather than guess.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  us: 'United States', usa: 'United States', unitedstates: 'United States',
  unitedstatesofamerica: 'United States', america: 'United States',
  uk: 'United Kingdom', gb: 'United Kingdom', greatbritain: 'United Kingdom',
  unitedkingdom: 'United Kingdom', england: 'United Kingdom',
  scotland: 'United Kingdom', wales: 'United Kingdom',
  northernireland: 'United Kingdom',
  canada: 'Canada',
  uae: 'United Arab Emirates', unitedarabemirates: 'United Arab Emirates',
  haitian: 'Haiti',
  thebahamas: 'Bahamas',
  trinidadandtobago: 'Trinidad and Tobago',
  southkorea: 'South Korea', northkorea: 'North Korea',
  newzealand: 'New Zealand',
  dominicanrepublic: 'Dominican Republic',
  elsalvador: 'El Salvador',
  southafrica: 'South Africa',
  ivorycoast: 'Ivory Coast', cotedivoire: 'Ivory Coast',
}

/** Two-letter ISO codes that are unambiguous in this dataset. */
const COUNTRY_CODES: Record<string, string> = {
  MX: 'Mexico', JM: 'Jamaica', IT: 'Italy', HN: 'Honduras',
  BJ: 'Benin', BN: 'Brunei', NG: 'Nigeria', KE: 'Kenya',
}

/**
 * Fold a raw country value to a canonical country name.
 * Returns null when the value is unrecognised or ambiguous.
 */
export function normaliseCountry(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null

  const trimmed = raw.trim()
  const upper = trimmed.toUpperCase()
  if (upper.length === 2 && COUNTRY_CODES[upper]) return COUNTRY_CODES[upper]

  const token = normaliseToken(trimmed)
  if (!token) return null
  if (COUNTRY_ALIASES[token]) return COUNTRY_ALIASES[token]

  // Unknown but plausible: title-case a multi-letter name so "nigeria" and
  // "Nigeria" converge on one tag. Two-letter leftovers are too ambiguous.
  if (trimmed.length <= 2) return null
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ---- Deriving gender / year from the target list ---------------------------

export interface ListDerivation {
  gender: 'male' | 'female' | null
  graduationYear: number | null
  tags: { name: string; category: string }[]
}

/**
 * Read the meaning out of a target list name.
 *
 * The historic exports are one file per list ("ALL BOYS", "MENS 2027"), and the
 * list a file is imported into is therefore the strongest gender/year signal in
 * the dataset — far better than the Gender column, which is populated on only
 * 3.4% of rows. Recognises both orderings ("2027 MENS" and "MENS 2027") and the
 * BOYS/GIRLS wording used in the source files.
 *
 * Naming follows lib/forms/lead-routing.ts: ALL MENS / ALL WOMENS / 2027 MENS.
 */
export function deriveFromListName(listName: string | null | undefined): ListDerivation {
  const empty: ListDerivation = { gender: null, graduationYear: null, tags: [] }
  if (!listName?.trim()) return empty

  const upper = listName.toUpperCase()

  // WOMENS must be tested first — "MENS" is a substring of "WOMENS".
  const isWomens = /\b(WOMENS?|WOMEN'S|GIRLS?)\b/.test(upper)
  const isMens = !isWomens && /\b(MENS?|MEN'S|BOYS?)\b/.test(upper)

  const gender = isWomens ? 'female' : isMens ? 'male' : null

  const yearMatch = upper.match(/\b(19|20)\d{2}\b/)
  const year = yearMatch ? parseInt(yearMatch[0], 10) : null
  const graduationYear = year && year >= 1950 && year <= 2040 ? year : null

  const tags: { name: string; category: string }[] = []
  if (gender) tags.push({ name: gender === 'male' ? 'Mens' : 'Womens', category: 'gender' })
  if (graduationYear) tags.push({ name: String(graduationYear), category: 'year' })

  return { gender, graduationYear, tags }
}

// ---- Resolving conflicting signals -----------------------------------------

/**
 * Decide the value a single-valued field should hold when an import supplies a
 * signal for a contact that may already have one.
 *
 * A contact can legitimately sit in several lists at once (the client confirmed
 * that contacts in both ALL MENS and ALL WOMENS belong in both, and roughly
 * 1,983 of them do). Lists and tags record that faithfully, but `gender` and
 * `graduation_year` are single-valued columns, so when two imports disagree the
 * honest answer is "unknown" rather than whichever ran last.
 *
 *   explicit  — the value came from the row's own Gender / Graduation Year cell
 *   derived   — the value was inferred from the target list name
 *
 * Explicit always beats derived. Two disagreeing derived values cancel to null.
 */
export function resolveFieldConflict<T extends string | number>(
  current: { value: T | null; explicit: boolean },
  incoming: { value: T | null; explicit: boolean }
): { value: T | null; explicit: boolean } {
  if (incoming.value === null) return current
  if (current.value === null) return incoming

  // Self-reported data wins over anything inferred from list membership.
  if (current.explicit && !incoming.explicit) return current
  if (incoming.explicit && !current.explicit) return incoming

  if (current.value === incoming.value) return current

  // Same confidence, different answers — record neither.
  return { value: null, explicit: current.explicit }
}
