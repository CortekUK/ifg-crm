import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Campaign, CampaignFilters, CreateCampaignInput, UpdateCampaignInput } from '@/lib/types/campaigns'

/**
 * Resolve a campaign's audience ids into display rows.
 *
 * Counts come from the aggregate RPCs, not from selecting join rows: both
 * contact_lists (303k rows) and contact_tags (352k rows) exceed PostgREST's
 * 1,000-row response cap, which is why list counts here previously flattened
 * out and tag counts showed as zero.
 */
async function hydrateAudience(
  supabase: ReturnType<typeof createClient>,
  listIds: string[],
  tagIds: string[],
  stageIds: string[]
) {
  const [listRes, tagRes, stageRes, listCounts, tagCounts, stageDeals] = await Promise.all([
    listIds.length
      ? supabase.from('lists').select('id, name').in('id', listIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    tagIds.length
      ? supabase.from('tags').select('id, name, color').in('id', tagIds)
      : Promise.resolve({ data: [] as { id: string; name: string; color: string | null }[] }),
    stageIds.length
      ? supabase
          .from('pipeline_stages')
          .select('id, name, color, pipeline:pipelines(name)')
          .in('id', stageIds)
      : Promise.resolve({ data: [] as never[] }),
    listIds.length ? supabase.rpc('get_list_contact_counts') : Promise.resolve({ data: null }),
    tagIds.length ? supabase.rpc('get_tag_contact_counts') : Promise.resolve({ data: null }),
    // Safe to count client-side: deals is a small table, unlike the contact
    // join tables above.
    stageIds.length
      ? supabase
          .from('deals')
          .select('current_stage_id')
          .in('current_stage_id', stageIds)
          .is('won_at', null)
          .is('lost_at', null)
      : Promise.resolve({ data: null }),
  ])

  const listCountMap = new Map<string, number>()
  ;(listCounts.data as { list_id: string; contact_count: number }[] | null)?.forEach((c) =>
    listCountMap.set(c.list_id, Number(c.contact_count))
  )

  const tagCountMap = new Map<string, number>()
  ;(tagCounts.data as { tag_id: string; contact_count: number }[] | null)?.forEach((c) =>
    tagCountMap.set(c.tag_id, Number(c.contact_count))
  )

  const stageCountMap = new Map<string, number>()
  ;(stageDeals.data as { current_stage_id: string }[] | null)?.forEach((d) =>
    stageCountMap.set(d.current_stage_id, (stageCountMap.get(d.current_stage_id) || 0) + 1)
  )

  return {
    recipient_lists: (listRes.data || []).map((l) => ({
      id: l.id,
      name: l.name,
      contact_count: listCountMap.get(l.id) || 0,
    })),
    recipient_tags: (tagRes.data || []).map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color ?? null,
      contact_count: tagCountMap.get(t.id) || 0,
    })),
    recipient_stages: (
      (stageRes.data || []) as unknown as {
        id: string
        name: string
        color: string | null
        pipeline: { name: string } | { name: string }[] | null
      }[]
    ).map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      pipeline_name: Array.isArray(s.pipeline) ? s.pipeline[0]?.name : s.pipeline?.name,
      deal_count: stageCountMap.get(s.id) || 0,
    })),
  }
}

