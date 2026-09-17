import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Contact, ContactTag, UseContactsParams } from '@/lib/types/contacts'
import {
  applyContactFilters,
  fetchRankedContactIds,
  orderByIds,
  orderContacts,
  resolveDealContactIds,
  tagJoin,
} from '@/lib/contacts/search'

/**
 * Batch-fetch tags for a page of contacts and attach them in place.
 *
 * Shared by both read paths — the filtered list and the ranked search — so
 * a contact's tags are assembled the same way regardless of how the rows
 * were found.
 */
async function attachTags(
  supabase: ReturnType<typeof createClient>,
  contacts: Contact[],
): Promise<Contact[]> {
  if (contacts.length === 0) return contacts

  const { data: tagData } = await supabase
    .from('contact_tags')
    .select('contact_id, tag:tags(id, name, color, category)')
    .in('contact_id', contacts.map((c) => c.id))

  if (tagData) {
    const tagsByContact = new Map<string, ContactTag[]>()
    for (const row of tagData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tag = (row as any).tag as ContactTag | null
      if (tag) {
        const existing = tagsByContact.get(row.contact_id) || []
        existing.push(tag)
        tagsByContact.set(row.contact_id, existing)
      }
    }
    for (const contact of contacts) {
      contact.tags = tagsByContact.get(contact.id) || []
    }
  }

  return contacts
}

export function useContacts(params?: UseContactsParams) {
  const supabase = createClient()

  return useQuery<{ contacts: Contact[]; total: number }>({
    queryKey: ['contacts', params],
    queryFn: async () => {
      // Pipeline / recruiter narrow by deal; the tag filter is applied inside
      // the database (a contact_tags inner join), never as an id list — a
      // 1,926-contact tag used to be fetched capped at 1000 and then sent as
      // ids in the URL, which PostgREST rejects. Filters are shared with the
      // export (lib/contacts/search.ts) so the two can't disagree.
      const filters = params?.filters ?? {}
      const contactIdsFromDeals = await resolveDealContactIds(supabase, filters)
      if (contactIdsFromDeals && contactIdsFromDeals.length === 0) {
        return { contacts: [], total: 0 }
      }
      const tagId = filters.tag_id && filters.tag_id !== 'all' ? filters.tag_id : null

      // Searching takes a different route: matching and relevance ranking
      // happen in the `search_contacts_ranked` database function, which
      // returns a page of ids. Everything else — the column list, the tag
      // join below — stays shared, so the two paths can't diverge.
      const searchTerm = params?.search?.trim() ?? ''

      if (searchTerm) {
        const pageSize = params?.pageSize ?? 25
        const page = params?.page ?? 1

        const { ids, total } = await fetchRankedContactIds(supabase, {
          search: searchTerm,
          contactIds: contactIdsFromDeals,
          filters,
          tagId,
          sortBy: params?.sortBy,
          sortOrder: params?.sortOrder,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        })

        if (ids.length === 0) return { contacts: [], total }

        const { data: rows, error: rowsError } = await supabase
          .from('contacts')
          .select('*')
          .in('id', ids)

        if (rowsError) throw rowsError

        return {
          contacts: await attachTags(supabase, orderByIds(rows || [], ids)),
          total,
        }
      }

      let query = supabase
        .from('contacts')
        .select('*' + tagJoin(tagId), { count: 'exact' })

      if (contactIdsFromDeals) {
        query = query.in('id', contactIdsFromDeals)
      }
      query = applyContactFilters(query, filters)
      query = orderContacts(query, params?.sortBy, params?.sortOrder)

      // Apply pagination
      if (params?.page && params?.pageSize) {
        const from = (params.page - 1) * params.pageSize
        const to = from + params.pageSize - 1
        query = query.range(from, to)
      }

      const { data, error, count } = await query

      if (error) throw error

      // The select string is computed (the tag join is optional), which
      // supabase-js can't type-infer; the columns are still `*` from contacts.
      const rows = (data || []) as unknown as Contact[]
      return { contacts: await attachTags(supabase, rows), total: count || 0 }
    },
  })
}

