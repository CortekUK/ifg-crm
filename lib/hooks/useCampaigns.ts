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
          subject: campaign.subject || null,
          body_text: campaign.body_text || null,
          body_html: campaign.body_html || null,
          from_name: campaign.from_name || null,
          from_email: campaign.from_email || null,
          reply_to: campaign.reply_to || null,
          preview_text: campaign.preview_text || null,
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
      if (input.subject !== undefined) updates.subject = input.subject
      if (input.body_text !== undefined) updates.body_text = input.body_text
      if (input.body_html !== undefined) updates.body_html = input.body_html
      if (input.from_name !== undefined) updates.from_name = input.from_name
      if (input.from_email !== undefined) updates.from_email = input.from_email
      if (input.reply_to !== undefined) updates.reply_to = input.reply_to
      if (input.preview_text !== undefined) updates.preview_text = input.preview_text
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

export function useDeleteCampaign() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useDuplicateCampaign() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId: string) => {
      // Fetch the original campaign
      const { data: original, error: fetchError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (fetchError) throw fetchError
      if (!original) throw new Error('Campaign not found')

      // Create a duplicate with modified name and draft status
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          name: `${original.name} (Copy)`,
          type: original.type,
          status: 'draft',
          email_template_id: original.email_template_id,
          subject: original.subject,
          body_text: original.body_text,
          body_html: original.body_html,
          from_name: original.from_name,
          from_email: original.from_email,
          reply_to: original.reply_to,
          preview_text: original.preview_text,
          sms_content: original.sms_content,
          from_user_id: original.from_user_id,
          created_by_id: original.created_by_id,
          recipient_list_ids: original.recipient_list_ids,
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

export function useCancelCampaign() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase
        .from('campaigns')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', campaignId)
        .eq('status', 'scheduled') // Only cancel if scheduled
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
  })
}

export function useCampaignStats(campaignId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['campaign-stats', campaignId],
    queryFn: async () => {
      if (!campaignId) return null

      // Get stats from email_sends table
      const { data: sends, error } = await supabase
        .from('email_sends')
        .select('status, opened_at, clicked_at')
        .eq('campaign_id', campaignId)

      if (error) throw error

      const total = sends?.length || 0
      const delivered = sends?.filter(s => s.status === 'delivered' || s.status === 'opened' || s.status === 'clicked').length || 0
      const opened = sends?.filter(s => s.opened_at !== null).length || 0
      const clicked = sends?.filter(s => s.clicked_at !== null).length || 0
      const bounced = sends?.filter(s => s.status === 'bounced').length || 0
      const unsubscribed = sends?.filter(s => s.status === 'unsubscribed').length || 0

      return {
        total,
        delivered,
        opened,
        clicked,
        bounced,
        unsubscribed,
        deliveredRate: total > 0 ? (delivered / total) * 100 : 0,
        openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
        clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
        bounceRate: total > 0 ? (bounced / total) * 100 : 0,
      }
    },
    enabled: !!campaignId,
  })
}

export function useCampaignRecipients(campaignId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['campaign-recipients', campaignId],
    queryFn: async () => {
      if (!campaignId) return []

      const { data, error } = await supabase
        .from('email_sends')
        .select(`
          id,
          status,
          sent_at,
          opened_at,
          clicked_at,
          contact:contacts(id, first_name, last_name, email)
        `)
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!campaignId,
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
