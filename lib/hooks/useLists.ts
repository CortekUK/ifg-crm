import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { List, ListWithContacts, ListFilters, CreateListInput, UpdateListInput, ListStats, ListContact } from '@/lib/types/lists'

export function useLists(filters?: ListFilters) {
  const supabase = createClient()

  return useQuery<List[]>({
    queryKey: ['lists', filters],
    queryFn: async () => {
      // First get all lists
      let query = supabase
        .from('lists')
        .select('*')
        .order('name', { ascending: true })

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
      }

      if (filters?.sport && filters.sport !== 'all') {
        query = query.eq('sport', filters.sport)
      }

      const { data: lists, error } = await query

      if (error) throw error

      // Get contact counts for each list
      const listIds = lists?.map((l) => l.id) || []
      
      if (listIds.length === 0) {
        return []
      }

      const { data: counts, error: countError } = await supabase
        .from('contact_lists')
        .select('list_id')
        .in('list_id', listIds)

      if (countError) throw countError

      // Calculate counts
      const countMap = new Map<string, number>()
      counts?.forEach((c) => {
        countMap.set(c.list_id, (countMap.get(c.list_id) || 0) + 1)
      })

      // Merge counts with lists
      return (lists || []).map((list) => ({
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

      // Get list details
      const { data: list, error: listError } = await supabase
        .from('lists')
        .select('*')
        .eq('id', listId)
        .single()

      if (listError) throw listError

      // Get contacts in this list
      const { data: listContacts, error: contactsError } = await supabase
        .from('contact_lists')
        .select(`
          contact_id,
          list_id,
          added_at,
          contact:contacts(*)
        `)
        .eq('list_id', listId)
        .order('added_at', { ascending: false })

      if (contactsError) throw contactsError

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
      let query = supabase
        .from('contact_lists')
        .select(`
          contact_id,
          list_id,
          added_at,
          contact:contacts!inner(*)
        `, { count: 'exact' })
        .eq('list_id', listId)

      // Apply search filter if provided
      if (search) {
        query = query.or(`contact.first_name.ilike.%${search}%,contact.last_name.ilike.%${search}%,contact.email.ilike.%${search}%`)
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
      // Get total lists count
      const { count: totalLists } = await supabase
        .from('lists')
        .select('*', { count: 'exact', head: true })

      // Get all lists with their contact counts
      const { data: lists } = await supabase
        .from('lists')
        .select('id, name')

      const listIds = lists?.map((l) => l.id) || []

      // Get contact counts
      const { data: counts } = await supabase
        .from('contact_lists')
        .select('list_id')
        .in('list_id', listIds)

      // Calculate counts per list
      const countMap = new Map<string, number>()
      let totalContacts = 0
      counts?.forEach((c) => {
        const currentCount = countMap.get(c.list_id) || 0
        countMap.set(c.list_id, currentCount + 1)
        totalContacts++
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['list', variables.listId] })
      queryClient.invalidateQueries({ queryKey: ['list-contacts', variables.listId] })
      queryClient.invalidateQueries({ queryKey: ['list-stats'] })
      // Invalidate player queries since players = contacts in lists
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['player-stats'] })
      queryClient.invalidateQueries({ queryKey: ['distinct-positions'] })
      queryClient.invalidateQueries({ queryKey: ['distinct-countries'] })
      // Invalidate contact-lists for all affected contacts
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['list', variables.listId] })
      queryClient.invalidateQueries({ queryKey: ['list-contacts', variables.listId] })
      queryClient.invalidateQueries({ queryKey: ['list-stats'] })
      // Invalidate player queries since players = contacts in lists
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['player-stats'] })
      queryClient.invalidateQueries({ queryKey: ['distinct-positions'] })
      queryClient.invalidateQueries({ queryKey: ['distinct-countries'] })
      // Invalidate contact-lists for the affected contact
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
      // Invalidate player queries since players = contacts in lists
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['player-stats'] })
      queryClient.invalidateQueries({ queryKey: ['distinct-positions'] })
      queryClient.invalidateQueries({ queryKey: ['distinct-countries'] })
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
    mutationFn: async (listId: string) => {
      // Get all contacts in the list
      const { data, error } = await supabase
        .from('contact_lists')
        .select(`
          contact:contacts(
            first_name,
            last_name,
            email,
            phone,
            grad_year
          )
        `)
        .eq('list_id', listId)
        .order('added_at', { ascending: false })

      if (error) throw error

      // Convert to CSV
      const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Grad Year']
      const rows = (data || []).map((item) => {
        const contactData = item.contact
        const contact = Array.isArray(contactData) ? contactData[0] : contactData
        if (!contact) return []
        return [
          contact.first_name || '',
          contact.last_name || '',
          contact.email || '',
          contact.phone || '',
          contact.grad_year?.toString() || '',
        ]
      }).filter((row) => row.length > 0)

      // Build CSV string
      const escapeCSV = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }

      const csvLines = [
        headers.map(escapeCSV).join(','),
        ...rows.map((row) => row.map(escapeCSV).join(',')),
      ]

      return csvLines.join('\n')
    },
  })
}