export function useContact(contactId: string | null) {
  const supabase = createClient()

  return useQuery<Contact | null>({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      if (!contactId) return null

      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          owner:profiles!owner_id(id, full_name, email, calendly_url)
        `)
        .eq('id', contactId)
        .single()

      if (error) throw error
      return data as Contact
    },
    enabled: !!contactId,
  })
}

export function useCreateContact() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contact: Partial<Contact>) => {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          ...contact,
          source: contact.source || 'manual',
        })
        .select()
        .single()

      if (error) throw error

      // Add to "All Contacts Everyone" list if it exists
      const { data: allContactsList } = await supabase
        .from('lists')
        .select('id')
        .ilike('name', '%all contacts%everyone%')
        .limit(1)
        .single()

      if (allContactsList && data) {
        await supabase.from('contact_lists').insert({
          list_id: allContactsList.id,
          contact_id: data.id,
        })
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-stats'] })
    },
  })
}

export function useUpdateContact() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ contactId, updates }: { contactId: string; updates: Partial<Contact> }) => {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', contactId)
        .select()
        .single()

      if (error) {
        console.error('Supabase update error:', JSON.stringify(error, null, 2))
        const errorCode = String(error.code || '')
        const errorMessage = String(error.message || '')
        const errorDetails = String(error.details || '')
        const errorHint = String(error.hint || '')

        if (
          errorCode === '23505' ||
          errorCode === '409' ||
          errorMessage.toLowerCase().includes('duplicate') ||
          errorMessage.toLowerCase().includes('unique') ||
          errorMessage.toLowerCase().includes('already exists') ||
          errorMessage.toLowerCase().includes('violates unique constraint') ||
          errorDetails.toLowerCase().includes('already exists') ||
          errorHint.toLowerCase().includes('unique')
        ) {
          throw new Error('This email address is already in use by another contact')
        }
        throw new Error(errorMessage || 'Failed to update contact')
      }
      return data
    },
    onMutate: async ({ contactId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['contacts'] })
      await queryClient.cancelQueries({ queryKey: ['contact', contactId] })

      // Optimistically update all matching contacts queries
      const contactsQueries = queryClient.getQueriesData<{ contacts: Contact[]; total: number }>({ queryKey: ['contacts'] })
      const snapshots: [readonly unknown[], { contacts: Contact[]; total: number } | undefined][] = []

      for (const [queryKey, data] of contactsQueries) {
        snapshots.push([queryKey, data])
        if (data?.contacts) {
          queryClient.setQueryData(queryKey, {
            ...data,
            contacts: data.contacts.map((c: Contact) =>
              c.id === contactId ? { ...c, ...updates } : c
            ),
          })
        }
      }

      return { snapshots }
    },
    onError: (_err, _vars, context) => {
      // Rollback all snapshots
      if (context?.snapshots) {
        for (const [queryKey, data] of context.snapshots) {
          queryClient.setQueryData(queryKey, data)
        }
      }
    },
    onSettled: (_data, _error, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] })
    },
  })
}

export function useBulkDeleteContacts() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contactIds: string[]) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', contactIds)

      if (error) throw error
    },
    onMutate: async (contactIds) => {
      await queryClient.cancelQueries({ queryKey: ['contacts'] })

      const contactsQueries = queryClient.getQueriesData<{ contacts: Contact[]; total: number }>({ queryKey: ['contacts'] })
      const snapshots: [readonly unknown[], { contacts: Contact[]; total: number } | undefined][] = []
      const idSet = new Set(contactIds)

      for (const [queryKey, data] of contactsQueries) {
        snapshots.push([queryKey, data])
        if (data?.contacts) {
          queryClient.setQueryData(queryKey, {
            ...data,
            contacts: data.contacts.filter((c: Contact) => !idSet.has(c.id)),
            total: data.total - contactIds.length,
          })
        }
      }

      return { snapshots }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshots) {
        for (const [queryKey, data] of context.snapshots) {
          queryClient.setQueryData(queryKey, data)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-stats'] })
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['list-stats'] })
    },
  })
}

export function useBulkUpdateContactSubscription() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ contactIds, status }: { contactIds: string[]; status: string }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ subscription_status: status })
        .in('id', contactIds)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-stats'] })
    },
  })
}

export function useContactDeals(contactId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['contact-deals', contactId],
    queryFn: async () => {
      if (!contactId) return []

      const { data, error } = await supabase
        .from('deals')
        .select(`
          *,
          pipeline:pipelines(*),
          stage:pipeline_stages!current_stage_id(*)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!data || data.length === 0) return []

      // Fetch owners separately to avoid FK ambiguity
      const ownerIds = [...new Set(data.map(d => d.deal_owner_id).filter(Boolean))]
      let ownersMap = new Map<string, { id: string; full_name: string; email: string }>()
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ownerIds)
        ownersMap = new Map(owners?.map(o => [o.id, { id: o.id, full_name: o.full_name || '', email: o.email || '' }]) || [])
      }

      return data.map(deal => ({
        ...deal,
        owner: deal.deal_owner_id ? ownersMap.get(deal.deal_owner_id) || null : null,
      }))
    },
    enabled: !!contactId,
  })
}

