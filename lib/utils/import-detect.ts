/**
 * Import routing detection.
 *
 * Works out, before a single row is written, which lists and tags a CSV is
 * about to produce — so the importer can show it and the operator can change
 * their mind. Pure and synchronous: a 10k-row file is only string work.
 *
 * CRITICAL: every value here is derived with the SAME functions the server
 * uses in app/api/contacts/bulk-import/route.ts (buildContactFromRow,
 * normalisePositions, normaliseState, normaliseCountry, countryFromState,
 * cohortListNames). A second, lookalike implementation would make this a
 * preview of something that never happens — the worst kind of wrong, because
 * it looks like confirmation. scripts/verify-import-detect.mjs asserts the two
 * agree.
 */

import { buildContactFromRow, extractTagsFromRow, type DateOrder } from '@/lib/utils/csv'
import {
  normalisePositions,
  normaliseState,
  normaliseCountry,
  countryFromState,
} from '@/lib/utils/import-normalise'
import { cohortListNames, genderTagName } from '@/lib/forms/lead-routing'

/** Tag buckets the operator can switch on and off as a group. */
export const TAG_CATEGORIES = ['gender', 'year', 'position', 'location', 'other'] as const
export type TagCategory = (typeof TAG_CATEGORIES)[number]

export const TAG_CATEGORY_LABEL: Record<TagCategory, string> = {
  gender: 'Gender',
  year: 'Graduation year',
  position: 'Position',
  location: 'State & country',
  other: 'From the Tags column',
}

/** One detected value and how many rows produced it. */
export interface DetectedValue {
  name: string
  count: number
}

export interface DetectedGroup<T extends string> {
  category: T
  values: DetectedValue[]
  /** Rows that produced at least one value in this group. */
  rows: number
}

export interface Detection {
  /** Cohort lists (ALL MENS / 2027 MENS) implied by gender + graduation year. */
  cohortLists: DetectedValue[]
  /** Auto-tags, bucketed by category. */
  tags: DetectedGroup<TagCategory>[]
  /** Rows with a usable gender, and with a usable graduation year. */
  genderRows: number
  yearRows: number
  totalRows: number
  /** Rows the server will reject for having no email — excluded from every count. */
  skippedRows: number
}

function tally(map: Map<string, number>, name: string | null | undefined) {
  const key = name?.trim()
  if (!key) return
  map.set(key, (map.get(key) ?? 0) + 1)
}

function toValues(map: Map<string, number>): DetectedValue[] {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/**
 * Scan the parsed rows and report what the import would create.
 *
 * `fallback` carries the gender / graduation year implied by the lists the
 * operator picked for the whole file. It mirrors the server, which leans on the
 * list name when the row itself is silent — in the historic ActiveCampaign
 * data the Gender column was populated on only 3.4% of rows, so without this
 * the preview would claim almost nothing is detectable.
 */
export function detectRouting(
  rows: string[][],
  mapping: Record<number, string>,
  dateOrder: DateOrder = 'DMY',
  fallback: { gender?: 'male' | 'female' | null; graduationYear?: number | null } = {},
): Detection {
  const cohorts = new Map<string, number>()
  const byCategory: Record<TagCategory, Map<string, number>> = {
    gender: new Map(),
    year: new Map(),
    position: new Map(),
    location: new Map(),
    other: new Map(),
  }
  const rowsWith: Record<TagCategory, number> = {
    gender: 0, year: 0, position: 0, location: 0, other: 0,
  }
  let genderRows = 0
  let yearRows = 0

  let skipped = 0

  for (const row of rows) {
    const contact = buildContactFromRow(row, mapping, dateOrder)

    // The server drops rows with no email before it collects any tags, so a
    // preview that counted them would over-report every group.
    if (!(contact.email as string | undefined)?.trim()) {
      skipped++
      continue
    }

    // Mirror the server exactly: fill the country from the state FIRST, then
    // normalise whatever is now on the record. Normalising the state-implied
    // country separately would be a second code path to keep in step.
    if (!contact.country) {
      const implied = countryFromState(normaliseState(contact.state as string | undefined))
      if (implied) contact.country = implied
    }

    const gender = (contact.gender as 'male' | 'female' | undefined) ?? fallback.gender ?? null
    const rawYear = contact.graduation_year as number | undefined
    const graduationYear = rawYear ?? fallback.graduationYear ?? null

    if (gender) genderRows++
    if (graduationYear) yearRows++

    // Cohort lists — the only thing here that becomes list membership.
    for (const name of cohortListNames(gender, graduationYear)) tally(cohorts, name)

    const genderTag = genderTagName(gender)
    if (genderTag) {
      tally(byCategory.gender, genderTag)
      rowsWith.gender++
    }

    if (graduationYear) {
      tally(byCategory.year, String(graduationYear))
      rowsWith.year++
    }

    const positions = normalisePositions(contact.position as string | undefined)
    if (positions.length) {
      for (const p of positions) tally(byCategory.position, p)
      rowsWith.position++
    }

    // State and country share the `location` category, matching the server.
    const state = normaliseState(contact.state as string | undefined)
    const country = normaliseCountry(contact.country as string | undefined)
    if (state) tally(byCategory.location, state)
    if (country) tally(byCategory.location, country)
    if (state || country) rowsWith.location++

    const fromColumn = extractTagsFromRow(row, mapping)
    if (fromColumn.length) {
      for (const t of fromColumn) tally(byCategory.other, t)
      rowsWith.other++
    }
  }

  return {
    cohortLists: toValues(cohorts),
    tags: TAG_CATEGORIES.map((category) => ({
      category,
      values: toValues(byCategory[category]),
      rows: rowsWith[category],
    })).filter((g) => g.values.length > 0),
    genderRows,
    yearRows,
    totalRows: rows.length - skipped,
    skippedRows: skipped,
  }
}
