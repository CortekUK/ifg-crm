// Surface "what happened to people who went through this automation" data
// for the Replies and Exited tabs on the automation detail sheet.
//
// Reply path: automation → enrollments → automation_logs → email_sends →
//             email_replies (joined on email_send_id).
// Exit path:  automation → enrollments → deals; an enrollment is "exited"
//             when the deal has moved past the automation's trigger
//             (initial) stage in display_order. Won/lost rolls in too —
//             those are exits.

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchAll, fetchAllByIds } from '@/lib/reports/csv'

export interface AutomationReply {
  id: string
  from_email: string
  from_name: string | null
  subject: string | null
  body_preview: string | null
  ai_intent: string | null
  received_at: string
  email_send_id: string | null
  contact: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

export function useAutomationReplies(
  automationId: string | null,
  options: { followDealChain?: boolean } = {},
) {
  const supabase = createClient()
  const followDealChain = options.followDealChain === true

  return useQuery<AutomationReply[]>({
    queryKey: ['automation-replies', automationId, followDealChain],
    queryFn: async () => {
      if (!automationId) return []

      // Walk the same chain as the email-stats hook: enrollments → logs →
      // email_sends, then pull replies whose email_send_id matches.
      // For deal_creation, follow each enrollment's deal_id to pull in
      // ALL enrollments for those deals (so replies driven by the
      // initial_contact automation that ran on the same deal surface
      // here too).
      // Every link in this chain outgrows 1000 rows: enrollments (1,193),
      // automation_logs (2,318 — 1,938 on one automation) and email_sends
      // (2,296). Unpaged, the Replies tab silently showed the replies that
      // happened to survive truncation at each hop (QA-61).
      const own = await fetchAll<{ id: string; deal_id: string | null }>(() =>
        supabase.from('automation_enrollments').select('id, deal_id').eq('automation_id', automationId),
      )
      if (!own || own.length === 0) return []
      let enrollmentIdList: string[] = own.map((e) => e.id)
      if (followDealChain) {
        const dealIds = [
          ...new Set(
            (own as { deal_id: string | null }[]).map((e) => e.deal_id).filter(Boolean) as string[],
          ),
        ]
        if (dealIds.length > 0) {
          const chained = await fetchAllByIds<{ id: string }>(
            (ids) => supabase.from('automation_enrollments').select('id').in('deal_id', ids),
            dealIds,
          )
          if (chained.length > 0) enrollmentIdList = chained.map((e) => e.id)
        }
      }

      const logs = await fetchAllByIds<{ id: string }>(
        (ids) =>
          supabase
            .from('automation_logs')
            .select('id')
            .in('enrollment_id', ids)
            .eq('log_type', 'email_sent'),
        enrollmentIdList,
      )
      if (!logs || logs.length === 0) return []

      const sends = await fetchAllByIds<{ id: string }>(
        (ids) => supabase.from('email_sends').select('id').in('automation_log_id', ids),
        logs.map((l) => l.id),
      )
      if (!sends || sends.length === 0) return []

      const sendIds = sends.map((s) => s.id)
      const replies = await fetchAllByIds<{
        id: string
        from_email: string
        from_name: string | null
        subject: string | null
        body_preview: string | null
        ai_intent: string | null
        received_at: string
        email_send_id: string | null
        contact_id: string | null
      }>(
        (ids) =>
          supabase
            .from('email_replies')
            .select(
              'id, from_email, from_name, subject, body_preview, ai_intent, received_at, email_send_id, contact_id',
            )
            .in('email_send_id', ids)
            .order('received_at', { ascending: false }),
        sendIds,
      )
      if (!replies || replies.length === 0) return []

      const contactIds = [...new Set(replies.map((r) => r.contact_id).filter(Boolean))]
      const contactsMap = new Map<
        string,
        { id: string; first_name: string | null; last_name: string | null; email: string }
      >()
      if (contactIds.length > 0) {
        const contacts = await fetchAllByIds<{
          id: string
          first_name: string | null
          last_name: string | null
          email: string
        }>(
          (ids) => supabase.from('contacts').select('id, first_name, last_name, email').in('id', ids),
          contactIds as string[],
        )
        contacts.forEach((c) => contactsMap.set(c.id, c))
      }

      return replies.map((r) => ({
        id: r.id,
        from_email: r.from_email,
        from_name: r.from_name,
        subject: r.subject,
        body_preview: r.body_preview,
        ai_intent: r.ai_intent,
        received_at: r.received_at,
        email_send_id: r.email_send_id,
        contact: r.contact_id ? contactsMap.get(r.contact_id) ?? null : null,
      }))
    },
    enabled: !!automationId,
  })
}

export interface AutomationExitedDeal {
  enrollment_id: string
  deal_id: string
  contact: {
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
  current_stage: { id: string; name: string; display_order: number } | null
  initial_stage: { id: string; name: string; display_order: number } | null
  status: 'active' | 'won' | 'lost'
  exited_at: string | null
}

export function useAutomationExited(
  automationId: string | null,
  // For most automations this is the trigger stage. For deal_creation
  // (whose trigger is form_submission, not a stage) the caller passes
  // the configured `initial_stage_id` instead — that's where the new
  // deal lands, so any deal sitting beyond it counts as "exited".
  triggerStageId: string | null,
  pipelineId: string | null,
) {
  const supabase = createClient()

  return useQuery<AutomationExitedDeal[]>({
    queryKey: ['automation-exited', automationId, triggerStageId, pipelineId],
    queryFn: async () => {
      if (!automationId || !triggerStageId || !pipelineId) return []

      // 1. Pull stages for this pipeline so we can map ids → display_order
      //    and decide which stage is "past" the initial one.
      const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('id, name, display_order')
        .eq('pipeline_id', pipelineId)
        .order('display_order', { ascending: true })
      if (!stages || stages.length === 0) return []
      const initial = stages.find((s) => s.id === triggerStageId)
      if (!initial) return []
      const stageById = new Map(stages.map((s) => [s.id, s]))

      // 2. Pull every enrollment for this automation with its deal joined.
      //    Paged — "every" meant the first 1000 before, so the Exited tab
      //    under-counted on the busiest automations (QA-61).
      const enrollments = await fetchAll<{
        id: string
        deal_id: string
        completed_at: string | null
        deal: unknown
      }>(() =>
        supabase
          .from('automation_enrollments')
          .select(
            `id, deal_id, completed_at,
             deal:deals(id, status, current_stage_id,
               contact:contacts(first_name, last_name, email))`,
          )
          .eq('automation_id', automationId),
      )
      if (!enrollments) return []

      // 3. Filter to deals whose current stage is past the initial stage.
      //    Won/lost deals always count as exited even if their cached
      //    current_stage_id is still the initial one (they got there via
      //    the won/lost flow which doesn't always advance the stage).
      const out: AutomationExitedDeal[] = []
      for (const e of enrollments) {
        const deal = (e.deal as unknown) as
          | {
              id: string
              status: 'active' | 'won' | 'lost'
              current_stage_id: string | null
              contact?: {
                first_name: string | null
                last_name: string | null
                email: string | null
              } | null
            }
          | null
        if (!deal) continue
        const current = deal.current_stage_id ? stageById.get(deal.current_stage_id) ?? null : null
        const isPast =
          current && current.display_order > initial.display_order
        const isClosed = deal.status === 'won' || deal.status === 'lost'
        if (!isPast && !isClosed) continue

        out.push({
          enrollment_id: e.id,
          deal_id: deal.id,
          contact: deal.contact ?? null,
          current_stage: current,
          initial_stage: initial,
          status: deal.status,
          exited_at: (e as { completed_at?: string | null }).completed_at ?? null,
        })
      }
      return out
    },
    enabled: !!automationId && !!triggerStageId && !!pipelineId,
  })
}