export function useContactActivities(contactId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['contact-activities', contactId],
    queryFn: async () => {
      if (!contactId) return []

      // Get activities from deal_activities for deals associated with this contact
      const { data: deals } = await supabase
        .from('deals')
        .select('id')
        .eq('contact_id', contactId)

      if (!deals || deals.length === 0) return []

      const dealIds = deals.map((d) => d.id)

      const { data, error } = await supabase
        .from('deal_activities')
        .select(`
          *,
          performed_by:profiles(*)
        `)
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data || []
    },
    enabled: !!contactId,
  })
}

export function useContactLists(contactId: string | null) {
  const supabase = createClient()

  return useQuery<{ id: string; name: string }[]>({
    queryKey: ['contact-lists', contactId],
    queryFn: async () => {
      if (!contactId) return []

      const { data, error } = await supabase
        .from('contact_lists')
        .select(`
          list:lists(id, name)
        `)
        .eq('contact_id', contactId)

      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data?.map((d: any) => d.list).filter(Boolean) || []) as { id: string; name: string }[]
    },
    enabled: !!contactId,
  })
}

export function useContactLastContacted(contactId: string | null) {
  const supabase = createClient()

  return useQuery<string | null>({
    queryKey: ['contact-last-contacted', contactId],
    queryFn: async () => {
      if (!contactId) return null

      // Get deals for this contact
      const { data: deals } = await supabase
        .from('deals')
        .select('id')
        .eq('contact_id', contactId)

      if (!deals || deals.length === 0) return null

      const dealIds = deals.map((d) => d.id)

      // Check automation_logs for email_sent
      const { data: emailLogs } = await supabase
        .from('automation_logs')
        .select('created_at')
        .eq('status', 'sent')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false })
        .limit(1)

      // Check deal_activities for email_sent
      const { data: emailActivities } = await supabase
        .from('deal_activities')
        .select('created_at')
        .eq('activity_type', 'email_sent')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false })
        .limit(1)

      // Return the most recent date
      const logDate = emailLogs?.[0]?.created_at
      const activityDate = emailActivities?.[0]?.created_at

      if (logDate && activityDate) {
        return new Date(logDate) > new Date(activityDate) ? logDate : activityDate
      }

      return logDate || activityDate || null
    },
    enabled: !!contactId,
  })
}

export interface ContactAutomationEnrollment {
  id: string
  deal_id: string
  automation_id: string
  status: 'active' | 'completed' | 'stopped' | 'paused'
  current_step_id: string | null
  next_step_at: string | null
  enrolled_at: string
  completed_at: string | null
  stopped_at: string | null
  stopped_reason: string | null
  automation?: {
    id: string
    name: string
  }
  current_step?: {
    id: string
    step_order: number
    step_type: string
  }
  deal?: {
    id: string
    title: string
  }
}

