import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface AnalyticsData {
  kpis: {
    totalLeads: number
    totalLeadsPrevious: number
    conversionRate: number
    conversionRatePrevious: number
    revenue: number
    revenuePrevious: number
    avgDealValue: number
    avgDealValuePrevious: number
    emailOpenRate: number
    emailOpenRatePrevious: number
    smsResponseRate: number
    smsResponseRatePrevious: number
  }
  leadsOverTime: { date: string; leads: number }[]
  pipelineFunnel: { stage: string; count: number }[]
  revenueByMonth: { month: string; revenue: number }[]
  leadsBySource: { name: string; value: number; color: string }[]
  topRecruiters: { name: string; deals: number }[]
  programmePerformance: { programme: string; enrolments: number }[]
}

function getDateRange(range: string): { start: Date; end: Date; previousStart: Date; previousEnd: Date } {
  const end = new Date()
  const start = new Date()
  
  // Calculate current period start
  switch (range) {
    case '7d':
      start.setDate(end.getDate() - 7)
      break
    case '30d':
      start.setDate(end.getDate() - 30)
      break
    case '90d':
      start.setDate(end.getDate() - 90)
      break
    case 'ytd':
      start.setMonth(0, 1)
      break
    default:
      start.setDate(end.getDate() - 30)
  }
  
  // Calculate previous period for comparison
  const periodLength = end.getTime() - start.getTime()
  const previousEnd = new Date(start.getTime() - 1)
  const previousStart = new Date(previousEnd.getTime() - periodLength)
  
  return { start, end, previousStart, previousEnd }
}

