// POST /api/contacts/bulk-import
//
// Batched server-side contact import. The browser-side importer in
// lib/hooks/useImportContacts.ts issued one HTTP round trip per row, which is
// fine for a few hundred contacts but not for the 105,463-row historic
// ActiveCampaign migration. This route takes a chunk of rows and lands them in
// a handful of queries: one contact upsert, one list membership upsert, one tag
// resolution pass, one contact_tags upsert.
//
// Admin / super_admin only — it writes with the service-role key, which
// bypasses the RLS policies from migration 099/102, so the guard here IS the
// access control.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import {
  buildContactFromRow,
  buildCustomFields,
  extractTagsFromRow,
  type DateOrder,
} from '@/lib/utils/csv'
import { cohortListNames, genderTagName } from '@/lib/forms/lead-routing'
import {
  normalisePositions,
  normaliseState,
  normaliseCountry,
  countryFromState,
  deriveFromListName,
  resolveFieldConflict,
  type ListDerivation,
} from '@/lib/utils/import-normalise'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface BulkImportBody {
  rows: string[][]
  mapping: Record<number, string>
  headers: string[]
  skippedColumns?: number[]
  /** Lists every contact in the file joins, chosen by the operator. */
  listIds?: string[]
  /** Optional tag applied to every contact in the chunk, on top of derived tags. */
  tagId?: string | null
  /**
   * The operator's routing decisions, made against the preview in the import
   * dialog. Absent means "behave as the importer always did": no cohort lists,
   * every auto-tag category on.
   */
  routing?: {
    /**
     * Detected cohort list name -> the list name to actually use. A rename or a
     * remap is just a different value; a group the operator switched off is
     * simply absent, so there is no separate "enabled" flag to keep in sync
     * with the keys.
     */
    cohortLists?: Record<string, string>
    /** Auto-tag categories to apply. Omitted = all of them. */
    tagCategories?: string[]
  }
  duplicateStrategy: 'skip' | 'update'
  /**
   * Day-first or month-first, detected from the whole file by the client.
   * Exports differ: IFG's master file is day-first, the per-list ones are
   * month-first. Defaults to day-first to match the previous behaviour.
   */
  dateOrder?: DateOrder
  /** Row number of rows[0] in the original file, so error rows are reported accurately. */
  rowOffset?: number
}

interface TagRef {
  name: string
  category: string
}

/** Marks a contact whose email address belongs to their parent. */
const PARENT_EMAIL_TAG = 'Parent Email'

/** Hard ceiling per request — keeps each call inside maxDuration. */
const MAX_ROWS_PER_REQUEST = 1000

/**
 * Values per `.in(...)` filter.
 *
 * PostgREST receives `.in()` as a GET query string, so the whole list has to fit
 * in the request URL. At 500 emails the encoded filter reaches ~22 KB and the
 * server rejects it — which undici surfaces only as "TypeError: fetch failed",
 * with nothing to say it was a size problem. 100 keeps the filter near 4 KB
 * whatever the chunk size, at the cost of a few extra round trips.
 */
const IN_FILTER_BATCH = 100

/**
 * Every contact column this import may write.
 *
 * A batch upsert is sent as one INSERT whose column list is the union of keys
 * across the records, and any record missing a key gets NULL — so a row with no
 * position would blank the position of a contact that already had one, purely
 * because a different row in the same chunk supplied it. Every record is
 * therefore padded to this exact shape before being sent: existing contacts
 * fall back to their stored value, new ones to null.
 */
const CONTACT_COLUMNS = [
  'email', 'first_name', 'last_name', 'phone', 'date_of_birth', 'graduation_year',
  'gender', 'country', 'state', 'city', 'club_name', 'position', 'gpa',
  'parent_name', 'parent_email', 'parent_phone', 'source_detail',
  'subscription_status', 'notes', 'football_background', 'academic_background',
  'degree_choice', 'football_highlights', 'preferred_programme', 'job_title',
  'custom_fields', 'source', 'sport', 'created_at',
] as const

