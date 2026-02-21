import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Contact, ContactTag, UseContactsParams } from '@/lib/types/contacts'

// PostgREST has URL length limits; chunk .in() to avoid exceeding them
const IN_CHUNK_SIZE = 200

export function useContacts(params?: UseContactsParams) {
  const supabase = createClient()

  return useQuery<{ contacts: Contact[]; total: number }>({
    queryKey: ['contacts', params],
    queryFn: async () => {
      // If filtering by pipeline or recruiter, we need to get contact IDs first
      let contactIdsFromDeals: string[] | null = null

      if (params?.filters?.pipeline_id && params.filters.pipeline_id !== 'all') {
        const { data: deals } = await supabase
          .from('deals')
          .select('contact_id')
          .eq('pipeline_id', params.filters.pipeline_id)
          .not('contact_id', 'is', null)

        contactIdsFromDeals = [...new Set(deals?.map(d => d.contact_id).filter(Boolean))] as string[]
        if (contactIdsFromDeals.length === 0) {
          return { contacts: [], total: 0 }
        }
      }

      if (params?.filters?.recruiter_id && params.filters.recruiter_id !== 'all') {
        const { data: deals } = await supabase
          .from('deals')
          .select('contact_id')
          .eq('deal_owner_id', params.filters.recruiter_id)
          .not('contact_id', 'is', null)

        const recruiterContactIds = [...new Set(deals?.map(d => d.contact_id).filter(Boolean))] as string[]

        if (contactIdsFromDeals) {
          // Intersect with pipeline filter
          contactIdsFromDeals = contactIdsFromDeals.filter(id => recruiterContactIds.includes(id))
        } else {
          contactIdsFromDeals = recruiterContactIds
        }

        if (contactIdsFromDeals.length === 0) {
          return { contacts: [], total: 0 }
        }
      }

      // Filter by tag
      if (params?.filters?.tag_id && params.filters.tag_id !== 'all') {
        const { data: tagEntries } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .eq('tag_id', params.filters.tag_id)

        const tagContactIds = [...new Set((tagEntries || []).map(e => e.contact_id))] as string[]

        if (contactIdsFromDeals) {
          contactIdsFromDeals = contactIdsFromDeals.filter(id => tagContactIds.includes(id))
        } else {
          contactIdsFromDeals = tagContactIds
        }

        if (contactIdsFromDeals.length === 0) {
          return { contacts: [], total: 0 }
        }
      }

      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })

      // Filter by contact IDs if we have pipeline/recruiter filters
      if (contactIdsFromDeals) {
        query = query.in('id', contactIdsFromDeals)
      }

      // Apply search
      if (params?.search) {
        query = query.or(
          `first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%,email.ilike.%${params.search}%,phone.ilike.%${params.search}%`
        )
      }

      // Apply filters
      if (params?.filters?.subscription_status && params.filters.subscription_status !== 'all') {
        query = query.eq('subscription_status', params.filters.subscription_status)
      }
      if (params?.filters?.graduation_year) {
        query = query.eq('graduation_year', params.filters.graduation_year)
      }
      if (params?.filters?.gender && params.filters.gender !== 'all') {
        query = query.eq('gender', params.filters.gender)
      }
      if (params?.filters?.country && params.filters.country !== 'all') {
        query = query.eq('country', params.filters.country)
      }
      if (params?.filters?.position && params.filters.position !== 'all') {
        query = query.eq('position', params.filters.position)
      }
      if (params?.filters?.owner_id && params.filters.owner_id !== 'all') {
        query = query.eq('owner_id', params.filters.owner_id)
      }

      // Apply sorting
      if (params?.sortBy) {
        query = query.order(params.sortBy, { ascending: params.sortOrder === 'asc' })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      // Apply pagination
      if (params?.page && params?.pageSize) {
        const from = (params.page - 1) * params.pageSize
        const to = from + params.pageSize - 1
        query = query.range(from, to)
      }

      const { data, error, count } = await query

      if (error) throw error

      const contacts = data || []

      // Batch-fetch tags for all returned contacts
      if (contacts.length > 0) {
        const ids = contacts.map((c) => c.id)
        const { data: tagData } = await supabase
          .from('contact_tags')
          .select('contact_id, tag:tags(id, name, color, category)')
          .in('contact_id', ids)

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
      }

      return { contacts, total: count || 0 }
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
        // Provide more specific error messages for unique constraint violations
        // 23505 is PostgreSQL unique violation, 409 is HTTP Conflict
        const errorCode = String(error.code || '')
        const errorMessage = String(error.message || '')
        const errorDetails = String(error.details || '')
        const errorHint = String(error.hint || '')

        // Check for unique constraint violation (duplicate email)
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact'] })
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

export function useTags() {
  const supabase = createClient()

  return useQuery<ContactTag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      return data || []
    },
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