export function useAnalytics(dateRange: string = '30d') {
  const supabase = createClient()

  return useQuery<AnalyticsData>({
    queryKey: ['analytics', dateRange],
    queryFn: async () => {
      const { start, end, previousStart, previousEnd } = getDateRange(dateRange)
      
      // Fetch current period contacts (leads)
      const { count: totalLeads } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      // Fetch previous period contacts
      const { count: totalLeadsPrevious } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', previousStart.toISOString())
        .lte('created_at', previousEnd.toISOString())

      // Fetch deals for conversion rate
      const { data: currentDeals } = await supabase
        .from('deals')
        .select('id, status, value')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      const { data: previousDeals } = await supabase
        .from('deals')
        .select('id, status, value')
        .gte('created_at', previousStart.toISOString())
        .lte('created_at', previousEnd.toISOString())

      const wonDeals = currentDeals?.filter((d) => d.status === 'won') || []
      const previousWonDeals = previousDeals?.filter((d) => d.status === 'won') || []

      const totalDealsCurrent = currentDeals?.length || 0
      const totalDealsPrevious = previousDeals?.length || 0

      const conversionRate = totalDealsCurrent > 0 
        ? (wonDeals.length / totalDealsCurrent) * 100 
        : 0
      const conversionRatePrevious = totalDealsPrevious > 0 
        ? (previousWonDeals.length / totalDealsPrevious) * 100 
        : 0

      // Revenue from payments
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'successful')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      const { data: previousPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'successful')
        .gte('created_at', previousStart.toISOString())
        .lte('created_at', previousEnd.toISOString())

      const revenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
      const revenuePrevious = previousPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

      // Average deal value
      const avgDealValue = wonDeals.length > 0 
        ? wonDeals.reduce((sum, d) => sum + (d.value || 0), 0) / wonDeals.length 
        : 0
      const avgDealValuePrevious = previousWonDeals.length > 0 
        ? previousWonDeals.reduce((sum, d) => sum + (d.value || 0), 0) / previousWonDeals.length 
        : 0

      // Email stats
      const { count: emailsSent } = await supabase
        .from('email_sends')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', start.toISOString())
        .lte('sent_at', end.toISOString())

      const { count: emailsOpened } = await supabase
        .from('email_sends')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', start.toISOString())
        .lte('sent_at', end.toISOString())
        .eq('status', 'opened')

      const { count: prevEmailsSent } = await supabase
        .from('email_sends')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', previousStart.toISOString())
        .lte('sent_at', previousEnd.toISOString())

      const { count: prevEmailsOpened } = await supabase
        .from('email_sends')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', previousStart.toISOString())
        .lte('sent_at', previousEnd.toISOString())
        .eq('status', 'opened')

      const emailOpenRate = (emailsSent || 0) > 0 
        ? ((emailsOpened || 0) / (emailsSent || 1)) * 100 
        : 0
      const emailOpenRatePrevious = (prevEmailsSent || 0) > 0 
        ? ((prevEmailsOpened || 0) / (prevEmailsSent || 1)) * 100 
        : 0

      // SMS stats (non-fatal - table may not exist)
      let smsResponseRate = 0
      let smsResponseRatePrevious = 0
      try {
        const { count: smsSent, error: smsSentError } = await supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'outbound')
          .gte('sent_at', start.toISOString())
          .lte('sent_at', end.toISOString())

        if (!smsSentError) {
          const { count: smsReplies } = await supabase
            .from('sms_messages')
            .select('*', { count: 'exact', head: true })
            .eq('direction', 'inbound')
            .gte('received_at', start.toISOString())
            .lte('received_at', end.toISOString())

          const { count: prevSmsSent } = await supabase
            .from('sms_messages')
            .select('*', { count: 'exact', head: true })
            .eq('direction', 'outbound')
            .gte('sent_at', previousStart.toISOString())
            .lte('sent_at', previousEnd.toISOString())

          const { count: prevSmsReplies } = await supabase
            .from('sms_messages')
            .select('*', { count: 'exact', head: true })
            .eq('direction', 'inbound')
            .gte('received_at', previousStart.toISOString())
            .lte('received_at', previousEnd.toISOString())

          smsResponseRate = (smsSent || 0) > 0 
            ? ((smsReplies || 0) / (smsSent || 1)) * 100 
            : 0
          smsResponseRatePrevious = (prevSmsSent || 0) > 0 
            ? ((prevSmsReplies || 0) / (prevSmsSent || 1)) * 100 
            : 0
        }
      } catch (e) {
        console.warn('Failed to fetch SMS stats:', e)
      }

      // Leads over time (weekly grouping)
      const { data: leadsData } = await supabase
        .from('contacts')
        .select('created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at')

      const leadsOverTime = groupByWeek(leadsData || [], start, end)

      // Pipeline funnel (non-fatal)
      const pipelineFunnel: { stage: string; count: number }[] = []
      try {
        const { data: stagesData, error: stagesError } = await supabase
          .from('pipeline_stages')
          .select('id, name, display_order')
          .order('display_order')

        if (!stagesError && stagesData) {
          for (const stage of stagesData.slice(0, 7)) {
            const { count } = await supabase
              .from('deals')
              .select('*', { count: 'exact', head: true })
              .eq('current_stage_id', stage.id)
            pipelineFunnel.push({ stage: stage.name, count: count || 0 })
          }
        }
      } catch (e) {
        console.warn('Failed to fetch pipeline funnel:', e)
      }

      // Revenue by month
      const { data: monthlyPayments } = await supabase
        .from('payments')
        .select('amount, created_at')
        .eq('status', 'successful')
        .gte('created_at', new Date(new Date().setMonth(new Date().getMonth() - 5)).toISOString())
        .order('created_at')

      const revenueByMonth = groupPaymentsByMonth(monthlyPayments || [])

      // Leads by source
      const { data: sourcesData } = await supabase
        .from('contacts')
        .select('source')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      const sourceColors: Record<string, string> = {
        'website_form': '#3B82F6',
        'sms_reply': '#10B981',
        'email_reply': '#F59E0B',
        'manual': '#8B5CF6',
        'csv_import': '#EC4899',
        'other': '#6B7280',
      }

      const sourceCounts = (sourcesData || []).reduce((acc, contact) => {
        const source = contact.source || 'other'
        acc[source] = (acc[source] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const leadsBySource = Object.entries(sourceCounts).map(([name, value]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value,
        color: sourceColors[name] || '#6B7280',
      }))

      // Top recruiters
      const { data: recruitersData } = await supabase
        .from('profiles')
        .select('id, full_name')

      const topRecruiters: { name: string; deals: number }[] = []
      for (const recruiter of (recruitersData || []).slice(0, 5)) {
        const { count } = await supabase
          .from('deals')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', recruiter.id)
          .eq('status', 'won')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
        topRecruiters.push({ name: recruiter.full_name || 'Unknown', deals: count || 0 })
      }
      topRecruiters.sort((a, b) => b.deals - a.deals)

      // Programme performance
      const { data: pipelinesData } = await supabase
        .from('pipelines')
        .select('id, name')

      const programmePerformance: { programme: string; enrolments: number }[] = []
      for (const pipeline of (pipelinesData || []).slice(0, 5)) {
        const { count } = await supabase
          .from('deals')
          .select('*', { count: 'exact', head: true })
          .eq('pipeline_id', pipeline.id)
          .eq('status', 'won')
        programmePerformance.push({ programme: pipeline.name, enrolments: count || 0 })
      }
      programmePerformance.sort((a, b) => b.enrolments - a.enrolments)

      return {
        kpis: {
          totalLeads: totalLeads || 0,
          totalLeadsPrevious: totalLeadsPrevious || 0,
          conversionRate,
          conversionRatePrevious,
          revenue,
          revenuePrevious,
          avgDealValue,
          avgDealValuePrevious,
          emailOpenRate,
          emailOpenRatePrevious,
          smsResponseRate,
          smsResponseRatePrevious,
        },
        leadsOverTime,
        pipelineFunnel,
        revenueByMonth,
        leadsBySource,
        topRecruiters,
        programmePerformance,
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

function groupByWeek(data: { created_at: string }[], start: Date, end: Date): { date: string; leads: number }[] {
  const weeks: { date: string; leads: number }[] = []
  const current = new Date(start)
  
  while (current <= end) {
    const weekEnd = new Date(current)
    weekEnd.setDate(weekEnd.getDate() + 6)
    
    const count = data.filter(item => {
      const date = new Date(item.created_at)
      return date >= current && date <= weekEnd
    }).length
    
    weeks.push({
      date: `${current.getDate().toString().padStart(2, '0')}/${(current.getMonth() + 1).toString().padStart(2, '0')}`,
      leads: count,
    })
    
    current.setDate(current.getDate() + 7)
  }
  
  return weeks.slice(-5) // Return last 5 weeks
}

function groupPaymentsByMonth(data: { amount: number; created_at: string }[]): { month: string; revenue: number }[] {
  const months: Record<string, number> = {}
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  data.forEach(payment => {
    const date = new Date(payment.created_at)
    const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`
    months[key] = (months[key] || 0) + payment.amount
  })
  
  return Object.entries(months)
    .map(([month, revenue]) => ({ month: month.split(' ')[0], revenue }))
    .slice(-5)
}
