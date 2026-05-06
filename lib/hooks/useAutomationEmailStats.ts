import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface AutomationStepEmailStats {
  stepId: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  failed: number
  openRate: number
  clickRate: number
}

export interface AutomationEmailStatsResult {
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalFailed: number
  avgOpenRate: number
  avgClickRate: number
  byStep: Record<string, AutomationStepEmailStats>
}

/**
 * Resolve which automation_enrollments rows count as "this automation's
 * activity". Default is exact match on automation_id.
 *
 * When `followDealChain` is true (used for deal_creation automations,
 * which never send emails themselves) we widen the lens: get this
 * automation's enrollments → their deal_ids → ALL enrollments for those
 * deals across every automation. So a deal_creation row can surface
 * emails / replies / exits driven by the initial_contact automation
 * that fired immediately after the deal was created.
 */
async function resolveEnrollmentIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  automationId: string,
  followDealChain: boolean,
): Promise<string[]> {
  const { data: own } = await supabase
    .from('automation_enrollments')
    .select('id, deal_id')
    .eq('automation_id', automationId)
  if (!own || own.length === 0) return []
  if (!followDealChain) return own.map((e: { id: string }) => e.id)
  const dealIds = [
    ...new Set(
      (own as { deal_id: string | null }[]).map((e) => e.deal_id).filter(Boolean) as string[],
    ),
  ]
  if (dealIds.length === 0) return own.map((e: { id: string }) => e.id)
  const { data: chained } = await supabase
    .from('automation_enrollments')
    .select('id')
    .in('deal_id', dealIds)
  return chained?.map((e: { id: string }) => e.id) ?? own.map((e: { id: string }) => e.id)
}

/**
 * Queries email_sends via automation_logs to get real delivery stats
 * for an automation, broken down by step.
 */
export function useAutomationEmailStats(
  automationId: string | null,
  options: { followDealChain?: boolean } = {},
) {
  const supabase = createClient()
  const followDealChain = options.followDealChain === true

  return useQuery<AutomationEmailStatsResult>({
    queryKey: ['automation-email-stats', automationId, followDealChain],
    queryFn: async () => {
      if (!automationId) {
        return {
          totalSent: 0, totalDelivered: 0, totalOpened: 0,
          totalClicked: 0, totalBounced: 0, totalFailed: 0,
          avgOpenRate: 0, avgClickRate: 0,
          byStep: {},
        }
      }

      const enrollmentIdList = await resolveEnrollmentIds(supabase, automationId, followDealChain)

      if (enrollmentIdList.length === 0) {
        return {
          totalSent: 0, totalDelivered: 0, totalOpened: 0,
          totalClicked: 0, totalBounced: 0, totalFailed: 0,
          avgOpenRate: 0, avgClickRate: 0,
          byStep: {},
        }
      }

      const { data: logs, error: logsError } = await supabase
        .from('automation_logs')
        .select('id, step_id')
        .in('enrollment_id', enrollmentIdList)
        .eq('log_type', 'email_sent')

      if (logsError) throw logsError
      if (!logs || logs.length === 0) {
        return {
          totalSent: 0, totalDelivered: 0, totalOpened: 0,
          totalClicked: 0, totalBounced: 0, totalFailed: 0,
          avgOpenRate: 0, avgClickRate: 0,
          byStep: {},
        }
      }

      const logIds = logs.map((l) => l.id)
      const logToStep = new Map<string, string>()
      logs.forEach((l) => {
        if (l.step_id) logToStep.set(l.id, l.step_id)
      })

      // Get all email_sends for these automation_log_ids
      const { data: sends, error: sendsError } = await supabase
        .from('email_sends')
        .select('id, automation_log_id, status, delivered_at, opened_at, clicked_at, bounced_at')
        .in('automation_log_id', logIds)

      if (sendsError) throw sendsError

      // Aggregate by step
      const byStep: Record<string, AutomationStepEmailStats> = {}
      let totalSent = 0
      let totalDelivered = 0
      let totalOpened = 0
      let totalClicked = 0
      let totalBounced = 0
      let totalFailed = 0

      for (const send of (sends || [])) {
        const stepId = send.automation_log_id ? logToStep.get(send.automation_log_id) : undefined
        if (!stepId) continue

        if (!byStep[stepId]) {
          byStep[stepId] = {
            stepId,
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            bounced: 0,
            failed: 0,
            openRate: 0,
            clickRate: 0,
          }
        }

        const stats = byStep[stepId]
        stats.sent++
        totalSent++

        const isDelivered = send.delivered_at !== null ||
          ['sent', 'delivered', 'opened', 'clicked'].includes(send.status)
        if (isDelivered) {
          stats.delivered++
          totalDelivered++
        }
        if (send.opened_at !== null || send.status === 'opened' || send.status === 'clicked') {
          stats.opened++
          totalOpened++
        }
        if (send.clicked_at !== null || send.status === 'clicked') {
          stats.clicked++
          totalClicked++
        }
        if (send.bounced_at !== null || send.status === 'bounced') {
          stats.bounced++
          totalBounced++
        }
        if (send.status === 'failed') {
          stats.failed++
          totalFailed++
        }
      }

      // Calculate rates per step
      for (const stats of Object.values(byStep)) {
        stats.openRate = stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0
        stats.clickRate = stats.delivered > 0 ? (stats.clicked / stats.delivered) * 100 : 0
      }

      const avgOpenRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0
      const avgClickRate = totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0

      return {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        totalFailed,
        avgOpenRate,
        avgClickRate,
        byStep,
      }
    },
    enabled: !!automationId,
  })
}

