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
    // New KPIs
    callsBooked: number
    callsBookedPrevious: number
    unmatchedReplies: number
    unmatchedRepliesPrevious: number
    outstandingBalance: number
    outstandingBalancePrevious: number
    depositsThisMonth: number
    depositsLastMonth: number
  }
  leadsOverTime: { date: string; leads: number }[]
  pipelineFunnel: { stage: string; count: number }[]
  stageConversionRates: { fromStage: string; toStage: string; rate: number }[]
  avgTimePerStage: { stage: string; avgDays: number }[]
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

export function useAnalytics(dateRange: string = '30d', pipelineId: string | null = null) {
  const supabase = createClient()

  return useQuery<AnalyticsData>({
    queryKey: ['analytics', dateRange, pipelineId],
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
      let dealsQuery = supabase
        .from('deals')
        .select('id, status, value')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      if (pipelineId) {
        dealsQuery = dealsQuery.eq('pipeline_id', pipelineId)
      }

      const { data: currentDeals } = await dealsQuery

      let prevDealsQuery = supabase
        .from('deals')
        .select('id, status, value')
        .gte('created_at', previousStart.toISOString())
        .lte('created_at', previousEnd.toISOString())

      if (pipelineId) {
        prevDealsQuery = prevDealsQuery.eq('pipeline_id', pipelineId)
      }

      const { data: previousDeals } = await prevDealsQuery

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
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())

        if (!smsSentError) {
          const { count: smsReplies } = await supabase
            .from('sms_messages')
            .select('*', { count: 'exact', head: true })
            .eq('direction', 'inbound')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())

          const { count: prevSmsSent } = await supabase
            .from('sms_messages')
            .select('*', { count: 'exact', head: true })
            .eq('direction', 'outbound')
            .gte('created_at', previousStart.toISOString())
            .lte('created_at', previousEnd.toISOString())

          const { count: prevSmsReplies } = await supabase
            .from('sms_messages')
            .select('*', { count: 'exact', head: true })
            .eq('direction', 'inbound')
            .gte('created_at', previousStart.toISOString())
            .lte('created_at', previousEnd.toISOString())

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

      // =====================
      // CALLS BOOKED (deals at Zoom Scheduled stage)
      // =====================
      let callsBooked = 0
      let callsBookedPrevious = 0
      try {
        // Get Zoom Scheduled stage IDs
        let zoomStagesQuery = supabase
          .from('pipeline_stages')
          .select('id')
          .ilike('name', '%zoom%scheduled%')

        if (pipelineId) {
          zoomStagesQuery = zoomStagesQuery.eq('pipeline_id', pipelineId)
        }

        const { data: zoomStages } = await zoomStagesQuery

        const zoomStageIds = zoomStages?.map((s) => s.id) || []
        if (zoomStageIds.length > 0) {
          let currentCallsQuery = supabase
            .from('deals')
            .select('*', { count: 'exact', head: true })
            .in('current_stage_id', zoomStageIds)
            .gte('updated_at', start.toISOString())
            .lte('updated_at', end.toISOString())

          if (pipelineId) {
            currentCallsQuery = currentCallsQuery.eq('pipeline_id', pipelineId)
          }

          const { count: currentCalls } = await currentCallsQuery
          callsBooked = currentCalls || 0

          let previousCallsQuery = supabase
            .from('deals')
            .select('*', { count: 'exact', head: true })
            .in('current_stage_id', zoomStageIds)
            .gte('updated_at', previousStart.toISOString())
            .lte('updated_at', previousEnd.toISOString())

          if (pipelineId) {
            previousCallsQuery = previousCallsQuery.eq('pipeline_id', pipelineId)
          }

          const { count: previousCalls } = await previousCallsQuery
          callsBookedPrevious = previousCalls || 0
        }
      } catch (e) {
        console.warn('Failed to fetch calls booked:', e)
      }

      // =====================
      // UNMATCHED REPLIES (SMS + Email)
      // =====================
      let unmatchedReplies = 0
      let unmatchedRepliesPrevious = 0
      try {
        // Current unmatched SMS
        const { count: unmatchedSMS } = await supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('match_status', 'unmatched')
          .eq('direction', 'inbound')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())

        // Current unmatched emails
        const { count: unmatchedEmails } = await supabase
          .from('email_replies')
          .select('*', { count: 'exact', head: true })
          .eq('match_status', 'unmatched')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())

        unmatchedReplies = (unmatchedSMS || 0) + (unmatchedEmails || 0)

        // Previous unmatched SMS
        const { count: prevUnmatchedSMS } = await supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('match_status', 'unmatched')
          .eq('direction', 'inbound')
          .gte('created_at', previousStart.toISOString())
          .lte('created_at', previousEnd.toISOString())

        // Previous unmatched emails
        const { count: prevUnmatchedEmails } = await supabase
          .from('email_replies')
          .select('*', { count: 'exact', head: true })
          .eq('match_status', 'unmatched')
          .gte('created_at', previousStart.toISOString())
          .lte('created_at', previousEnd.toISOString())

        unmatchedRepliesPrevious = (prevUnmatchedSMS || 0) + (prevUnmatchedEmails || 0)
      } catch (e) {
        console.warn('Failed to fetch unmatched replies:', e)
      }

      // =====================
      // OUTSTANDING BALANCE (unpaid invoices)
      // =====================
      let outstandingBalance = 0
      let outstandingBalancePrevious = 0
      try {
        // Current outstanding (sent, viewed, overdue invoices)
        const { data: unpaidInvoices } = await supabase
          .from('invoices')
          .select('amount')
          .in('status', ['sent', 'viewed', 'overdue'])

        outstandingBalance = unpaidInvoices?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0

        // For previous period comparison, we look at outstanding as of previous end date
        // This is an approximation - comparing current total vs what was outstanding then
        const { data: prevUnpaidInvoices } = await supabase
          .from('invoices')
          .select('amount')
          .in('status', ['sent', 'viewed', 'overdue'])
          .lte('created_at', previousEnd.toISOString())

        outstandingBalancePrevious = prevUnpaidInvoices?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0
      } catch (e) {
        console.warn('Failed to fetch outstanding balance:', e)
      }

      // =====================
      // DEPOSITS THIS MONTH
      // =====================
      let depositsThisMonth = 0
      let depositsLastMonth = 0
      try {
        const thisMonthStart = new Date()
        thisMonthStart.setDate(1)
        thisMonthStart.setHours(0, 0, 0, 0)

        const lastMonthStart = new Date(thisMonthStart)
        lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)

        const lastMonthEnd = new Date(thisMonthStart)
        lastMonthEnd.setDate(0) // Last day of previous month

        // Deposits this month (payments linked to deposit-type invoices)
        const { data: thisMonthDeposits } = await supabase
          .from('payments')
          .select('amount, invoice:invoices!inner(type)')
          .eq('status', 'successful')
          .eq('invoice.type', 'deposit')
          .gte('created_at', thisMonthStart.toISOString())

        depositsThisMonth = thisMonthDeposits?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

        // Deposits last month
        const { data: lastMonthDepositsData } = await supabase
          .from('payments')
          .select('amount, invoice:invoices!inner(type)')
          .eq('status', 'successful')
          .eq('invoice.type', 'deposit')
          .gte('created_at', lastMonthStart.toISOString())
          .lte('created_at', lastMonthEnd.toISOString())

        depositsLastMonth = lastMonthDepositsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
      } catch (e) {
        console.warn('Failed to fetch deposits:', e)
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
        let stagesQuery = supabase
          .from('pipeline_stages')
          .select('id, name, display_order, pipeline_id')
          .order('display_order')

        // If pipeline is selected, only get stages for that pipeline
        if (pipelineId) {
          stagesQuery = stagesQuery.eq('pipeline_id', pipelineId)
        }

        const { data: stagesData, error: stagesError } = await stagesQuery

        if (!stagesError && stagesData) {
          // Group by stage name (for aggregating across pipelines when no filter)
          const stageNames = pipelineId
            ? stagesData
            : [...new Map(stagesData.map(s => [s.name, s])).values()]

          for (const stage of stageNames.slice(0, 8)) {
            // Get all stage IDs with this name (for aggregation)
            const stageIds = stagesData
              .filter(s => s.name === stage.name)
              .map(s => s.id)

            const { count } = await supabase
              .from('deals')
              .select('*', { count: 'exact', head: true })
              .in('current_stage_id', stageIds)

            pipelineFunnel.push({ stage: stage.name, count: count || 0 })
          }
        }
      } catch (e) {
        console.warn('Failed to fetch pipeline funnel:', e)
      }

      // =====================
      // STAGE CONVERSION RATES & AVG TIME PER STAGE
      // =====================
      const stageConversionRates: { fromStage: string; toStage: string; rate: number }[] = []
      const avgTimePerStage: { stage: string; avgDays: number }[] = []

      try {
        // Get deal stage history to calculate conversions and time
        let historyQuery = supabase
          .from('deal_stage_history')
          .select('deal_id, from_stage_id, to_stage_id, changed_at, deal:deals(pipeline_id)')
          .order('changed_at', { ascending: true })

        const { data: stageHistory } = await historyQuery

        if (stageHistory && stageHistory.length > 0) {
          // Get stage info for mapping
          let stagesQuery = supabase
            .from('pipeline_stages')
            .select('id, name, display_order, pipeline_id')
            .order('display_order')

          if (pipelineId) {
            stagesQuery = stagesQuery.eq('pipeline_id', pipelineId)
          }

          const { data: allStages } = await stagesQuery
          const stageMap = new Map(allStages?.map(s => [s.id, s]) || [])

          // Filter history by pipeline if needed
          const filteredHistory = pipelineId
            ? stageHistory.filter(h => (h.deal as any)?.pipeline_id === pipelineId)
            : stageHistory

          // Calculate conversion rates between sequential stages
          const transitionCounts: Record<string, { from: number; to: number }> = {}

          for (const transition of filteredHistory) {
            if (!transition.from_stage_id || !transition.to_stage_id) continue
            const fromStage = stageMap.get(transition.from_stage_id)
            const toStage = stageMap.get(transition.to_stage_id)
            if (!fromStage || !toStage) continue

            const key = `${fromStage.name}|${toStage.name}`
            if (!transitionCounts[key]) {
              transitionCounts[key] = { from: 0, to: 0 }
            }
            transitionCounts[key].to++
          }

          // Count total deals at each stage (as denominator for conversion)
          for (const stage of pipelineFunnel) {
            for (const key of Object.keys(transitionCounts)) {
              if (key.startsWith(`${stage.stage}|`)) {
                transitionCounts[key].from = stage.count
              }
            }
          }

          // Build conversion rates
          for (const [key, counts] of Object.entries(transitionCounts)) {
            const [fromStage, toStage] = key.split('|')
            const rate = counts.from > 0 ? (counts.to / counts.from) * 100 : 0
            if (rate > 0) {
              stageConversionRates.push({ fromStage, toStage, rate: Math.round(rate) })
            }
          }

          // Calculate average time per stage
          const timePerStage: Record<string, number[]> = {}
          const dealTimes: Record<string, Date> = {}

          for (const transition of filteredHistory) {
            const dealId = transition.deal_id
            const changedAt = new Date(transition.changed_at)

            if (transition.from_stage_id) {
              const fromStage = stageMap.get(transition.from_stage_id)
              if (fromStage && dealTimes[`${dealId}-${transition.from_stage_id}`]) {
                const enteredAt = dealTimes[`${dealId}-${transition.from_stage_id}`]
                const daysInStage = (changedAt.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24)

                if (!timePerStage[fromStage.name]) {
                  timePerStage[fromStage.name] = []
                }
                timePerStage[fromStage.name].push(daysInStage)
              }
            }

            if (transition.to_stage_id) {
              dealTimes[`${dealId}-${transition.to_stage_id}`] = changedAt
            }
          }

          // Calculate averages
          for (const [stageName, times] of Object.entries(timePerStage)) {
            const avg = times.reduce((a, b) => a + b, 0) / times.length
            avgTimePerStage.push({ stage: stageName, avgDays: Math.round(avg * 10) / 10 })
          }

          // Sort by stage order
          avgTimePerStage.sort((a, b) => {
            const aIndex = pipelineFunnel.findIndex(s => s.stage === a.stage)
            const bIndex = pipelineFunnel.findIndex(s => s.stage === b.stage)
            return aIndex - bIndex
          })
        }
      } catch (e) {
        console.warn('Failed to fetch stage metrics:', e)
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
          // New KPIs
          callsBooked,
          callsBookedPrevious,
          unmatchedReplies,
          unmatchedRepliesPrevious,
          outstandingBalance,
          outstandingBalancePrevious,
          depositsThisMonth,
          depositsLastMonth,
        },
        leadsOverTime,
        pipelineFunnel,
        stageConversionRates,
        avgTimePerStage,
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