/**
 * Columns the database refuses to hold NULL, and what to write instead when a
 * new contact's row didn't supply one.
 *
 * The padding below gives every record in a batch an identical key set, which
 * it has to: a key present on one record and absent from another is written as
 * NULL for the second. But padding a NOT NULL column with null is worse than
 * the problem — it writes over the column default and Postgres rejects the
 * whole chunk, taking the other 499 rows with it.
 *
 * Two ways to hit this, both silent until they aren't:
 *   - a CSV with no "Subscription Status" column (subscription_status is
 *     NOT NULL DEFAULT 'subscribed'),
 *   - a CSV with no "Date Created" column (created_at is NOT NULL DEFAULT now()),
 *   - a row with a first name but no last name, which validateRow allows.
 *
 * The historic ActiveCampaign export happened to carry all of those columns,
 * so the 105k migration never tripped it. A plainer file — name, email,
 * gender, year, state — fails on the first chunk.
 *
 * A function is evaluated per record, for defaults like now() that can't be a
 * constant.
 */
const NOT_NULL_FALLBACKS: Record<string, unknown | (() => unknown)> = {
  first_name: '',
  last_name: '',
  subscription_status: 'subscribed',
  sport: 'football',
  created_at: () => new Date().toISOString(),
}

/**
 * Run a `.in()` select in URL-safe batches and concatenate the rows.
 * Returns an error the moment one batch fails, so callers can't mistake a
 * partial read for a complete one.
 */
async function selectIn<T>(
  runBatch: (values: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  values: string[]
): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = []

  for (let i = 0; i < values.length; i += IN_FILTER_BATCH) {
    const { data, error } = await runBatch(values.slice(i, i + IN_FILTER_BATCH))
    if (error) return { data: out, error }
    if (data) out.push(...data)
  }

  return { data: out, error: null }
}

// ---- Helpers ---------------------------------------------------------------

/**
 * Find the column holding the record's original creation date and parse it.
 *
 * The historic exports carry real signup dates going back to 2023. Without this
 * every migrated contact would show as created today and "newest first" sorting
 * would be meaningless. Handles "24/01/2023 12:28" (the ActiveCampaign format,
 * day first) and ISO.
 */
function findCreatedAtColumn(headers: string[]): number | null {
  const re = /^(date created|created at|created_at|date added|signup date|date subscribed)$/i
  const idx = headers.findIndex((h) => re.test(h.replace(/^\*+/, '').trim()))
  return idx === -1 ? null : idx
}

function parseCreatedAt(value: string | undefined, order: DateOrder = 'DMY'): string | null {
  if (!value?.trim()) return null
  const raw = value.trim()

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const iso = new Date(raw)
    return isNaN(iso.getTime()) ? null : iso.toISOString()
  }

  // Numeric date with an optional HH:MM tail, in either component order.
  const m = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (!m) return null

  const [, a, b, y, hh, mm] = m
  const first = parseInt(a, 10)
  const second = parseInt(b, 10)

  let day: number
  let month: number

  if (first > 12) {
    day = first
    month = second
  } else if (second > 12) {
    month = first
    day = second
  } else if (order === 'MDY') {
    month = first
    day = second
  } else {
    day = first
    month = second
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const dt = new Date(Date.UTC(
    parseInt(y, 10),
    month - 1,
    day,
    hh ? parseInt(hh, 10) : 0,
    mm ? parseInt(mm, 10) : 0
  ))
  return isNaN(dt.getTime()) ? null : dt.toISOString()
}

/**
 * Every tag a contact earns from one row: the CSV's own Tags column plus the
 * tags derived from their position, state, country, and the list being imported
 * into. Categories match lib/forms/lead-routing.ts so imported contacts and
 * live website leads share one vocabulary.
 */
