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
  avgOpenRate: number
  avgClickRate: number
  byStep: Record<string, AutomationStepEmailStats>
}

/**
 * Queries email_sends via automation_logs to get real delivery stats
 * for an automation, broken down by step.
 */
export function useAutomationEmailStats(automationId: string | null) {
  const supabase = createClient()

  return useQuery<AutomationEmailStatsResult>({
    queryKey: ['automation-email-stats', automationId],
    queryFn: async () => {
      if (!automationId) {
        return {
          totalSent: 0, totalDelivered: 0, totalOpened: 0,
          totalClicked: 0, totalBounced: 0, avgOpenRate: 0, avgClickRate: 0,
          byStep: {},
        }
      }

      // Get all automation_logs for this automation via enrollments
      // automation_logs → enrollment_id → automation_enrollments.automation_id
      const { data: enrollmentIds } = await supabase
        .from('automation_enrollments')
        .select('id')
        .eq('automation_id', automationId)

      if (!enrollmentIds || enrollmentIds.length === 0) {
        return {
          totalSent: 0, totalDelivered: 0, totalOpened: 0,
          totalClicked: 0, totalBounced: 0, avgOpenRate: 0, avgClickRate: 0,
          byStep: {},
        }
      }

      const { data: logs, error: logsError } = await supabase
        .from('automation_logs')
        .select('id, step_id')
        .in('enrollment_id', enrollmentIds.map((e) => e.id))
        .eq('log_type', 'email_sent')

      if (logsError) throw logsError
      if (!logs || logs.length === 0) {
        return {
          totalSent: 0, totalDelivered: 0, totalOpened: 0,
          totalClicked: 0, totalBounced: 0, avgOpenRate: 0, avgClickRate: 0,
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
        avgOpenRate,
        avgClickRate,
        byStep,
      }
    },
    enabled: !!automationId,
  })
}
