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