export function useContactAutomations(contactId: string | null) {
  const supabase = createClient()

  return useQuery<ContactAutomationEnrollment[]>({
    queryKey: ['contact-automations', contactId],
    queryFn: async () => {
      if (!contactId) return []

      // Get deals for this contact
      const { data: deals } = await supabase
        .from('deals')
        .select('id, title')
        .eq('contact_id', contactId)

      if (!deals || deals.length === 0) return []

      const dealIds = deals.map((d) => d.id)

      // Get automation enrollments for these deals
      const { data: enrollments, error } = await supabase
        .from('automation_enrollments')
        .select(`
          *,
          automation:automations(id, name),
          current_step:automation_steps(id, step_order, step_type)
        `)
        .in('deal_id', dealIds)
        .order('enrolled_at', { ascending: false })

      if (error) throw error

      // Merge deal info with enrollments
      const dealMap = new Map(deals.map((d) => [d.id, d]))

      return (enrollments || []).map((enrollment) => ({
        ...enrollment,
        deal: dealMap.get(enrollment.deal_id),
      }))
    },
    enabled: !!contactId,
  })
}

// ============================================
// Contact Tags
// ============================================

export function useContactTags(contactId: string | null) {
  const supabase = createClient()

  return useQuery<ContactTag[]>({
    queryKey: ['contact-tags', contactId],
    queryFn: async () => {
      if (!contactId) return []

      const { data, error } = await supabase
        .from('contact_tags')
        .select(`
          tag:tags(id, name, color, category)
        `)
        .eq('contact_id', contactId)

      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data?.map((d: any) => d.tag).filter(Boolean) || []) as ContactTag[]
    },
    enabled: !!contactId,
  })
}

export function useAddTagToContact() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      const { error } = await supabase
        .from('contact_tags')
        .insert({ contact_id: contactId, tag_id: tagId })

      if (error) throw error
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['contact-tags', contactId] })
    },
  })
}

export function useRemoveTagFromContact() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tagId)

      if (error) throw error
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['contact-tags', contactId] })
    },
  })
}

// ============================================
// Contact Invoices
// ============================================

export interface ContactInvoice {
  id: string
  invoice_number: string
  amount: number
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  type: 'deposit' | 'instalment' | 'full_payment' | 'meal_plan' | 'trip' | 'other'
  description: string | null
  due_date: string | null
  paid_at: string | null
  created_at: string
}

export function useContactInvoices(contactId: string | null) {
  const supabase = createClient()

  return useQuery<ContactInvoice[]>({
    queryKey: ['contact-invoices', contactId],
    queryFn: async () => {
      if (!contactId) return []

      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!contactId,
  })
}

// ============================================
// Contact Notes (Timestamped Log)
// ============================================

export interface ContactNote {
  id: string
  contact_id: string
  content: string
  created_by_id: string | null
  created_at: string
  created_by?: {
    id: string
    full_name: string | null
    email: string
  } | null
}

export function useContactNotes(contactId: string | null) {
  const supabase = createClient()

  return useQuery<ContactNote[]>({
    queryKey: ['contact-notes', contactId],
    queryFn: async () => {
      if (!contactId) return []

      const { data, error } = await supabase
        .from('contact_notes')
        .select(`
          *,
          created_by:profiles(id, full_name, email)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!contactId,
  })
}

export function useAddContactNote() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ contactId, content }: { contactId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('contact_notes')
        .insert({
          contact_id: contactId,
          content,
          created_by_id: user?.id || null,
        })
        .select(`
          *,
          created_by:profiles(id, full_name, email)
        `)
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', contactId] })
    },
  })
}

export function useDeleteContactNote() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ noteId, contactId }: { noteId: string; contactId: string }) => {
      const { error } = await supabase
        .from('contact_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', contactId] })
    },
  })
}