function collectTags(
  row: string[],
  mapping: Record<number, string>,
  contact: Record<string, unknown>,
  fromList: TagRef[],
  allowed: Set<string> | null
): TagRef[] {
  const tags: TagRef[] = []

  for (const name of extractTagsFromRow(row, mapping)) {
    tags.push({ name, category: 'other' })
  }

  // Gender and graduation year, from the row's own data. Previously these only
  // ever arrived via `fromList` (derived from the chosen list's NAME), so a
  // file with a real Gender column produced no gender tag at all.
  const genderTag = genderTagName(contact.gender as 'male' | 'female' | undefined)
  if (genderTag) tags.push({ name: genderTag, category: 'gender' })
  if (contact.graduation_year) {
    tags.push({ name: String(contact.graduation_year), category: 'year' })
  }

  for (const position of normalisePositions(contact.position as string | undefined)) {
    tags.push({ name: position, category: 'position' })
  }

  const state = normaliseState(contact.state as string | undefined)
  if (state) tags.push({ name: state, category: 'location' })

  const country = normaliseCountry(contact.country as string | undefined)
  if (country) tags.push({ name: country, category: 'location' })

  tags.push(...fromList)

  // De-duplicate case-insensitively, keeping the first category seen, and drop
  // any category the operator switched off in the preview.
  const seen = new Set<string>()
  return tags.filter((t) => {
    const key = t.name.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return allowed === null || allowed.has(t.category)
  })
}