export interface AutomationEmailSend {
  id: string
  recipient_email: string
  status: string
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
  bounced_at: string | null
  open_count: number
  click_count: number
  error_message: string | null
  step_id: string | null
  contact: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

/**
 * Fetches all email_sends for an automation with contact details,
 * optionally filtered by status for drill-down views.
 *
 * Set `followDealChain: true` for deal_creation automations so the
 * Emails tab surfaces emails sent by the initial_contact automation
 * that ran on the same deals.
 */
export function useAutomationEmailSends(
  automationId: string | null,
  statusFilter?: string | null,
  options: { followDealChain?: boolean } = {},
) {
  const supabase = createClient()
  const followDealChain = options.followDealChain === true

  return useQuery<AutomationEmailSend[]>({
    queryKey: ['automation-email-sends', automationId, statusFilter, followDealChain],
    queryFn: async () => {
      if (!automationId) return []

      const enrollmentIdList = await resolveEnrollmentIds(supabase, automationId, followDealChain)
      if (enrollmentIdList.length === 0) return []

      // Get automation logs with step_id
      const { data: logs } = await supabase
        .from('automation_logs')
        .select('id, step_id')
        .in('enrollment_id', enrollmentIdList)
        .eq('log_type', 'email_sent')

      if (!logs || logs.length === 0) return []

      const logIds = logs.map((l) => l.id)
      const logToStep = new Map<string, string>()
      logs.forEach((l) => {
        if (l.step_id) logToStep.set(l.id, l.step_id)
      })

      // Get email sends
      let query = supabase
        .from('email_sends')
        .select('id, recipient_email, recipient_contact_id, automation_log_id, status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, open_count, click_count, error_message')
        .in('automation_log_id', logIds)
        .order('sent_at', { ascending: false })

      // Apply status filter for drill-down
      if (statusFilter) {
        switch (statusFilter) {
          case 'delivered':
            query = query.not('delivered_at', 'is', null)
            break
          case 'opened':
            query = query.not('opened_at', 'is', null)
            break
          case 'clicked':
            query = query.not('clicked_at', 'is', null)
            break
          case 'bounced':
            query = query.eq('status', 'bounced')
            break
          case 'failed':
            query = query.eq('status', 'failed')
            break
        }
      }

      const { data: sends, error } = await query
      if (error) throw error
      if (!sends || sends.length === 0) return []

      // Fetch contact info
      const contactIds = [...new Set(sends.map((s) => s.recipient_contact_id).filter(Boolean))]
      const contactsMap = new Map<string, { id: string; first_name: string | null; last_name: string | null; email: string }>()

      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email')
          .in('id', contactIds)

        contacts?.forEach((c) => contactsMap.set(c.id, c))
      }

      return sends.map((send) => ({
        id: send.id,
        recipient_email: send.recipient_email,
        status: send.status,
        sent_at: send.sent_at,
        delivered_at: send.delivered_at,
        opened_at: send.opened_at,
        clicked_at: send.clicked_at,
        bounced_at: send.bounced_at,
        open_count: send.open_count || 0,
        click_count: send.click_count || 0,
        error_message: send.error_message,
        step_id: send.automation_log_id ? logToStep.get(send.automation_log_id) || null : null,
        contact: send.recipient_contact_id ? contactsMap.get(send.recipient_contact_id) || null : null,
      }))
    },
    enabled: !!automationId,
  })
}
