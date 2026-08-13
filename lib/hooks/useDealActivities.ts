import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface DealActivity {
  id: string
  deal_id: string
  activity_type: string
  description: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  performed_by_id: string | null
  created_at: string
  performed_by?: {
    id: string
    full_name: string | null
    email: string
  } | null
}

export interface DealEmailActivity {
  id: string
  recipient_email: string
  subject: string
  body_html: string | null
  body_text: string | null
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
  bounced_at: string | null
  complained_at: string | null
  status: string | null
  error_message: string | null
  from_name: string | null
  from_email: string | null
  campaign?: {
    name: string
    body_html: string | null
  } | null
  automation_log?: {
    deal_id: string
    step?: {
      email_template?: {
        body_html: string
      } | null
    } | null
  } | null
}

export interface DealEmailReplyActivity {
  id: string
  contact_id: string | null
  deal_id: string | null
  pipeline_id: string | null
  email_send_id: string | null
  from_email: string | null
  from_name: string | null
  to_email: string | null
  subject: string | null
  body: string | null
  body_preview: string | null
  html_body: string | null
  ai_intent: string | null
  match_status: string | null
  received_at: string | null
  created_at: string | null
}

export function useDealActivities(dealId: string | null) {
  const supabase = createClient()

  return useQuery<DealActivity[]>({
    queryKey: ['deal-activities', dealId],
    queryFn: async () => {
      if (!dealId) return []

      const { data, error } = await supabase
        .from('deal_activities')
        .select(`
          *,
          performed_by:profiles(id, full_name, email)
        `)
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!dealId,
  })
}

/**
 * Email history belongs to the contact, not just one automation enrollment.
 * This lets a recruiter see every campaign/manual/automation email the lead
 * received while viewing any of that contact's deals.
 */
export function useDealEmailActivities(contactId: string | null) {
  const supabase = createClient()

  return useQuery<DealEmailActivity[]>({
    queryKey: ['deal-email-activities', contactId],
    queryFn: async () => {
      if (!contactId) return []

      const { data, error } = await supabase
        .from('email_sends')
        .select(`
          *,
          campaign:campaigns(name, body_html),
          automation_log:automation_logs(
            deal_id,
            step:automation_steps(
              email_template:email_templates(body_html)
            )
          )
        `)
        .eq('recipient_contact_id', contactId)
        .order('sent_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return (data || []) as DealEmailActivity[]
    },
    enabled: !!contactId,
    refetchInterval: 30_000,
  })
}

export function useDealEmailReplyActivities(
  dealId: string | null,
  contactId: string | null,
  pipelineId: string | null
) {
  const supabase = createClient()

  return useQuery<DealEmailReplyActivity[]>({
    queryKey: ['deal-email-reply-activities', dealId, contactId, pipelineId],
    queryFn: async () => {
      if (!contactId) return []

      const { data, error } = await supabase
        .from('email_replies')
        .select('*')
        .eq('contact_id', contactId)
        .neq('match_status', 'spam')
        .order('received_at', { ascending: false })
        .limit(100)

      if (error) throw error

      // Prefer an explicit deal link. Older inbound rows generally predate
      // deal_id population, so retain replies linked to this deal's pipeline;
      // replies with no pipeline metadata are still useful contact history.
      return ((data || []) as DealEmailReplyActivity[]).filter((reply) =>
        reply.deal_id === dealId ||
        (!reply.deal_id && (!reply.pipeline_id || reply.pipeline_id === pipelineId))
      )
    },
    enabled: !!contactId,
    refetchInterval: 30_000,
  })
}

export function useAddDealNote() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dealId,
      note,
      performedById,
    }: {
      dealId: string
      note: string
      performedById: string
    }) => {
      const { error } = await supabase.from('deal_activities').insert({
        deal_id: dealId,
        activity_type: 'note_added',
        description: note,
        performed_by_id: performedById,
      })

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-activities', variables.dealId] })
    },
  })
}

export function useLogDealActivity() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dealId,
      activityType,
      description,
      oldValue,
      newValue,
      performedById,
    }: {
      dealId: string
      activityType: string
      description: string
      oldValue?: Record<string, unknown>
      newValue?: Record<string, unknown>
      performedById?: string
    }) => {
      const { error } = await supabase.from('deal_activities').insert({
        deal_id: dealId,
        activity_type: activityType,
        description,
        old_value: oldValue || null,
        new_value: newValue || null,
        performed_by_id: performedById || null,
      })

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-activities', variables.dealId] })
    },
  })
}
