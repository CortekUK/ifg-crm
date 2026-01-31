import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Contact, UseContactsParams } from '@/lib/types/contacts'

export function useContacts(params?: UseContactsParams) {
  const supabase = createClient()

  return useQuery<{ contacts: Contact[]; total: number }>({
    queryKey: ['contacts', params],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })

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

      // Apply sorting
      if (params?.sortBy) {
        query = query.order(params.sortBy, { ascending: params.sortOrder === 'asc' })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const { data, error, count } = await query

      if (error) throw error
      return { contacts: data || [], total: count || 0 }
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
        .select('*')
        .eq('id', contactId)
        .single()

      if (error) throw error
      return data
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
        .eq('name', 'All Contacts Everyone')
        .single()

      if (allContactsList && data) {
        await supabase.from('list_contacts').insert({
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

      if (error) throw error
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
          stage:pipeline_stages(*),
          owner:profiles(*)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
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
        .from('list_contacts')
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
        .eq('log_type', 'email_sent')
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
  started_at: string
  completed_at: string | null
  stopped_at: string | null
  stopped_reason: string | null
  automation?: {
    id: string
    name: string
    automation_type: string
  }
  current_step?: {
    id: string
    step_name: string
    step_order: number
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
          automation:automations(id, name, automation_type),
          current_step:automation_steps(id, step_name, step_order)
        `)
        .in('deal_id', dealIds)
        .order('started_at', { ascending: false })

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
