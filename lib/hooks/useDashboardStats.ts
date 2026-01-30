'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface DashboardStats {
  totalContacts: number
  unmatchedReplies: number
  activeProgrammes: number
  todayActivities: number
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
      // Total contacts (leads)
      const { count: totalContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })

      // Unmatched SMS replies
      const { count: unmatchedSMS } = await supabase
        .from('sms_messages')
        .select('*', { count: 'exact', head: true })
        .eq('match_status', 'unmatched')
        .eq('direction', 'inbound')

      // Unmatched email replies
      const { count: unmatchedEmails } = await supabase
        .from('email_replies')
        .select('*', { count: 'exact', head: true })
        .eq('match_status', 'unmatched')

      // Total unmatched replies
      const unmatchedReplies = (unmatchedSMS || 0) + (unmatchedEmails || 0)

      // Active programmes
      const { count: activeProgrammes } = await supabase
        .from('programmes')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      // Today's activities
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count: todayActivities } = await supabase
        .from('deal_activities')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())

      // Total deals
      const { count: totalDeals } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })

      // Total deal value
      const { data: dealValues } = await supabase.from('deals').select('deal_value')
      const totalDealValue =
        dealValues?.reduce((sum, d) => sum + (d.deal_value || 0), 0) || 0

      // Deals won (deals in final "payment" or "completed" stage type)
      const { data: wonStages } = await supabase
        .from('pipeline_stages')
        .select('id')
        .in('stage_type', ['payment', 'completed'])
      const wonStageIds = wonStages?.map((s) => s.id) || []

      let dealsWon = 0
      if (wonStageIds.length > 0) {
        const { count } = await supabase
          .from('deals')
          .select('*', { count: 'exact', head: true })
          .in('current_stage_id', wonStageIds)
        dealsWon = count || 0
      }

      // Revenue (paid invoices)
      const { data: paidInvoices } = await supabase
        .from('invoices')
        .select('amount')
        .eq('status', 'paid')
      const totalRevenue =
        paidInvoices?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0

      // This month's revenue
      const firstOfMonth = new Date()
      firstOfMonth.setDate(1)
      firstOfMonth.setHours(0, 0, 0, 0)
      const { data: monthInvoices } = await supabase
        .from('invoices')
        .select('amount')
        .eq('status', 'paid')
        .gte('paid_at', firstOfMonth.toISOString())
      const monthRevenue =
        monthInvoices?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0

      // Overdue invoices
      const { count: overdueInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'overdue')

      return {
        totalContacts: totalContacts || 0,
        unmatchedReplies: unmatchedReplies || 0,
        activeProgrammes: activeProgrammes || 0,
        todayActivities: todayActivities || 0,
        totalDeals: totalDeals || 0,
        totalDealValue,
        dealsWon: dealsWon || 0,
        totalRevenue,
        monthRevenue,
        overdueInvoices: overdueInvoices || 0,
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}