export function useCampaigns(filters?: CampaignFilters) {
  const supabase = createClient()

  return useQuery<Campaign[]>({
    queryKey: ['campaigns', filters],
    // Poll every 3 seconds when any campaign is in "sending" status
    refetchInterval: (query) => {
      const data = query.state.data
      const hasSending = data?.some((c) => c.status === 'sending')
      return hasSending ? 3000 : false
    },
    queryFn: async () => {
      let query = supabase
        .from('campaigns')
        .select(`
          *,
          template:email_templates(*),
          from_user:profiles!campaigns_from_user_id_fkey(id, email, full_name),
          created_by:profiles!campaigns_created_by_id_fkey(id, email, full_name),
          pipeline:pipelines(id, name, programme_id, programme:programmes(id, name))
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
      if (filters?.pipelineId && filters.pipelineId !== 'all') {
        if (filters.pipelineId === 'generic') {
          query = query.is('pipeline_id', null)
        } else {
          query = query.eq('pipeline_id', filters.pipelineId)
        }
      }

      const { data: campaigns, error } = await query

      if (error) throw error
      if (!campaigns || campaigns.length === 0) return []

      // Resolve every audience id referenced across the whole page in one
      // round trip, then attach the rows back onto each campaign.
      const listIds = new Set<string>()
      const tagIds = new Set<string>()
      const stageIds = new Set<string>()
      campaigns.forEach((c) => {
        ;(c.recipient_list_ids || []).forEach((id: string) => listIds.add(id))
        ;(c.recipient_tag_ids || []).forEach((id: string) => tagIds.add(id))
        ;(c.recipient_stage_ids || []).forEach((id: string) => stageIds.add(id))
      })

      const audience = await hydrateAudience(
        supabase,
        Array.from(listIds),
        Array.from(tagIds),
        Array.from(stageIds)
      )

      const listsMap = new Map(audience.recipient_lists.map((l) => [l.id, l]))
      const tagsMap = new Map(audience.recipient_tags.map((t) => [t.id, t]))
      const stagesMap = new Map(audience.recipient_stages.map((st) => [st.id, st]))

      return campaigns.map((campaign) => ({
        ...campaign,
        recipient_lists: (campaign.recipient_list_ids || [])
          .map((id: string) => listsMap.get(id))
          .filter(Boolean),
        recipient_tags: (campaign.recipient_tag_ids || [])
          .map((id: string) => tagsMap.get(id))
          .filter(Boolean),
        recipient_stages: (campaign.recipient_stage_ids || [])
          .map((id: string) => stagesMap.get(id))
          .filter(Boolean),
      }))
    },
  })
}

export function useCampaign(campaignId: string | null) {
  const supabase = createClient()

  return useQuery<Campaign | null>({
    queryKey: ['campaign', campaignId],
    // Poll every 3 seconds when campaign is in "sending" status
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.status === 'sending' ? 3000 : false
    },
    queryFn: async () => {
      if (!campaignId) return null

      const { data: campaign, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          template:email_templates(*),
          from_user:profiles!campaigns_from_user_id_fkey(id, email, full_name),
          created_by:profiles!campaigns_created_by_id_fkey(id, email, full_name),
          pipeline:pipelines(id, name, programme_id, programme:programmes(id, name))
        `)
        .eq('id', campaignId)
        .single()

      if (error) throw error
      if (!campaign) return null

      const audience = await hydrateAudience(
        supabase,
        campaign.recipient_list_ids || [],
        campaign.recipient_tag_ids || [],
        campaign.recipient_stage_ids || []
      )

      return {
        ...campaign,
        ...audience,
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
          recipient_tag_ids: campaign.recipient_tag_ids || [],
          recipient_stage_ids: campaign.recipient_stage_ids || [],
          pipeline_id: campaign.pipeline_id || null,
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
      if (input.recipient_tag_ids !== undefined) updates.recipient_tag_ids = input.recipient_tag_ids
      if (input.recipient_stage_ids !== undefined) updates.recipient_stage_ids = input.recipient_stage_ids
      if (input.pipeline_id !== undefined) updates.pipeline_id = input.pipeline_id

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
          recipient_tag_ids: original.recipient_tag_ids,
          recipient_stage_ids: original.recipient_stage_ids,
          pipeline_id: original.pipeline_id,
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

export function useCampaignStats(campaignId: string | null, isSending?: boolean) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['campaign-stats', campaignId],
    // Poll every 3 seconds while campaign is sending
    refetchInterval: isSending ? 3000 : false,
    queryFn: async () => {
      if (!campaignId) return null

      // Get stats from email_sends table (tracks ALL sends including resends)
      const { data: sends, error } = await supabase
        .from('email_sends')
        .select('id, status, delivered_at, opened_at, clicked_at, bounced_at, recipient_contact_id')
        .eq('campaign_id', campaignId)

      if (error) throw error

      if (!sends || sends.length === 0) {
        return {
          total: 0,
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          failed: 0,
          uniqueRecipients: 0,
          deliveredRate: 0,
          openRate: 0,
          clickRate: 0,
          bounceRate: 0,
        }
      }

      const total = sends.length
      // Count emails that were successfully sent
      const sent = sends.filter(s => ['sent', 'delivered', 'opened', 'clicked'].includes(s.status)).length
      // Count delivered (sent = delivered for Resend, or explicit delivered_at)
      const delivered = sends.filter(s =>
        s.delivered_at !== null ||
        ['sent', 'delivered', 'opened', 'clicked'].includes(s.status)
      ).length
      const opened = sends.filter(s => s.opened_at !== null || s.status === 'opened' || s.status === 'clicked').length
      const clicked = sends.filter(s => s.clicked_at !== null || s.status === 'clicked').length
      const bounced = sends.filter(s => s.bounced_at !== null || s.status === 'bounced').length
      const failed = sends.filter(s => s.status === 'failed').length

      // Get unique recipients count
      const uniqueRecipients = new Set(sends.map(s => s.recipient_contact_id).filter(Boolean)).size

      return {
        total,
        sent,
        delivered,
        opened,
        clicked,
        bounced,
        failed,
        uniqueRecipients,
        deliveredRate: total > 0 ? (delivered / total) * 100 : 0,
        openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
        clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
        bounceRate: total > 0 ? (bounced / total) * 100 : 0,
      }
    },
    enabled: !!campaignId,
  })
}

export function useCampaignRecipients(campaignId: string | null, isSending?: boolean) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['campaign-recipients', campaignId],
    // Poll every 3 seconds while campaign is sending
    refetchInterval: isSending ? 3000 : false,
    queryFn: async () => {
      if (!campaignId) return []

      // Query email_sends table for full send history (includes all resends)
      const { data: sends, error } = await supabase
        .from('email_sends')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false })

      if (error) throw error
      if (!sends || sends.length === 0) return []

      // Fetch contact info for recipients
      const contactIds = [...new Set(sends.map(s => s.recipient_contact_id).filter(Boolean))]
      const contactsMap = new Map<string, { id: string; first_name: string; last_name: string; email: string }>()

      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email')
          .in('id', contactIds)

        contacts?.forEach(c => {
          contactsMap.set(c.id, c)
        })
      }

      // Combine sends with contact info
      return sends.map(send => ({
        ...send,
        contact: send.recipient_contact_id ? contactsMap.get(send.recipient_contact_id) : null
      }))
    },
    enabled: !!campaignId,
  })
}

