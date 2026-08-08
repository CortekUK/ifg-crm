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
import {
  normalisePositions,
  normaliseState,
  normaliseCountry,
  countryFromState,
  deriveFromListName,
  resolveFieldConflict,
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
  listId: string | null
  /** Optional tag applied to every contact in the chunk, on top of derived tags. */
  tagId?: string | null
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
  fromList: TagRef[]
): TagRef[] {
  const tags: TagRef[] = []

  for (const name of extractTagsFromRow(row, mapping)) {
    tags.push({ name, category: 'other' })
  }

  for (const position of normalisePositions(contact.position as string | undefined)) {
    tags.push({ name: position, category: 'position' })
  }

  const state = normaliseState(contact.state as string | undefined)
  if (state) tags.push({ name: state, category: 'location' })

  const country = normaliseCountry(contact.country as string | undefined)
  if (country) tags.push({ name: country, category: 'location' })

  tags.push(...fromList)

  // De-duplicate case-insensitively, keeping the first category seen.
  const seen = new Set<string>()
  return tags.filter((t) => {
    const key = t.name.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
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
      listId,
      tagId = null,
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

    // 2. Resolve the target list and the master "everyone" list.
    let targetListName: string | null = null
    if (listId) {
      const { data: list } = await admin.from('lists').select('name').eq('id', listId).maybeSingle()
      targetListName = list?.name ?? null
    }

    const { data: everyoneList } = await admin
      .from('lists')
      .select('id')
      .ilike('name', '%all contacts%everyone%')
      .limit(1)
      .maybeSingle()

    // The list a file is imported into is the strongest gender/year signal in
    // this dataset — the Gender column is populated on only 3.4% of rows.
    const listDerived = deriveFromListName(targetListName)

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

      const record: Record<string, unknown> = {
        ...contact,
        ...(customFields ? { custom_fields: customFields } : {}),
        ...(createdAt ? { created_at: createdAt } : {}),
        source: 'csv_import',
        sport: 'football',
      }

      byEmail.set(email, {
        record,
        tags: collectTags(row, mapping, contact, listDerived.tags),
        row: rowNumber,
      })
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
    let skipped = 0

    for (const [email, entry] of byEmail) {
      const existing = existingByEmail.get(email)

      // "Skip duplicates": leave the stored record untouched, but still apply
      // this file's list and tag memberships — that's the whole point of
      // importing the per-list exports on top of the master file.
      if (existing && duplicateStrategy === 'skip') {
        skipped++
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

      // Pad to the full column set so every record in the batch has identical
      // keys. Without this, a column supplied by one row and omitted by another
      // is written as NULL for the second — silently blanking data the incoming
      // row never intended to touch. Existing contacts fall back to their stored
      // value, new ones to null.
      const padded: Record<string, unknown> = {}
      for (const column of CONTACT_COLUMNS) {
        padded[column] = column in record
          ? record[column]
          : existing
            ? existing[column] ?? null
            : null
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

    // 7. List memberships — the chosen list plus the master everyone list.
    const listIds = [listId, everyoneList?.id].filter(Boolean) as string[]
    if (listIds.length > 0 && allIds.length > 0) {
      const memberships = listIds.flatMap((lid) =>
        allIds.map((c) => ({ list_id: lid, contact_id: c.id }))
      )
      const { error: listErr } = await admin
        .from('contact_lists')
        .upsert(memberships, { onConflict: 'contact_id,list_id', ignoreDuplicates: true })

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
