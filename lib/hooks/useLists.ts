import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchRankedContactIds } from '@/lib/contacts/search'
import type { List, ListWithContacts, ListFilters, CreateListInput, UpdateListInput, ListStats } from '@/lib/types/lists'
import { fetchListContactsForExport, contactsToCSV } from '@/lib/contacts/export'

export function useLists(filters?: ListFilters) {
  const supabase = createClient()

  return useQuery<List[]>({
    queryKey: ['lists', filters],
    queryFn: async () => {
      // First get all lists
      let query = supabase
        .from('lists')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
      }

      if (filters?.sport && filters.sport !== 'all') {
        query = query.eq('sport', filters.sport)
      }

      const { data: lists, error } = await query

      if (error) throw error

      if (!lists || lists.length === 0) return []

      // Get contact counts via RPC (avoids Supabase default row limit)
      const { data: counts, error: countError } = await supabase
        .rpc('get_list_contact_counts')

      if (countError) throw countError

      // Build count map
      const countMap = new Map<string, number>()
      counts?.forEach((c: { list_id: string; contact_count: number }) => {
        countMap.set(c.list_id, c.contact_count)
      })

      // Merge counts with lists
      return lists.map((list) => ({
        ...list,
        contact_count: countMap.get(list.id) || 0,
      }))
    },
  })
}

export function useList(listId: string | null) {
  const supabase = createClient()

  return useQuery<ListWithContacts | null>({
    queryKey: ['list', listId],
    queryFn: async () => {
      if (!listId) return null

      // Fetch list details and contacts in parallel
      const [listResult, contactsResult] = await Promise.all([
        supabase
          .from('lists')
          .select('*')
          .eq('id', listId)
          .single(),
        supabase
          .from('contact_lists')
          .select(`
            contact_id,
            list_id,
            added_at,
            contact:contacts(*)
          `)
          .eq('list_id', listId)
          .order('added_at', { ascending: false }),
      ])

      if (listResult.error) throw listResult.error
      if (contactsResult.error) throw contactsResult.error

      const list = listResult.data
      const listContacts = contactsResult.data

      return {
        ...list,
        contact_count: listContacts?.length || 0,
        contacts: listContacts || [],
      }
    },
    enabled: !!listId,
  })
}

export function useListContacts(listId: string | null, page = 1, pageSize = 20, search?: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['list-contacts', listId, page, pageSize, search],
    queryFn: async () => {
      if (!listId) return { contacts: [], total: 0 }

      const offset = (page - 1) * pageSize

      // Build base query for contacts in this list
      const query = supabase
        .from('contact_lists')
        .select(`
          contact_id,
          list_id,
          added_at,
          contact:contacts!inner(*)
        `, { count: 'exact' })
        .eq('list_id', listId)

      // Searching goes through search_contacts_ranked, scoped to this list,
      // so member search behaves identically to the Contacts page and to the
      // tag sheet — one definition of what "matches", and results ranked by
      // relevance rather than by when they were added.
      if (search?.trim()) {
        const { ids, total } = await fetchRankedContactIds(supabase, {
          search: search.trim(),
          contactIds: null,
          listId,
          limit: pageSize,
          offset,
        })

        if (ids.length === 0) return { contacts: [], total }

        const { data, error } = await supabase
          .from('contact_lists')
          .select('contact_id, list_id, added_at, contact:contacts!inner(*)')
          .eq('list_id', listId)
          .in('contact_id', ids)

        if (error) throw error

        const position = new Map(ids.map((id, i) => [id, i]))
        const ordered = [...(data || [])].sort(
          (a, b) => (position.get(a.contact_id) ?? 0) - (position.get(b.contact_id) ?? 0)
        )

        return { contacts: ordered, total }
      }

      const { data, count, error } = await query
        .order('added_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (error) throw error

      return {
        contacts: data || [],
        total: count || 0,
      }
    },
    enabled: !!listId,
  })
}

export function useListStats() {
  const supabase = createClient()

  return useQuery<ListStats>({
    queryKey: ['list-stats'],
    queryFn: async () => {
      // Get all lists with count and contact counts in parallel
      const [listsResult, countsResult] = await Promise.all([
        supabase.from('lists').select('id, name', { count: 'exact' }),
        supabase.rpc('get_list_contact_counts'),
      ])

      const lists = listsResult.data
      const totalLists = listsResult.count

      // Build count map
      const countMap = new Map<string, number>()
      let totalContacts = 0
      countsResult.data?.forEach((c: { list_id: string; contact_count: number }) => {
        countMap.set(c.list_id, c.contact_count)
        totalContacts += c.contact_count
      })

      // Find largest list
      let largestListName = 'None'
      let largestListCount = 0

      lists?.forEach((list) => {
        const count = countMap.get(list.id) || 0
        if (count > largestListCount) {
          largestListCount = count
          largestListName = list.name
        }
      })

      return {
        totalLists: totalLists || 0,
        totalContacts,
        largestListName,
        largestListCount,
      }
    },
  })
}

