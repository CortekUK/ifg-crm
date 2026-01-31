import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Campaign, CampaignFilters, CreateCampaignInput, UpdateCampaignInput } from '@/lib/types/campaigns'

export function useCampaigns(filters?: CampaignFilters) {
  const supabase = createClient()

  return useQuery<Campaign[]>({
    queryKey: ['campaigns', filters],
    queryFn: async () => {
      let query = supabase
        .from('campaigns')
        .select(`
          *,
          template:email_templates(*),
          from_user:profiles!campaigns_from_user_id_fkey(id, email, full_name),
          created_by:profiles!campaigns_created_by_id_fkey(id, email, full_name)
        `)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`)
      }
      if (filters?.type && filters.type !== 'all') {
        query = query.eq('type', filters.type)
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      const { data: campaigns, error } = await query

      if (error) throw error
      if (!campaigns || campaigns.length === 0) return []

      // Fetch list info for campaigns that have recipient_list_ids
      const allListIds = new Set<string>()
      campaigns.forEach((c) => {
        if (c.recipient_list_ids && Array.isArray(c.recipient_list_ids)) {
          c.recipient_list_ids.forEach((id: string) => allListIds.add(id))
        }
      })

      let listsMap = new Map<string, { id: string; name: string; contact_count: number }>()
      
      if (allListIds.size > 0) {
        const { data: lists } = await supabase
          .from('lists')
          .select('id, name')
          .in('id', Array.from(allListIds))

        // Get contact counts for each list
        const { data: contactCounts } = await supabase
          .from('contact_lists')
          .select('list_id')
          .in('list_id', Array.from(allListIds))

        const countMap = new Map<string, number>()
        contactCounts?.forEach((c) => {
          countMap.set(c.list_id, (countMap.get(c.list_id) || 0) + 1)
        })

        lists?.forEach((list) => {
          listsMap.set(list.id, {
            id: list.id,
            name: list.name,
            contact_count: countMap.get(list.id) || 0,
          })
        })
      }

      // Enrich campaigns with list info
      return campaigns.map((campaign) => {
        const listIds = campaign.recipient_list_ids || []
        const recipientLists = listIds
          .map((id: string) => listsMap.get(id))
          .filter(Boolean)

        return {
          ...campaign,
          recipient_lists: recipientLists,
        }
      })
    },
  })
}

export function useCampaign(campaignId: string | null) {
  const supabase = createClient()

  return useQuery<Campaign | null>({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      if (!campaignId) return null

      const { data: campaign, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          template:email_templates(*),
          from_user:profiles!campaigns_from_user_id_fkey(id, email, full_name),
          created_by:profiles!campaigns_created_by_id_fkey(id, email, full_name)
        `)
        .eq('id', campaignId)
        .single()

      if (error) throw error
      if (!campaign) return null

      // Fetch list info
      const listIds = campaign.recipient_list_ids || []
      let recipientLists: { id: string; name: string; contact_count: number }[] = []

      if (listIds.length > 0) {
        const { data: lists } = await supabase
          .from('lists')
          .select('id, name')
          .in('id', listIds)

        const { data: contactCounts } = await supabase
          .from('contact_lists')
          .select('list_id')
          .in('list_id', listIds)

        const countMap = new Map<string, number>()
        contactCounts?.forEach((c) => {
          countMap.set(c.list_id, (countMap.get(c.list_id) || 0) + 1)
        })

        recipientLists = (lists || []).map((list) => ({
          id: list.id,
          name: list.name,
          contact_count: countMap.get(list.id) || 0,
        }))
      }

      return {
        ...campaign,
        recipient_lists: recipientLists,
      }
    },
    enabled: !!campaignId,
  })
}

export function useCreateCampaign() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaign: CreateCampaignInput) => {
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          name: campaign.name,
          type: campaign.type,
          status: campaign.status,
          email_template_id: campaign.email_template_id || null,
          sms_content: campaign.sms_content || null,
          from_user_id: campaign.from_user_id,
          created_by_id: campaign.created_by_id,
          scheduled_at: campaign.scheduled_at || null,
          recipient_list_ids: campaign.recipient_list_ids || [],
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useUpdateCampaign() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateCampaignInput) => {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      if (input.name !== undefined) updates.name = input.name
      if (input.status !== undefined) updates.status = input.status
      if (input.email_template_id !== undefined) updates.email_template_id = input.email_template_id
      if (input.sms_content !== undefined) updates.sms_content = input.sms_content
      if (input.scheduled_at !== undefined) updates.scheduled_at = input.scheduled_at
      if (input.recipient_list_ids !== undefined) updates.recipient_list_ids = input.recipient_list_ids

      const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', input.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.id] })
    },
  })
}

export function useCalculateRecipients(listIds: string[]) {
  const supabase = createClient()

  return useQuery<{ count: number; hasDuplicates: boolean }>({
    queryKey: ['calculate-recipients', listIds],
    queryFn: async () => {
      if (listIds.length === 0) {
        return { count: 0, hasDuplicates: false }
      }

      // Get all contact_ids from selected lists
      const { data, error } = await supabase
        .from('contact_lists')
        .select('contact_id')
        .in('list_id', listIds)

      if (error) throw error

      // Count unique contacts
      const allContacts = data?.map((c) => c.contact_id) || []
      const uniqueContacts = new Set(allContacts)
      const hasDuplicates = uniqueContacts.size < allContacts.length

      return {
        count: uniqueContacts.size,
        hasDuplicates,
      }
    },
    enabled: listIds.length > 0,
  })
}

export function useCampaignLists() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['campaign-lists'],
    queryFn: async () => {
      // Get all lists
      const { data: lists, error } = await supabase
        .from('lists')
        .select('*')
        .order('name')

      if (error) throw error

      // Get contact counts for each list
      const listIds = lists?.map((l) => l.id) || []
      
      if (listIds.length === 0) {
        return []
      }

      const { data: counts } = await supabase
        .from('contact_lists')
        .select('list_id')
        .in('list_id', listIds)

      const countMap = new Map<string, number>()
      counts?.forEach((c) => {
        countMap.set(c.list_id, (countMap.get(c.list_id) || 0) + 1)
      })

      return (lists || []).map((list) => ({
        ...list,
        contact_count: countMap.get(list.id) || 0,
      }))
    },
  })
}

// Legacy alias for backwards compatibility
export function useLists() {
  return useCampaignLists()
}

export function useEmailTemplates() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('category', 'campaign')
        .order('name')

      if (error) throw error
      return data || []
    },
  })
}
