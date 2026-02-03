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
      // TOTAL LEADS (from deals table)
      // =====================
      const { count: totalLeads } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })

      // Leads this month
      const { count: leadsThisMonth } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstOfMonth.toISOString())

      // Leads last month
      const { count: leadsLastMonth } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstOfLastMonth.toISOString())
        .lte('created_at', lastOfLastMonth.toISOString())

      const totalLeadsTrend = leadsLastMonth && leadsLastMonth > 0
        ? Math.round(((leadsThisMonth || 0) - leadsLastMonth) / leadsLastMonth * 100)
        : 0

      // =====================
      // UNMATCHED REPLIES
      // =====================
      // Current unmatched SMS
      const { count: unmatchedSMS } = await supabase
        .from('sms_messages')
        .select('*', { count: 'exact', head: true })
        .eq('match_status', 'unmatched')
        .eq('direction', 'inbound')

      // Current unmatched emails
      const { count: unmatchedEmails } = await supabase
        .from('email_replies')
        .select('*', { count: 'exact', head: true })
        .eq('match_status', 'unmatched')

      const unmatchedReplies = (unmatchedSMS || 0) + (unmatchedEmails || 0)

      // Unmatched SMS last month
      const { count: unmatchedSMSLastMonth } = await supabase
        .from('sms_messages')
        .select('*', { count: 'exact', head: true })
        .eq('match_status', 'unmatched')
        .eq('direction', 'inbound')
        .lte('created_at', lastOfLastMonth.toISOString())

      // Unmatched emails last month
      const { count: unmatchedEmailsLastMonth } = await supabase
        .from('email_replies')
        .select('*', { count: 'exact', head: true })
        .eq('match_status', 'unmatched')
        .lte('created_at', lastOfLastMonth.toISOString())

      const unmatchedLastMonth = (unmatchedSMSLastMonth || 0) + (unmatchedEmailsLastMonth || 0)
      const unmatchedRepliesTrend = unmatchedLastMonth > 0
        ? Math.round((unmatchedReplies - unmatchedLastMonth) / unmatchedLastMonth * 100)
        : 0

      // =====================
      // ACTIVE PROGRAMMES (from pipelines table)
      // =====================
      const { count: activeProgrammes } = await supabase
        .from('pipelines')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      // Active pipelines last month (check those created before last month that were active)
      const { count: activeProgrammesLastMonth } = await supabase
        .from('pipelines')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .lte('created_at', lastOfLastMonth.toISOString())

      const activeProgrammesTrend = activeProgrammesLastMonth && activeProgrammesLastMonth > 0
        ? Math.round(((activeProgrammes || 0) - activeProgrammesLastMonth) / activeProgrammesLastMonth * 100)
        : 0

      // =====================
      // TODAY'S ACTIVITY (deal_activities + automation_logs + email tracking)
      // =====================
      // Deal activities today (non-fatal)
      let dealActivitiesToday = 0
      let dealActivitiesYesterday = 0
      try {
        const { count } = await supabase
          .from('deal_activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today.toISOString())
        dealActivitiesToday = count || 0

        const { count: yesterdayCount } = await supabase
          .from('deal_activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString())
        dealActivitiesYesterday = yesterdayCount || 0
      } catch (e) {
        console.warn('Failed to fetch deal activities:', e)
      }

      // Automation logs today (non-fatal) - table is automation_logs not automation_step_logs
      let automationLogsToday = 0
      let automationLogsYesterday = 0
      try {
        const { count } = await supabase
          .from('automation_logs')
          .select('*', { count: 'exact', head: true })
          .gte('sent_at', today.toISOString())
        automationLogsToday = count || 0

        const { count: yesterdayCount } = await supabase
          .from('automation_logs')
          .select('*', { count: 'exact', head: true })
          .gte('sent_at', yesterday.toISOString())
          .lt('sent_at', today.toISOString())
        automationLogsYesterday = yesterdayCount || 0
      } catch (e) {
        console.warn('Failed to fetch automation logs:', e)
      }

      // Email sends today (from campaigns) - non-fatal
      let emailSendsToday = 0
      let emailSendsYesterday = 0
      try {
        const { count } = await supabase
          .from('campaign_recipients')
          .select('*', { count: 'exact', head: true })
          .gte('sent_at', today.toISOString())
        emailSendsToday = count || 0

        const { count: yesterdayCount } = await supabase
          .from('campaign_recipients')
          .select('*', { count: 'exact', head: true })
          .gte('sent_at', yesterday.toISOString())
          .lt('sent_at', today.toISOString())
        emailSendsYesterday = yesterdayCount || 0
      } catch (e) {
        console.warn('Failed to fetch campaign recipients:', e)
      }

      const todayActivities = dealActivitiesToday + automationLogsToday + emailSendsToday
      const yesterdayActivities = dealActivitiesYesterday + automationLogsYesterday + emailSendsYesterday
      const todayActivitiesTrend = yesterdayActivities > 0
        ? Math.round((todayActivities - yesterdayActivities) / yesterdayActivities * 100)
        : 0

      // =====================
      // LEGACY / ADDITIONAL STATS
      // =====================
      // Total contacts
      const { count: totalContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })

      // Total deal value
      const { data: dealValues } = await supabase.from('deals').select('deal_value')
      const totalDealValue = dealValues?.reduce((sum, d) => sum + (d.deal_value || 0), 0) || 0

      // Deals won (non-fatal - try pipeline_stages table)
      let dealsWon = 0
      try {
        // Try pipeline_stages table first (per migration schema)
        const { data: wonStages, error: stagesError } = await supabase
          .from('pipeline_stages')
          .select('id')
          .in('stage_type', ['payment', 'completed'])
        
        if (stagesError) {
          // Fallback: count deals with won_at set
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

      // Revenue
      const { data: paidInvoices } = await supabase
        .from('invoices')
        .select('amount')
        .eq('status', 'paid')
      const totalRevenue = paidInvoices?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0

      // Month revenue
      const { data: monthInvoices } = await supabase
        .from('invoices')
        .select('amount')
        .eq('status', 'paid')
        .gte('paid_at', firstOfMonth.toISOString())
      const monthRevenue = monthInvoices?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0

      // Overdue invoices
      const { count: overdueInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'overdue')

      return {
        totalLeads: totalLeads || 0,
        totalLeadsTrend,
        unmatchedReplies,
        unmatchedRepliesTrend,
        activeProgrammes: activeProgrammes || 0,
        activeProgrammesTrend,
        todayActivities,
        todayActivitiesTrend,
        // Legacy
        totalContacts: totalContacts || 0,
        totalDeals: totalLeads || 0,
        totalDealValue,
        dealsWon,
        totalRevenue,
        monthRevenue,
        overdueInvoices: overdueInvoices || 0,
      }
    },
    refetchInterval: 30000,
  })
}