export function useCreateList() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateListInput) => {
      const { data, error } = await supabase
        .from('lists')
        .insert({
          name: input.name,
          description: input.description || null,
          sport: input.sport || 'football',
          is_dynamic: input.is_dynamic || false,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['list-stats'] })
    },
  })
}

export function useUpdateList() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateListInput) => {
      const updateData: Record<string, unknown> = {}
      if (input.name !== undefined) updateData.name = input.name
      if (input.description !== undefined) updateData.description = input.description
      if (input.is_dynamic !== undefined) updateData.is_dynamic = input.is_dynamic

      const { data, error } = await supabase
        .from('lists')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['list', variables.id] })
    },
  })
}

export function useDeleteList() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', listId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['list-stats'] })
    },
  })
}

export function useBulkDeleteLists() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (listIds: string[]) => {
      const { error } = await supabase
        .from('lists')
        .delete()
        .in('id', listIds)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['list-stats'] })
    },
  })
}

export function useAddContactsToList() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ listId, contactIds }: { listId: string; contactIds: string[] }) => {
      const records = contactIds.map((contactId) => ({
        list_id: listId,
        contact_id: contactId,
        added_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('contact_lists')
        .upsert(records, { onConflict: 'contact_id,list_id' })

      if (error) throw error

      return { listId, contactIds }
    },
    onSettled: (_, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['list', variables.listId] })
      queryClient.invalidateQueries({ queryKey: ['list-contacts', variables.listId] })
      queryClient.invalidateQueries({ queryKey: ['list-stats'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      variables.contactIds.forEach((contactId) => {
        queryClient.invalidateQueries({ queryKey: ['contact-lists', contactId] })
      })
    },
  })
}

export function useRemoveContactFromList() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ listId, contactId }: { listId: string; contactId: string }) => {
      const { error } = await supabase
        .from('contact_lists')
        .delete()
        .eq('list_id', listId)
        .eq('contact_id', contactId)

      if (error) throw error
    },
    onSettled: (_, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['list', variables.listId] })
      queryClient.invalidateQueries({ queryKey: ['list-contacts', variables.listId] })
      queryClient.invalidateQueries({ queryKey: ['list-stats'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-lists', variables.contactId] })
    },
  })
}

export function useBulkRemoveContactsFromList() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ listId, contactIds }: { listId: string; contactIds: string[] }) => {
      const { error } = await supabase
        .from('contact_lists')
        .delete()
        .eq('list_id', listId)
        .in('contact_id', contactIds)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['list', variables.listId] })
      queryClient.invalidateQueries({ queryKey: ['list-contacts', variables.listId] })
      queryClient.invalidateQueries({ queryKey: ['list-stats'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      // Invalidate contact-lists for all affected contacts
      variables.contactIds.forEach((contactId) => {
        queryClient.invalidateQueries({ queryKey: ['contact-lists', contactId] })
      })
    },
  })
}

// Hook to get contact IDs already in a list (for Add Contacts modal)
export function useListContactIds(listId: string | null) {
  const supabase = createClient()

  return useQuery<Set<string>>({
    queryKey: ['list-contact-ids', listId],
    queryFn: async () => {
      if (!listId) return new Set()

      const { data, error } = await supabase
        .from('contact_lists')
        .select('contact_id')
        .eq('list_id', listId)

      if (error) throw error

      return new Set((data || []).map((item) => item.contact_id))
    },
    enabled: !!listId,
  })
}

export function useExportListContacts() {
  const supabase = createClient()

  return useMutation({
    // Shared with the Contacts page and tag exports (lib/contacts/export.ts).
    // This used to select a `grad_year` column that doesn't exist, so every
    // list export failed — and it was unpaged, so fixing only the column
    // would still have stopped at 1000 contacts.
    mutationFn: async (listId: string) => {
      const rows = await fetchListContactsForExport(supabase, listId)
      return { csv: contactsToCSV(rows), count: rows.length }
    },
  })
}
