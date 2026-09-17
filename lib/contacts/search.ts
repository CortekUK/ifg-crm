import type { SupabaseClient } from '@supabase/supabase-js'
import type { UseContactsParams } from '@/lib/types/contacts'

/**
 * Contact search, ranked, via the `search_contacts_ranked` database function.
 *
 * There is deliberately ONE definition of what "matches" — in SQL — rather
 * than a PostgREST filter string here and an equivalent in the database.
 * The previous client-side version passed the whole typed string to every
 * column, so "Aila Head" asked whether anyone's FIRST NAME contained
 * "Aila Head" and found nobody: a full-name search, the most natural thing
 * to type, returned nothing while an exact email worked. Two copies of that
 * logic existed and both were wrong in the same way.
 *
 * The function returns ids only. Callers fetch the rows themselves, so the
 * column list and the tag-joining logic stay in one place and can't drift
 * out of step with a duplicate in SQL.
 */
/** PostgREST has URL length limits; chunk .in() lists to stay under them. */
export const IN_CHUNK_SIZE = 200

export interface RankedSearchArgs {
  search: string
  /** Pre-resolved pipeline / recruiter / tag filter, or null for no restriction. */
  contactIds: string[] | null
  filters?: UseContactsParams['filters']
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  limit: number
  offset: number
  /** Restrict to contacts carrying this tag (member search inside a tag). */
  tagId?: string | null
  /** Restrict to contacts on this list (member search inside a list). */
  listId?: string | null
}

/** Treat the sentinel 'all' and empty strings as "no filter". */
function orNull(value: string | undefined): string | null {
  if (!value || value === 'all') return null
  return value
}

export async function fetchRankedContactIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  args: RankedSearchArgs,
): Promise<{ ids: string[]; total: number }> {
  const f = args.filters ?? {}

  const { data, error } = await supabase.rpc('search_contacts_ranked', {
    p_search: args.search,
    p_ids: args.contactIds,
    p_subscription_status: orNull(f.subscription_status),
    p_graduation_year: f.graduation_year ?? null,
    p_gender: orNull(f.gender),
    p_country: orNull(f.country),
    p_position: orNull(f.position),
    p_owner_id: orNull(f.owner_id),
    p_state: orNull(f.state),
    p_phone_prefix: f.phone_prefix || null,
    p_sort_by: args.sortBy ?? null,
    p_sort_desc: args.sortOrder !== 'asc',
    p_limit: args.limit,
    p_offset: args.offset,
    p_tag_id: args.tagId ?? null,
    p_list_id: args.listId ?? null,
  })

  if (error) throw error

  const rows = (data ?? []) as { id: string; total_count: number }[]
  return {
    ids: rows.map((r) => r.id),
    // count(*) OVER () repeats the same total on every row; with no matches
    // there are no rows at all, hence the zero.
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
  }
}

/**
 * Re-order fetched rows to match the ranked id order. Supabase returns rows
 * in whatever order the planner produced, so the ranking would otherwise be
 * thrown away the moment we fetch the full records.
 */
export function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const position = new Map(ids.map((id, i) => [id, i]))
  return [...rows].sort(
    (a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
  )
}

// ---- Shared filtering ------------------------------------------------------
//
// The contact list, its select-all and its export each used to rebuild these
// filters by hand, and the copies drifted: the export silently ignored the
// subscription-status and owner filters the list applied, and every copy
// resolved a tag filter by fetching the tag's members — capped at 1000 rows —
// then putting every id into the request URL, which PostgREST rejects past a
// few hundred. Filtering by a 1,926-contact tag failed outright.

type AnyFilterBuilder = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eq(column: string, value: any): AnyFilterBuilder
  or(filters: string): AnyFilterBuilder
}

/**
 * Contacts a pipeline and/or recruiter filter restricts to, or null when
 * neither is set. An empty array means "the filter matches nobody".
 */
export async function resolveDealContactIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  filters: UseContactsParams['filters'] = {},
): Promise<string[] | null> {
  const pipelineId = orNull(filters.pipeline_id)
  const recruiterId = orNull(filters.recruiter_id)
  if (!pipelineId && !recruiterId) return null

  // ponytail: deals are unpaged and passed to .in('id') — fine while a
  // pipeline holds hundreds of deals, not tens of thousands. Page with
  // fetchAll and switch to a deals!inner embed if that ever changes.
  let q = supabase.from('deals').select('contact_id').not('contact_id', 'is', null)
  if (pipelineId) q = q.eq('pipeline_id', pipelineId)
  if (recruiterId) q = q.eq('deal_owner_id', recruiterId)
  const { data, error } = await q
  if (error) throw error
  return [...new Set((data ?? []).map((d) => d.contact_id as string))]
}

/** Select clause that restricts rows to a tag's members inside the database. */
export function tagJoin(tagId: string | null): string {
  return tagId ? ', contact_tags!inner(tag_id)' : ''
}

/** The column filters the list, select-all and export must agree on. */
export function applyContactFilters<Q extends AnyFilterBuilder>(
  query: Q,
  filters: UseContactsParams['filters'] = {},
): Q {
  let q: AnyFilterBuilder = query
  const tagId = orNull(filters.tag_id)
  if (tagId) q = q.eq('contact_tags.tag_id', tagId)
  if (orNull(filters.subscription_status)) q = q.eq('subscription_status', filters.subscription_status)
  if (filters.graduation_year) q = q.eq('graduation_year', filters.graduation_year)
  if (orNull(filters.gender)) q = q.eq('gender', filters.gender)
  if (orNull(filters.country)) q = q.eq('country', filters.country)
  if (orNull(filters.position)) q = q.eq('position', filters.position)
  if (orNull(filters.owner_id)) q = q.eq('owner_id', filters.owner_id)
  if (orNull(filters.state)) q = q.eq('state', filters.state)
  if (filters.phone_prefix) {
    // Area codes appear after an optional country code: +1 949..., (949)..., 0161...
    const p = filters.phone_prefix
    q = q.or(
      [
        `phone.ilike.${p}%`,        // 9491234567
        `phone.ilike.+_${p}%`,      // +19491234567
        `phone.ilike.+__${p}%`,     // +441234567890
        `phone.ilike.+___${p}%`,    // +3901234567890
        `phone.ilike.+_ ${p}%`,     // +1 9491234567
        `phone.ilike.+__ ${p}%`,    // +44 2012345678
        `phone.ilike.+___ ${p}%`,   // +391 021234567
        `phone.ilike.(${p})%`,      // (949) 1234567
        `phone.ilike.+_(${p})%`,    // +1(949)1234567
        `phone.ilike.+_ (${p})%`,   // +1 (949) 1234567
        `phone.ilike.0${p}%`,       // 02012345678
      ].join(','),
    )
  }
  return q as Q
}

/** Sort column plus an id tiebreak, so range pages never skip or repeat a row. */
export function orderContacts<Q extends { order(column: string, opts?: { ascending?: boolean }): Q }>(
  query: Q,
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
): Q {
  // Thousands of contacts share a created_at to the millisecond after a bulk
  // import. Paging on a non-unique sort lets rows slide between pages, which
  // shows up as duplicates on screen and as silently missing rows in exports.
  return query
    .order(sortBy || 'created_at', { ascending: sortBy ? sortOrder === 'asc' : false })
    .order('id', { ascending: true })
}
