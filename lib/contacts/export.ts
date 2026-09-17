/**
 * Contact exports: the Contacts page, a list, and a tag.
 *
 * Every export here reads past PostgREST's 1000-row cap. Each of the three used
 * to issue a single query and hand over a file of at most 1000 contacts — the
 * Contacts page produced exactly 1001 lines (header + 1000) from 114,830
 * contacts — while the list export never produced a file at all: it selected a
 * `grad_year` column that does not exist, so every attempt failed.
 *
 * All three now share one column set, one CSV writer and one filter
 * definition (lib/contacts/search.ts), so a list export and the page export
 * can no longer disagree about what a contact row looks like.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UseContactsParams } from '@/lib/types/contacts'
import { fetchAll, toCSV, type Column, type Row } from '@/lib/reports/csv'
import {
  applyContactFilters,
  fetchRankedContactIds,
  IN_CHUNK_SIZE,
  orderByIds,
  orderContacts,
  resolveDealContactIds,
  tagJoin,
} from '@/lib/contacts/search'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

export const EXPORT_COLUMNS: Column[] = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'country', label: 'Country' },
  { key: 'state', label: 'State' },
  { key: 'city', label: 'City' },
  { key: 'position', label: 'Position' },
  { key: 'club_name', label: 'Club' },
  { key: 'graduation_year', label: 'Graduation Year' },
  { key: 'gender', label: 'Gender' },
  { key: 'gpa', label: 'GPA' },
  { key: 'date_of_birth', label: 'Date of Birth' },
  { key: 'parent_name', label: 'Parent Name' },
  { key: 'parent_email', label: 'Parent Email' },
  { key: 'parent_phone', label: 'Parent Phone' },
  { key: 'source', label: 'Source' },
  { key: 'subscription_status', label: 'Subscription Status' },
  { key: 'notes', label: 'Notes' },
]

/** Only what the file needs — `*` would drag custom_fields across the wire 115 times. */
const SELECT = ['id', ...EXPORT_COLUMNS.map((c) => c.key)].join(', ')

/** Headroom over today's 114,830 contacts; fetchAll's default stops at 200k. */
const MAX_ROWS = 1_000_000

export interface ExportQuery {
  filters?: UseContactsParams['filters']
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/** Everything the Contacts page currently shows, across every page. */
export async function fetchContactsForExport(supabase: Client, q: ExportQuery): Promise<Row[]> {
  const filters = q.filters ?? {}
  const dealIds = await resolveDealContactIds(supabase, filters)
  if (dealIds && dealIds.length === 0) return []

  const tagId = filters.tag_id && filters.tag_id !== 'all' ? filters.tag_id : null
  const search = q.search?.trim()

  if (search) {
    // The ranked search function is subject to the same 1000-row cap, so its
    // ids are paged too, rather than trusting a large p_limit.
    const ids: string[] = []
    for (let offset = 0; ; offset += 1000) {
      const page = await fetchRankedContactIds(supabase, {
        search,
        contactIds: dealIds,
        filters,
        tagId,
        sortBy: q.sortBy,
        sortOrder: q.sortOrder,
        limit: 1000,
        offset,
      })
      ids.push(...page.ids)
      if (page.ids.length < 1000 || ids.length >= page.total) break
    }
    if (ids.length === 0) return []

    const rows: Row[] = []
    for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
      const { data, error } = await supabase
        .from('contacts')
        .select(SELECT)
        .in('id', ids.slice(i, i + IN_CHUNK_SIZE))
      if (error) throw error
      rows.push(...((data ?? []) as unknown as Row[]))
    }
    return orderByIds(rows as (Row & { id: string })[], ids)
  }

  return fetchAll<Row>(() => {
    let query = supabase.from('contacts').select(SELECT + tagJoin(tagId))
    if (dealIds) query = query.in('id', dealIds)
    query = applyContactFilters(query, filters)
    return orderContacts(query, q.sortBy, q.sortOrder)
  }, { max: MAX_ROWS })
}

/** Every member of a list. */
export function fetchListContactsForExport(supabase: Client, listId: string): Promise<Row[]> {
  return fetchAll<Row>(
    () =>
      supabase
        .from('contacts')
        .select(`${SELECT}, contact_lists!inner(list_id)`)
        .eq('contact_lists.list_id', listId)
        .order('id', { ascending: true }),
    { max: MAX_ROWS },
  )
}

/** Every contact carrying a tag. */
export function fetchTagContactsForExport(supabase: Client, tagId: string): Promise<Row[]> {
  return fetchAll<Row>(
    () =>
      supabase
        .from('contacts')
        .select(`${SELECT}, contact_tags!inner(tag_id)`)
        .eq('contact_tags.tag_id', tagId)
        .order('id', { ascending: true }),
    { max: MAX_ROWS },
  )
}

export function contactsToCSV(rows: Row[]): string {
  return toCSV(rows, EXPORT_COLUMNS)
}

/** "ALL MENS" -> "ALL-MENS-contacts-2026-09-17.csv" */
export function exportFilename(name: string): string {
  const slug = name.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'contacts'
  return `${slug}-contacts-${new Date().toISOString().slice(0, 10)}.csv`
}

export function downloadCSV(csv: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
