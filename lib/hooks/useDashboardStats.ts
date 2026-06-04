'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface DashboardStats {
  totalLeads: number
  totalLeadsTrend: number
  unmatchedReplies: number
  unmatchedRepliesTrend: number
  activeProgrammes: number
  activeProgrammesTrend: number
  todayActivities: number
  todayActivitiesTrend: number
  // Legacy fields for backwards compatibility
  totalContacts: number
  totalDeals: number
  totalDealValue: number
  dealsWon: number
  totalRevenue: number
  monthRevenue: number
  overdueInvoices: number
}

export function useDashboardStats() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      // Date calculations
      const now = new Date()
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)

      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      // =====================
      // BATCH 1: All independent count queries in parallel
      // =====================
      const [
        totalLeadsResult,
        leadsThisMonthResult,
        leadsLastMonthResult,
        unmatchedSMSResult,
        unmatchedEmailsResult,
        unmatchedSMSLastMonthResult,
        unmatchedEmailsLastMonthResult,
        activeProgrammesResult,
        activeProgrammesLastMonthResult,
        totalContactsResult,
        dealValuesResult,
        paidInvoicesResult,
        monthInvoicesResult,
        overdueInvoicesResult,
      ] = await Promise.all([
        // Total leads
        supabase.from('deals').select('*', { count: 'exact', head: true }),
        // Leads this month
        supabase.from('deals').select('*', { count: 'exact', head: true })
          .gte('created_at', firstOfMonth.toISOString()),
        // Leads last month
        supabase.from('deals').select('*', { count: 'exact', head: true })
          .gte('created_at', firstOfLastMonth.toISOString())
          .lte('created_at', lastOfLastMonth.toISOString()),
        // Unmatched SMS
        supabase.from('sms_messages').select('*', { count: 'exact', head: true })
          .eq('match_status', 'unmatched').eq('direction', 'inbound'),
        // Unmatched emails
        supabase.from('email_replies').select('*', { count: 'exact', head: true })
          .eq('match_status', 'unmatched'),
        // Unmatched SMS last month
        supabase.from('sms_messages').select('*', { count: 'exact', head: true })
          .eq('match_status', 'unmatched').eq('direction', 'inbound')
          .lte('created_at', lastOfLastMonth.toISOString()),
        // Unmatched emails last month
        supabase.from('email_replies').select('*', { count: 'exact', head: true })
          .eq('match_status', 'unmatched')
          .lte('created_at', lastOfLastMonth.toISOString()),
        // Active programmes
        supabase.from('pipelines').select('*', { count: 'exact', head: true })
          .eq('is_active', true),
        // Active programmes last month
        supabase.from('pipelines').select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .lte('created_at', lastOfLastMonth.toISOString()),
        // Total contacts
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        // Deal values (current_stage_id needed to exclude lost/dead deals)
        supabase.from('deals').select('deal_value, current_stage_id'),
        // Paid invoices (total revenue)
        supabase.from('invoices').select('amount').eq('status', 'paid'),
        // Month invoices
        supabase.from('invoices').select('amount').eq('status', 'paid')
          .gte('paid_at', firstOfMonth.toISOString()),
        // Overdue invoices
        supabase.from('invoices').select('*', { count: 'exact', head: true })
          .eq('status', 'overdue'),
      ])

      // Process lead stats
      const totalLeads = totalLeadsResult.count || 0
      const leadsThisMonth = leadsThisMonthResult.count || 0
      const leadsLastMonth = leadsLastMonthResult.count || 0
      const totalLeadsTrend = leadsLastMonth > 0
        ? Math.round((leadsThisMonth - leadsLastMonth) / leadsLastMonth * 100)
        : 0

      // Process unmatched replies
      const unmatchedReplies = (unmatchedSMSResult.count || 0) + (unmatchedEmailsResult.count || 0)
      const unmatchedLastMonth = (unmatchedSMSLastMonthResult.count || 0) + (unmatchedEmailsLastMonthResult.count || 0)
      const unmatchedRepliesTrend = unmatchedLastMonth > 0
        ? Math.round((unmatchedReplies - unmatchedLastMonth) / unmatchedLastMonth * 100)
        : 0

      // Process programmes
      const activeProgrammes = activeProgrammesResult.count || 0
      const activeProgrammesLastMonth = activeProgrammesLastMonthResult.count || 0
      const activeProgrammesTrend = activeProgrammesLastMonth > 0
        ? Math.round((activeProgrammes - activeProgrammesLastMonth) / activeProgrammesLastMonth * 100)
        : 0

      // =====================
      // BATCH 2: Activity queries (non-fatal, in parallel)
      // =====================
      let dealActivitiesToday = 0
      let dealActivitiesYesterday = 0
      let automationLogsToday = 0
      let automationLogsYesterday = 0
      let emailSendsToday = 0
      let emailSendsYesterday = 0

      try {
        const [
          dealTodayResult,
          dealYesterdayResult,
          automationTodayResult,
          automationYesterdayResult,
          emailTodayResult,
          emailYesterdayResult,
        ] = await Promise.all([
          supabase.from('deal_activities').select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString()),
          supabase.from('deal_activities').select('*', { count: 'exact', head: true })
            .gte('created_at', yesterday.toISOString())
            .lt('created_at', today.toISOString()),
          supabase.from('automation_logs').select('*', { count: 'exact', head: true })
            .gte('sent_at', today.toISOString()),
          supabase.from('automation_logs').select('*', { count: 'exact', head: true })
            .gte('sent_at', yesterday.toISOString())
            .lt('sent_at', today.toISOString()),
          supabase.from('campaign_recipients').select('*', { count: 'exact', head: true })
            .gte('sent_at', today.toISOString()),
          supabase.from('campaign_recipients').select('*', { count: 'exact', head: true })
            .gte('sent_at', yesterday.toISOString())
            .lt('sent_at', today.toISOString()),
        ])

        dealActivitiesToday = dealTodayResult.count || 0
        dealActivitiesYesterday = dealYesterdayResult.count || 0
        automationLogsToday = automationTodayResult.count || 0
        automationLogsYesterday = automationYesterdayResult.count || 0
        emailSendsToday = emailTodayResult.count || 0
        emailSendsYesterday = emailYesterdayResult.count || 0
      } catch (e) {
        console.warn('Failed to fetch activity counts:', e)
      }

      const todayActivities = dealActivitiesToday + automationLogsToday + emailSendsToday
      const yesterdayActivities = dealActivitiesYesterday + automationLogsYesterday + emailSendsYesterday
      const todayActivitiesTrend = yesterdayActivities > 0
        ? Math.round((todayActivities - yesterdayActivities) / yesterdayActivities * 100)
        : 0

      // =====================
      // BATCH 3: Deals won (non-fatal)
      // =====================
      let dealsWon = 0
      try {
        const { data: wonStages, error: stagesError } = await supabase
          .from('pipeline_stages')
          .select('id')
          .in('stage_type', ['payment', 'completed'])

        if (stagesError) {
          const { count } = await supabase
            .from('deals')
            .select('*', { count: 'exact', head: true })
            .not('won_at', 'is', null)
          dealsWon = count || 0
        } else {
          const wonStageIds = wonStages?.map((s) => s.id) || []
          if (wonStageIds.length > 0) {
            const { count } = await supabase
              .from('deals')
              .select('*', { count: 'exact', head: true })
              .in('current_stage_id', wonStageIds)
            dealsWon = count || 0
          }
        }
      } catch (e) {
        console.warn('Failed to fetch won deals:', e)
      }

      // Exclude deals sitting in lost/dead stages from total pipeline value —
      // a priced deal that died shouldn't keep inflating the headline number.
      let deadStageIds: string[] = []
      try {
        const { data: deadStages } = await supabase
          .from('pipeline_stages')
          .select('id')
          .in('stage_type', ['lost', 'dead'])
        deadStageIds = deadStages?.map((s) => s.id) || []
      } catch (e) {
        console.warn('Failed to fetch lost/dead stages:', e)
      }

      // Process remaining stats
      const totalDealValue = dealValuesResult.data?.reduce(
        (sum, d) =>
          d.current_stage_id && deadStageIds.includes(d.current_stage_id)
            ? sum
            : sum + (d.deal_value || 0),
        0
      ) || 0
      const totalRevenue = paidInvoicesResult.data?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0
      const monthRevenue = monthInvoicesResult.data?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0

      return {
        totalLeads,
        totalLeadsTrend,
        unmatchedReplies,
        unmatchedRepliesTrend,
        activeProgrammes,
        activeProgrammesTrend,
        todayActivities,
        todayActivitiesTrend,
        // Legacy
        totalContacts: totalContactsResult.count || 0,
        totalDeals: totalLeads,
        totalDealValue,
        dealsWon,
        totalRevenue,
        monthRevenue,
        overdueInvoices: overdueInvoicesResult.count || 0,
      }
    },
    refetchInterval: 30000,
  })
}