// ---- Route -----------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Auth — admin / super_admin only.
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = (await request.json()) as BulkImportBody
    const {
      rows,
      mapping,
      headers,
      skippedColumns = [],
      listIds = [],
      tagId = null,
      routing,
      duplicateStrategy,
      dateOrder = 'DMY',
      rowOffset = 0,
    } = body

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'rows must be a non-empty array' }, { status: 400 })
    }
    if (rows.length > MAX_ROWS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many rows in one request (max ${MAX_ROWS_PER_REQUEST})` },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()
    const errors: { row: number; message: string }[] = []

    // 2. Resolve the chosen lists and the master "everyone" list.
    const chosenListIds = listIds.filter((id): id is string => typeof id === 'string' && !!id)
    let chosenListNames: string[] = []
    if (chosenListIds.length > 0) {
      const { data: chosen } = await admin.from('lists').select('name').in('id', chosenListIds)
      chosenListNames = (chosen ?? []).map((l) => l.name as string)
    }

    const { data: everyoneList } = await admin
      .from('lists')
      .select('id')
      .ilike('name', '%all contacts%everyone%')
      .limit(1)
      .maybeSingle()

    // The list a file is imported into is the strongest gender/year signal in
    // this dataset — the Gender column is populated on only 3.4% of rows.
    //
    // With several lists selected the signals can disagree (ALL MENS and
    // ALL WOMENS together, say). resolveFieldConflict's rule applies: two
    // lists that contradict each other mean "unknown", not whichever sorted
    // first. A single unambiguous signal is still used.
    const derivations = chosenListNames.map(deriveFromListName)
    const genders = new Set(derivations.map((d) => d.gender).filter(Boolean))
    const years = new Set(derivations.map((d) => d.graduationYear).filter(Boolean))
    const listDerived: ListDerivation = {
      gender: genders.size === 1 ? [...genders][0]! : null,
      graduationYear: years.size === 1 ? [...years][0]! : null,
      tags: [],
    }
    if (listDerived.gender) {
      listDerived.tags.push({
        name: listDerived.gender === 'male' ? 'Mens' : 'Womens',
        category: 'gender',
      })
    }
    if (listDerived.graduationYear) {
      listDerived.tags.push({ name: String(listDerived.graduationYear), category: 'year' })
    }

    // The operator's decisions from the preview. Absent = legacy behaviour:
    // no cohort lists, every auto-tag category on.
    const cohortMap = routing?.cohortLists ?? null
    const allowedTagCategories = routing?.tagCategories
      ? new Set(routing.tagCategories)
      : null

    // 3. Build records, de-duplicating by email within the chunk.
    // Postgres rejects an ON CONFLICT upsert that touches the same key twice,
    // so a repeated email in one chunk must collapse to a single record.
    const createdAtCol = findCreatedAtColumn(headers)
    const byEmail = new Map<string, { record: Record<string, unknown>; tags: TagRef[]; row: number }>()

    rows.forEach((row, i) => {
      const rowNumber = rowOffset + i + 1
      const contact = buildContactFromRow(row, mapping, dateOrder)
      const email = (contact.email as string | undefined)?.trim().toLowerCase()

      if (!email) {
        errors.push({ row: rowNumber, message: 'Missing email' })
        return
      }
      contact.email = email

      // A recognised US state or Canadian province tells us the country, which
      // the source records far less often than the state. Fill only, never
      // overwrite what the contact actually gave.
      if (!contact.country) {
        const implied = countryFromState(normaliseState(contact.state as string | undefined))
        if (implied) contact.country = implied
      }

      const customFields = buildCustomFields(row, headers, mapping, skippedColumns)
      const createdAt = createdAtCol !== null ? parseCreatedAt(row[createdAtCol], dateOrder) : null

      // An email that IS the parent's email reaches a parent, not the player —
      // whether the importer filled it in from the Parent Email column or the
      // file already held it that way. Derived from the data rather than a
      // client flag, so it stays true however the row arrived. Recorded on the
      // contact and as a tag, so campaigns written in the player's voice can
      // exclude them.
      const reachesParent =
        typeof contact.parent_email === 'string' &&
        contact.parent_email.trim().toLowerCase() === email

      const record: Record<string, unknown> = {
        ...contact,
        ...(customFields || reachesParent
          ? {
              custom_fields: {
                ...(customFields ?? {}),
                ...(reachesParent ? { email_source: 'parent' } : {}),
              },
            }
          : {}),
        ...(createdAt ? { created_at: createdAt } : {}),
        source: 'csv_import',
        sport: 'football',
      }

      const tags = collectTags(row, mapping, contact, listDerived.tags, allowedTagCategories)
      // Governed by the parent-email checkbox, not by the auto-tag categories,
      // so switching off e.g. "From the Tags column" can't silently drop it.
      if (reachesParent && !tags.some((t) => t.name.toLowerCase() === PARENT_EMAIL_TAG.toLowerCase())) {
        tags.push({ name: PARENT_EMAIL_TAG, category: 'source' })
      }

      byEmail.set(email, { record, tags, row: rowNumber })
    })

    const emails = [...byEmail.keys()]
    if (emails.length === 0) {
      return NextResponse.json({ created: 0, updated: 0, skipped: 0, errors })
    }

    // 4. Read existing contacts so we can merge rather than clobber.
    // Read every writable column, not just the ones we reason about: the merge
    // below pads each record to the full column set, and the stored value is
    // what a column must fall back to so an update never blanks a field the
    // incoming row simply didn't mention.
    const { data: existingRows, error: existingErr } = await selectIn<
      Record<string, unknown> & { id: string; email: string }
    >(
      // The column list is built from CONTACT_COLUMNS so the two can't drift.
      // supabase-js infers row types from a literal select string and can't
      // parse a computed one, hence the cast — the shape is asserted above.
      (batch) => admin
        .from('contacts')
        .select(`id, ${CONTACT_COLUMNS.join(', ')}`)
        .in('email', batch) as unknown as PromiseLike<{
          data: (Record<string, unknown> & { id: string; email: string })[] | null
          error: { message: string } | null
        }>,
      emails
    )

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 })
    }

    const existingByEmail = new Map(
      (existingRows ?? []).map((c) => [(c.email as string).toLowerCase(), c])
    )

    // 5. Merge each record against what's already stored.
    const toUpsert: Record<string, unknown>[] = []
    // Cohort lists (ALL MENS / 2027 MENS) per contact. Derived from the SETTLED
    // gender and year below, not the raw cell: a row whose gender conflicts
    // with the stored value resolves to null, and that contact should join no
    // cohort rather than one the merge just decided it can't stand behind.
    const cohortByEmail = new Map<string, string[]>()
    let skipped = 0

    for (const [email, entry] of byEmail) {
      const existing = existingByEmail.get(email)

      // "Skip duplicates": leave the stored record untouched, but still apply
      // this file's list and tag memberships — that's the whole point of
      // importing the per-list exports on top of the master file.
      if (existing && duplicateStrategy === 'skip') {
        skipped++
        cohortByEmail.set(
          email,
          cohortListNames(
            existing.gender as 'male' | 'female' | null,
            existing.graduation_year as number | null
          )
        )
        continue
      }

      const record = { ...entry.record }

      if (existing) {
        // Keep the stored creation date. It must be set explicitly rather than
        // omitted: a key missing from one record in a batch upsert becomes NULL,
        // and created_at is NOT NULL.
        record.created_at = existing.created_at

        const existingCustom = (existing.custom_fields ?? {}) as Record<string, unknown>
        const incomingCustom = (record.custom_fields ?? {}) as Record<string, unknown>
        record.custom_fields = { ...existingCustom, ...incomingCustom }

        // gender / graduation_year are single-valued, but a contact can sit in
        // contradictory lists (1,983 are in both ALL MENS and ALL WOMENS). A
        // value the contact stated themselves beats one inferred from a list;
        // two inferred values that disagree cancel to null rather than letting
        // whichever file ran last decide.
        const existingSource = existingCustom as Record<string, string | undefined>

        const gender = resolveFieldConflict<string>(
          { value: (existing.gender as string) ?? null, explicit: existingSource.gender_source === 'column' },
          record.gender
            ? { value: record.gender as string, explicit: true }
            : { value: listDerived.gender, explicit: false }
        )
        record.gender = gender.value
        const withGender = { ...(record.custom_fields as Record<string, unknown>) }
        if (gender.value) withGender.gender_source = gender.explicit ? 'column' : 'list'
        else delete withGender.gender_source // conflict cleared the value; don't leave a stale source
        record.custom_fields = withGender

        const year = resolveFieldConflict<number>(
          {
            value: (existing.graduation_year as number) ?? null,
            explicit: existingSource.graduation_year_source === 'column',
          },
          record.graduation_year
            ? { value: record.graduation_year as number, explicit: true }
            : { value: listDerived.graduationYear, explicit: false }
        )
        record.graduation_year = year.value
        const withYear = { ...(record.custom_fields as Record<string, unknown>) }
        if (year.value) withYear.graduation_year_source = year.explicit ? 'column' : 'list'
        else delete withYear.graduation_year_source
        record.custom_fields = withYear
      } else {
        // New contact — take the row's own value, else the list's.
        const genderExplicit = Boolean(record.gender)
        if (!record.gender && listDerived.gender) record.gender = listDerived.gender

        const yearExplicit = Boolean(record.graduation_year)
        if (!record.graduation_year && listDerived.graduationYear) {
          record.graduation_year = listDerived.graduationYear
        }

        record.custom_fields = {
          ...((record.custom_fields ?? {}) as Record<string, unknown>),
          ...(record.gender ? { gender_source: genderExplicit ? 'column' : 'list' } : {}),
          ...(record.graduation_year
            ? { graduation_year_source: yearExplicit ? 'column' : 'list' }
            : {}),
        }
      }

      cohortByEmail.set(
        email,
        cohortListNames(
          record.gender as 'male' | 'female' | null,
          record.graduation_year as number | null
        )
      )

      // Pad to the full column set so every record in the batch has identical
      // keys. Without this, a column supplied by one row and omitted by another
      // is written as NULL for the second — silently blanking data the incoming
      // row never intended to touch. Existing contacts fall back to their stored
      // value, new ones to null.
      const padded: Record<string, unknown> = {}
      for (const column of CONTACT_COLUMNS) {
        const value = column in record
          ? record[column]
          : existing
            ? existing[column] ?? null
            : null
        if (value !== null && value !== undefined) {
          padded[column] = value
        } else {
          const fallback = NOT_NULL_FALLBACKS[column]
          padded[column] = typeof fallback === 'function' ? fallback() : (fallback ?? null)
        }
      }

      toUpsert.push(padded)
    }

    // 6. One upsert for the whole chunk.
    let contactIds: { id: string; email: string }[] = []

    if (toUpsert.length > 0) {
      const { data: upserted, error: upsertErr } = await admin
        .from('contacts')
        .upsert(toUpsert, { onConflict: 'email' })
        .select('id, email')

      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 })
      }
      contactIds = (upserted ?? []) as { id: string; email: string }[]
    }

    // Contacts skipped as duplicates still need their list/tag memberships.
    const skippedIds = duplicateStrategy === 'skip'
      ? (existingRows ?? [])
          .filter((c) => byEmail.has((c.email as string).toLowerCase()))
          .map((c) => ({ id: c.id as string, email: c.email as string }))
      : []

    const allIds = [...contactIds, ...skippedIds]
    const idByEmail = new Map(allIds.map((c) => [c.email.toLowerCase(), c.id]))

    const created = contactIds.filter((c) => !existingByEmail.has(c.email.toLowerCase())).length
    const updated = contactIds.length - created

    // 7. List memberships.
    //
    //   a) the lists the operator chose, applied to every row,
    //   b) the master "everyone" list,
    //   c) per-contact cohort lists (ALL MENS / 2027 MENS) from their own data.
    //
    // All three go into one upsert. (c) is the new part: previously gender and
    // year only ever reached the contact RECORD, so a file full of 2027 boys
    // updated 8,769 contacts without one of them joining "2027 MENS".
    const membershipListIds = [...chosenListIds, everyoneList?.id].filter(Boolean) as string[]
    const memberships: { list_id: string; contact_id: string }[] = []

    for (const lid of membershipListIds) {
      for (const c of allIds) memberships.push({ list_id: lid, contact_id: c.id })
    }

    if (cohortMap && cohortByEmail.size > 0) {
      // Map detected name -> the name the operator settled on, then resolve
      // that to an id. A cohort the operator switched off is absent from the
      // map and silently produces no membership.
      const wantedNames = new Set<string>()
      for (const names of cohortByEmail.values()) {
        for (const n of names) {
          const target = cohortMap[n]
          if (target) wantedNames.add(target)
        }
      }

      const cohortIdByName = new Map<string, string>()
      if (wantedNames.size > 0) {
        const { data: found } = await selectIn<{ id: string; name: string }>(
          (batch) => admin.from('lists').select('id, name').in('name', batch),
          [...wantedNames]
        )
        for (const l of found) cohortIdByName.set(l.name.toLowerCase(), l.id)

        const missing = [...wantedNames].filter((n) => !cohortIdByName.has(n.toLowerCase()))
        if (missing.length > 0) {
          const { data: createdLists, error: createErr } = await admin
            .from('lists')
            .insert(
              missing.map((name) => ({
                name,
                description: 'Created automatically by a CSV import',
                sport: 'football',
                is_dynamic: false,
              }))
            )
            .select('id, name')

          if (createErr) {
            // A concurrent chunk almost certainly created them first — re-read
            // rather than failing the import over a race we expect to lose.
            const { data: refetched } = await selectIn<{ id: string; name: string }>(
              (batch) => admin.from('lists').select('id, name').in('name', batch),
              missing
            )
            for (const l of refetched) cohortIdByName.set(l.name.toLowerCase(), l.id)
          } else {
            for (const l of createdLists ?? []) {
              cohortIdByName.set((l.name as string).toLowerCase(), l.id as string)
            }
          }
        }
      }

      for (const [email, names] of cohortByEmail) {
        const contactId = idByEmail.get(email)
        if (!contactId) continue
        for (const n of names) {
          const target = cohortMap[n]
          if (!target) continue
          const lid = cohortIdByName.get(target.toLowerCase())
          if (lid) memberships.push({ list_id: lid, contact_id: contactId })
        }
      }
    }

    // Postgres rejects an ON CONFLICT upsert that touches the same key twice,
    // and the three sources above overlap by design: pick "ALL MENS" as a
    // whole-file list and every male row also derives it as a cohort.
    const seenMembership = new Set<string>()
    const uniqueMemberships = memberships.filter((m) => {
      const key = `${m.list_id}:${m.contact_id}`
      if (seenMembership.has(key)) return false
      seenMembership.add(key)
      return true
    })

    if (uniqueMemberships.length > 0) {
      const { error: listErr } = await admin
        .from('contact_lists')
        .upsert(uniqueMemberships, { onConflict: 'contact_id,list_id', ignoreDuplicates: true })

      if (listErr) errors.push({ row: rowOffset, message: `List membership: ${listErr.message}` })
    }

    // 8. Tags — resolve every name to an id (creating what's missing), then one
    //    upsert for all the associations.
    const wanted = new Map<string, TagRef>()
    for (const entry of byEmail.values()) {
      for (const tag of entry.tags) {
        const key = tag.name.trim().toLowerCase()
        if (key && !wanted.has(key)) wanted.set(key, { name: tag.name.trim(), category: tag.category })
      }
    }

    if (wanted.size > 0) {
      const { data: existingTags } = await selectIn<{ id: string; name: string }>(
        (batch) => admin.from('tags').select('id, name').in('name', batch),
        [...wanted.values()].map((t) => t.name)
      )

      const tagIdByName = new Map<string, string>()
      for (const t of existingTags) {
        tagIdByName.set(t.name.toLowerCase(), t.id)
      }

      const missing = [...wanted.values()].filter((t) => !tagIdByName.has(t.name.toLowerCase()))
      if (missing.length > 0) {
        const { data: newTags, error: tagErr } = await admin
          .from('tags')
          .insert(missing.map((t) => ({ name: t.name, color: '#6B7280', category: t.category })))
          .select('id, name')

        if (tagErr) {
          // A concurrent chunk may have created the same tag — re-read instead
          // of failing the import.
          const { data: refetched } = await selectIn<{ id: string; name: string }>(
            (batch) => admin.from('tags').select('id, name').in('name', batch),
            missing.map((t) => t.name)
          )
          for (const t of refetched) {
            tagIdByName.set(t.name.toLowerCase(), t.id)
          }
        } else {
          for (const t of newTags ?? []) {
            tagIdByName.set((t.name as string).toLowerCase(), t.id as string)
          }
        }
      }

      const associations: { contact_id: string; tag_id: string }[] = []
      for (const [email, entry] of byEmail) {
        const contactId = idByEmail.get(email)
        if (!contactId) continue
        for (const tag of entry.tags) {
          const tagId = tagIdByName.get(tag.name.trim().toLowerCase())
          if (tagId) associations.push({ contact_id: contactId, tag_id: tagId })
        }
      }

      if (associations.length > 0) {
        const { error: assocErr } = await admin
          .from('contact_tags')
          .upsert(associations, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true })

        if (assocErr) errors.push({ row: rowOffset, message: `Tags: ${assocErr.message}` })
      }
    }

    // 9. A single tag chosen for the whole import, applied on top of the rest.
    if (tagId && allIds.length > 0) {
      const { error: pinnedErr } = await admin
        .from('contact_tags')
        .upsert(
          allIds.map((c) => ({ contact_id: c.id, tag_id: tagId })),
          { onConflict: 'contact_id,tag_id', ignoreDuplicates: true }
        )

      if (pinnedErr) errors.push({ row: rowOffset, message: `Tag: ${pinnedErr.message}` })
    }

    return NextResponse.json({ created, updated, skipped, errors })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