// Audience size for a saved campaign, across all three sources. Uses the same
// SQL the sender does — the previous client-side count was capped at 1,000 by
// PostgREST and under-reported every real audience.
export function useCalculateRecipients(
  listIds: string[],
  tagIds: string[] = [],
  stageIds: string[] = []
) {
  const supabase = createClient()

  return useQuery<{ count: number }>({
    queryKey: ['campaign-audience-count', listIds, tagIds, stageIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('campaign_audience_count', {
        p_list_ids: listIds,
        p_tag_ids: tagIds,
        p_stage_ids: stageIds,
        p_type: 'email',
      })

      if (error) throw error
      return { count: Number(data ?? 0) }
    },
    enabled: listIds.length > 0 || tagIds.length > 0 || stageIds.length > 0,
    staleTime: 30_000,
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

      if (!lists || lists.length === 0) return []

      // Get contact counts via RPC (avoids Supabase default row limit)
      const { data: counts } = await supabase.rpc('get_list_contact_counts')

      const countMap = new Map<string, number>()
      counts?.forEach((c: { list_id: string; contact_count: number }) => {
        countMap.set(c.list_id, c.contact_count)
      })

      return lists.map((list) => ({
        ...list,
        contact_count: countMap.get(list.id) || 0,
      }))
    },
  })
}

export function useEmailTemplates() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .neq('is_draft', true)
        .order('name')

      if (error) throw error

      // Campaign-category templates first, then the rest alphabetically —
      // the picker groups on this order.
      return (data || []).sort((a, b) => {
        const rank = (c: string) => (c === 'campaign' ? 0 : c === 'automation' ? 1 : 2)
        return rank(a.category) - rank(b.category) || a.name.localeCompare(b.name)
      })
    },
  })
}

export function useSendCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send campaign')
      }

      return response.json()
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
  })
}

export function useBatchDeleteCampaigns() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignIds: string[]) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .in('id', campaignIds)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useResendCampaign() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId: string) => {
      // Reset all campaign_recipients to pending status
      const { error: resetError } = await supabase
        .from('campaign_recipients')
        .update({
          status: 'pending',
          sent_at: null,
          delivered_at: null,
          opened_at: null,
          clicked_at: null,
          error_message: null,
          resend_message_id: null,
        })
        .eq('campaign_id', campaignId)

      if (resetError) throw resetError

      // Get total recipients count
      const { count } = await supabase
        .from('campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)

      // Set campaign to "sending" status immediately for UI feedback
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({
          status: 'sending',
          scheduled_at: new Date().toISOString(),
          sent_at: null,
          total_recipients: count || 0,
          processed_recipients: 0,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)

      if (updateError) throw updateError

      // Trigger processing via API (don't await - let it run in background)
      fetch(`/api/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {})

      return { success: true, campaignId }
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['campaign-recipients', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['campaign-stats', campaignId] })
    },
  })
}
