import { createClient } from '@/lib/supabase/client'

export type ReportType =
  | 'contacts'
  | 'pipeline'
  | 'revenue'
  | 'campaign'
  | 'campaign-conversions'
  | 'recruiter'
  | 'monthly'
  | 'automation'
  | 'responses'
  | 'invoice-ageing'
  | 'sms-costs'
  | 'deposit-conversion'

export interface ReportOptions {
  type: ReportType
  dateRange: { start: Date; end: Date }
  format: 'csv' | 'pdf'
  pipelineId?: string | null
  recruiterId?: string | null
}

// Convert data to CSV
function convertToCSV(data: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  if (data.length === 0) {
    throw new Error('No data found for the selected date range and filters.')
  }
  const header = columns.map((col) => `"${col.label}"`).join(',')
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key]
        if (value === null || value === undefined) return '""'
        if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`
        if (typeof value === 'number') return value.toString()
        if (value instanceof Date) return `"${value.toISOString()}"`
        return `"${String(value)}"`
      })
      .join(',')
  )
  return [header, ...rows].join('\n')
}

// Download file
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Generate Contacts Export
async function generateContactsReport(dateRange: { start: Date; end: Date }) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error

  const columns = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'gender', label: 'Gender' },
    { key: 'graduation_year', label: 'Graduation Year' },
    { key: 'country', label: 'Country' },
    { key: 'position', label: 'Position' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Created At' },
  ]

  return convertToCSV(data || [], columns)
}

// Generate Pipeline Report
async function generatePipelineReport(dateRange: { start: Date; end: Date }, pipelineId?: string | null, recruiterId?: string | null) {
  const supabase = createClient()

  let query = supabase
    .from('deals')
    .select(`
      id, title, value, status, created_at, updated_at, deal_owner_id,
      contact:contacts(first_name, last_name, email),
      stage:pipeline_stages!current_stage_id(name),
      pipeline:pipelines(name, id)
    `)
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())
    .order('created_at', { ascending: false })

  if (pipelineId) {
    query = query.eq('pipeline_id', pipelineId)
  }
  if (recruiterId) {
    query = query.eq('deal_owner_id', recruiterId)
  }

  const { data, error } = await query

  if (error) throw error

  // Fetch owners separately to avoid FK ambiguity
  const ownerIds = [...new Set((data || []).map(d => d.deal_owner_id).filter(Boolean))]
  let ownersMap = new Map<string, string>()
  if (ownerIds.length > 0) {
    const { data: owners } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', ownerIds)
    ownersMap = new Map(owners?.map(o => [o.id, o.full_name || '']) || [])
  }

  const flattenedData = (data || []).map((deal) => ({
    title: deal.title,
    value: deal.value,
    status: deal.status,
    contact_name: deal.contact
      ? `${(deal.contact as any).first_name || ''} ${(deal.contact as any).last_name || ''}`.trim()
      : '',
    contact_email: (deal.contact as any)?.email || '',
    pipeline: (deal.pipeline as any)?.name || '',
    stage: (deal.stage as any)?.name || '',
    owner: ownersMap.get(deal.deal_owner_id) || '',
    created_at: deal.created_at,
  }))

  const columns = [
    { key: 'title', label: 'Deal Title' },
    { key: 'value', label: 'Value (£)' },
    { key: 'status', label: 'Status' },
    { key: 'contact_name', label: 'Contact Name' },
    { key: 'contact_email', label: 'Contact Email' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'stage', label: 'Stage' },
    { key: 'owner', label: 'Owner' },
    { key: 'created_at', label: 'Created At' },
  ]

  return convertToCSV(flattenedData, columns)
}

// Generate Revenue Report
async function generateRevenueReport(dateRange: { start: Date; end: Date }, pipelineId?: string | null) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('payments')
    .select(`
      id, amount, status, payment_method, created_at,
      invoice:invoices(invoice_number, type, contact:contacts(first_name, last_name), deal:deals(pipeline_id, pipeline:pipelines(name)))
    `)
    .eq('status', 'successful')
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error

  let filtered = data || []
  if (pipelineId) {
    filtered = filtered.filter((p) => (p.invoice as any)?.deal?.pipeline_id === pipelineId)
  }

  const flattenedData = filtered.map((payment) => ({
    amount: payment.amount,
    payment_method: payment.payment_method,
    invoice_number: (payment.invoice as any)?.invoice_number || '',
    invoice_type: (payment.invoice as any)?.type || '',
    contact_name: (payment.invoice as any)?.contact
      ? `${(payment.invoice as any).contact.first_name || ''} ${(payment.invoice as any).contact.last_name || ''}`.trim()
      : '',
    pipeline: (payment.invoice as any)?.deal?.pipeline?.name || '',
    status: payment.status,
    date: payment.created_at,
  }))

  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'amount', label: 'Amount (£)' },
    { key: 'payment_method', label: 'Payment Method' },
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'invoice_type', label: 'Invoice Type' },
    { key: 'contact_name', label: 'Contact' },
    { key: 'pipeline', label: 'Programme' },
    { key: 'status', label: 'Status' },
  ]

  return convertToCSV(flattenedData, columns)
}

// Generate Campaign Performance Report
async function generateCampaignReport(dateRange: { start: Date; end: Date }) {
  const supabase = createClient()

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select(`
      id, name, type, status, scheduled_at, sent_at,
      total_recipients, processed_recipients,
      from_user:profiles!campaigns_from_user_id_fkey(full_name),
      pipeline:pipelines(name)
    `)
    .in('status', ['sent', 'sending', 'scheduled'])
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())
    .order('sent_at', { ascending: false })

  if (error) throw error

  // Get recipient stats per campaign
  const campaignIds = (campaigns || []).map(c => c.id)
  let recipientStats = new Map<string, { sent: number; delivered: number; opened: number; clicked: number; bounced: number; failed: number }>()

  if (campaignIds.length > 0) {
    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('campaign_id, status')
      .in('campaign_id', campaignIds)

    if (recipients) {
      for (const r of recipients) {
        const stats = recipientStats.get(r.campaign_id) || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, failed: 0 }
        if (r.status === 'sent') stats.sent++
        if (r.status === 'delivered') stats.delivered++
        if (r.status === 'opened') stats.opened++
        if (r.status === 'clicked') stats.clicked++
        if (r.status === 'bounced') stats.bounced++
        if (r.status === 'failed') stats.failed++
        recipientStats.set(r.campaign_id, stats)
      }
    }
  }

  const flattenedData = (campaigns || []).map((campaign) => {
    const stats = recipientStats.get(campaign.id) || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, failed: 0 }
    const totalSent = stats.sent + stats.delivered + stats.opened + stats.clicked
    const openRate = totalSent > 0 ? (((stats.opened + stats.clicked) / totalSent) * 100).toFixed(1) : '0.0'
    const clickRate = totalSent > 0 ? ((stats.clicked / totalSent) * 100).toFixed(1) : '0.0'

    return {
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      programme: (campaign.pipeline as any)?.name || 'All',
      sent_by: (campaign.from_user as any)?.full_name || '',
      total_recipients: campaign.total_recipients || 0,
      sent: totalSent,
      opened: stats.opened + stats.clicked,
      clicked: stats.clicked,
      bounced: stats.bounced,
      failed: stats.failed,
      open_rate: openRate + '%',
      click_rate: clickRate + '%',
      sent_at: campaign.sent_at || campaign.scheduled_at || '',
    }
  })

  const columns = [
    { key: 'name', label: 'Campaign Name' },
    { key: 'type', label: 'Type' },
    { key: 'programme', label: 'Programme' },
    { key: 'sent_by', label: 'Sent By' },
    { key: 'total_recipients', label: 'Recipients' },
    { key: 'sent', label: 'Sent' },
    { key: 'opened', label: 'Opened' },
    { key: 'clicked', label: 'Clicked' },
    { key: 'bounced', label: 'Bounced' },
    { key: 'failed', label: 'Failed' },
    { key: 'open_rate', label: 'Open Rate' },
    { key: 'click_rate', label: 'Click Rate' },
    { key: 'sent_at', label: 'Sent At' },
  ]

  return convertToCSV(flattenedData, columns)
}

// Generate Campaign Conversions Report
async function generateCampaignConversionsReport(dateRange: { start: Date; end: Date }, pipelineId?: string | null) {
  const supabase = createClient()

  // Get campaigns in date range
  let campaignQuery = supabase
    .from('campaigns')
    .select('id, name, type, sent_at, total_recipients, pipeline:pipelines(name, id)')
    .in('status', ['sent', 'sending'])
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())

  if (pipelineId) {
    campaignQuery = campaignQuery.eq('pipeline_id', pipelineId)
  }

  const { data: campaigns, error } = await campaignQuery.order('sent_at', { ascending: false })
  if (error) throw error

  // For each campaign, count recipients that became deals
  const campaignIds = (campaigns || []).map(c => c.id)
  let recipientContactIds = new Map<string, string[]>()

  if (campaignIds.length > 0) {
    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('campaign_id, contact_id')
      .in('campaign_id', campaignIds)

    if (recipients) {
      for (const r of recipients) {
        const ids = recipientContactIds.get(r.campaign_id) || []
        ids.push(r.contact_id)
        recipientContactIds.set(r.campaign_id, ids)
      }
    }
  }

  // Get all deals in the date range
  const { data: deals } = await supabase
    .from('deals')
    .select('id, contact_id, status, value')
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())

  const dealsByContact = new Map<string, { total: number; won: number; value: number }>()
  for (const deal of deals || []) {
    if (!deal.contact_id) continue
    const existing = dealsByContact.get(deal.contact_id) || { total: 0, won: 0, value: 0 }
    existing.total++
    if (deal.status === 'won') {
      existing.won++
      existing.value += deal.value || 0
    }
    dealsByContact.set(deal.contact_id, existing)
  }

  const flattenedData = (campaigns || []).map((campaign) => {
    const contactIds = recipientContactIds.get(campaign.id) || []
    let dealsCreated = 0
    let dealsWon = 0
    let revenueFromCampaign = 0

    for (const contactId of contactIds) {
      const dealInfo = dealsByContact.get(contactId)
      if (dealInfo) {
        dealsCreated += dealInfo.total
        dealsWon += dealInfo.won
        revenueFromCampaign += dealInfo.value
      }
    }

    const conversionRate = contactIds.length > 0 ? ((dealsCreated / contactIds.length) * 100).toFixed(1) : '0.0'

    return {
      name: campaign.name,
      type: campaign.type,
      programme: (campaign.pipeline as any)?.name || 'All',
      recipients: campaign.total_recipients || contactIds.length,
      deals_created: dealsCreated,
      deals_won: dealsWon,
      conversion_rate: conversionRate + '%',
      revenue: revenueFromCampaign,
      sent_at: campaign.sent_at || '',
    }
  })

  const columns = [
    { key: 'name', label: 'Campaign Name' },
    { key: 'type', label: 'Type' },
    { key: 'programme', label: 'Programme' },
    { key: 'recipients', label: 'Recipients' },
    { key: 'deals_created', label: 'Deals Created' },
    { key: 'deals_won', label: 'Deals Won' },
    { key: 'conversion_rate', label: 'Conversion Rate' },
    { key: 'revenue', label: 'Revenue (£)' },
    { key: 'sent_at', label: 'Sent At' },
  ]

  return convertToCSV(flattenedData, columns)
}

// Generate Email/SMS Responses Report
async function generateResponsesReport(dateRange: { start: Date; end: Date }) {
  const supabase = createClient()

  // Get email replies
  const { data: emailReplies } = await supabase
    .from('email_replies')
    .select(`
      id, subject, from_email, received_at,
      contact:contacts(first_name, last_name)
    `)
    .gte('received_at', dateRange.start.toISOString())
    .lte('received_at', dateRange.end.toISOString())
    .order('received_at', { ascending: false })

  // Get SMS replies
  const { data: smsReplies } = await supabase
    .from('sms_messages')
    .select(`
      id, body, from_number, received_at,
      contact:contacts(first_name, last_name)
    `)
    .eq('direction', 'inbound')
    .gte('received_at', dateRange.start.toISOString())
    .lte('received_at', dateRange.end.toISOString())
    .order('received_at', { ascending: false })

  const responseData = [
    ...(emailReplies || []).map((r) => ({
      type: 'Email',
      from: r.from_email,
      content: r.subject,
      contact_name: r.contact
        ? `${(r.contact as any).first_name || ''} ${(r.contact as any).last_name || ''}`.trim()
        : '',
      date: r.received_at,
    })),
    ...(smsReplies || []).map((r) => ({
      type: 'SMS',
      from: r.from_number,
      content: r.body?.substring(0, 100) + (r.body && r.body.length > 100 ? '...' : ''),
      contact_name: r.contact
        ? `${(r.contact as any).first_name || ''} ${(r.contact as any).last_name || ''}`.trim()
        : '',
      date: r.received_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Type' },
    { key: 'from', label: 'From' },
    { key: 'contact_name', label: 'Contact' },
    { key: 'content', label: 'Content' },
  ]

  return convertToCSV(responseData, columns)
}

// Generate Automation Report
async function generateAutomationReport(dateRange: { start: Date; end: Date }, pipelineId?: string | null) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('automation_logs')
    .select(`
      id, status, error_message, executed_at,
      automation:automations(name, pipeline_id),
      deal:deals(title, contact:contacts(first_name, last_name)),
      step:automation_steps(name, action_type)
    `)
    .gte('executed_at', dateRange.start.toISOString())
    .lte('executed_at', dateRange.end.toISOString())
    .order('executed_at', { ascending: false })
    .limit(1000)

  if (error) throw error

  let filtered = data || []
  if (pipelineId) {
    filtered = filtered.filter((log) => (log.automation as any)?.pipeline_id === pipelineId)
  }

  const flattenedData = filtered.map((log) => ({
    automation_name: (log.automation as any)?.name || '',
    step_name: (log.step as any)?.name || '',
    action_type: (log.step as any)?.action_type || '',
    deal_title: (log.deal as any)?.title || '',
    contact_name: (log.deal as any)?.contact
      ? `${(log.deal as any).contact.first_name || ''} ${(log.deal as any).contact.last_name || ''}`.trim()
      : '',
    status: log.status,
    error_message: log.error_message || '',
    executed_at: log.executed_at,
  }))

  const columns = [
    { key: 'executed_at', label: 'Executed At' },
    { key: 'automation_name', label: 'Automation' },
    { key: 'step_name', label: 'Step' },
    { key: 'action_type', label: 'Action Type' },
    { key: 'deal_title', label: 'Deal' },
    { key: 'contact_name', label: 'Contact' },
    { key: 'status', label: 'Status' },
    { key: 'error_message', label: 'Error' },
  ]

  return convertToCSV(flattenedData, columns)
}

// Generate Recruiter Performance Report (batched — no N+1)
async function generateRecruiterReport(dateRange: { start: Date; end: Date }, recruiterId?: string | null) {
  const supabase = createClient()

  // Get all deals in one query
  let dealsQuery = supabase
    .from('deals')
    .select('id, value, status, deal_owner_id')
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())

  if (recruiterId) {
    dealsQuery = dealsQuery.eq('deal_owner_id', recruiterId)
  }

  const { data: deals, error: dealsError } = await dealsQuery
  if (dealsError) throw dealsError

  // Group deals by owner
  const dealsByOwner = new Map<string, { total: number; won: number; totalValue: number; wonValue: number }>()
  for (const deal of deals || []) {
    if (!deal.deal_owner_id) continue
    const stats = dealsByOwner.get(deal.deal_owner_id) || { total: 0, won: 0, totalValue: 0, wonValue: 0 }
    stats.total++
    stats.totalValue += deal.value || 0
    if (deal.status === 'won') {
      stats.won++
      stats.wonValue += deal.value || 0
    }
    dealsByOwner.set(deal.deal_owner_id, stats)
  }

  // Get recruiter profiles
  const ownerIds = [...dealsByOwner.keys()]
  if (ownerIds.length === 0) {
    throw new Error('No data found for the selected date range and filters.')
  }

  const { data: recruiters } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', ownerIds)

  const recruiterData = (recruiters || []).map((recruiter) => {
    const stats = dealsByOwner.get(recruiter.id) || { total: 0, won: 0, totalValue: 0, wonValue: 0 }
    return {
      name: recruiter.full_name || recruiter.email,
      email: recruiter.email,
      total_deals: stats.total,
      won_deals: stats.won,
      win_rate: stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(1) + '%' : '0%',
      total_value: stats.totalValue,
      won_value: stats.wonValue,
    }
  }).sort((a, b) => b.won_deals - a.won_deals)

  const columns = [
    { key: 'name', label: 'Recruiter' },
    { key: 'email', label: 'Email' },
    { key: 'total_deals', label: 'Total Deals' },
    { key: 'won_deals', label: 'Won Deals' },
    { key: 'win_rate', label: 'Win Rate' },
    { key: 'total_value', label: 'Total Value (£)' },
    { key: 'won_value', label: 'Won Value (£)' },
  ]

  return convertToCSV(recruiterData, columns)
}

// Generate Monthly Summary Report
async function generateMonthlySummaryReport(dateRange: { start: Date; end: Date }, pipelineId?: string | null) {
  const supabase = createClient()

  // Fetch all key data in parallel
  const [contactsRes, dealsRes, paymentsRes, campaignsRes] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, created_at', { count: 'exact' })
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString()),
    supabase
      .from('deals')
      .select('id, value, status, pipeline_id, created_at')
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString()),
    supabase
      .from('payments')
      .select('id, amount, status, created_at, invoice:invoices(deal:deals(pipeline_id))')
      .eq('status', 'successful')
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString()),
    supabase
      .from('campaigns')
      .select('id, name, type, status, total_recipients, sent_at')
      .in('status', ['sent', 'sending'])
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString()),
  ])

  let deals = dealsRes.data || []
  let payments = paymentsRes.data || []
  if (pipelineId) {
    deals = deals.filter(d => d.pipeline_id === pipelineId)
    payments = payments.filter(p => (p.invoice as any)?.deal?.pipeline_id === pipelineId)
  }

  const totalContacts = contactsRes.count || 0
  const totalDeals = deals.length
  const wonDeals = deals.filter(d => d.status === 'won').length
  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  const totalCampaigns = (campaignsRes.data || []).length

  const summaryData = [
    { metric: 'New Contacts', value: totalContacts, details: `Contacts created in period` },
    { metric: 'New Deals', value: totalDeals, details: `Deals created in period` },
    { metric: 'Won Deals', value: wonDeals, details: `Deals marked as won` },
    { metric: 'Conversion Rate', value: totalDeals > 0 ? ((wonDeals / totalDeals) * 100).toFixed(1) + '%' : '0%', details: 'Won / Total deals' },
    { metric: 'Total Revenue', value: `£${totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, details: 'Sum of successful payments' },
    { metric: 'Avg Deal Value', value: wonDeals > 0 ? `£${(totalRevenue / wonDeals).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '£0', details: 'Revenue / Won deals' },
    { metric: 'Campaigns Sent', value: totalCampaigns, details: 'Email and SMS campaigns' },
  ]

  const columns = [
    { key: 'metric', label: 'Metric' },
    { key: 'value', label: 'Value' },
    { key: 'details', label: 'Details' },
  ]

  return convertToCSV(summaryData, columns)
}

// Generate Invoice Ageing Report
async function generateInvoiceAgeingReport(dateRange: { start: Date; end: Date }, pipelineId?: string | null) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, amount, status, due_date, created_at,
      contact:contacts(first_name, last_name, email),
      deal:deals(pipeline_id, pipeline:pipelines(name))
    `)
    .in('status', ['sent', 'viewed', 'overdue'])
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())
    .order('due_date', { ascending: true })

  if (error) throw error

  let filtered = data || []
  if (pipelineId) {
    filtered = filtered.filter((inv) => (inv.deal as any)?.pipeline_id === pipelineId)
  }

  const today = new Date()

  const ageingData = filtered.map((invoice) => {
    const dueDate = new Date(invoice.due_date)
    const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    let ageBracket: string
    if (daysPastDue <= 0) {
      ageBracket = 'Current (Not Due)'
    } else if (daysPastDue <= 30) {
      ageBracket = '0-30 Days'
    } else if (daysPastDue <= 60) {
      ageBracket = '30-60 Days'
    } else if (daysPastDue <= 90) {
      ageBracket = '60-90 Days'
    } else {
      ageBracket = '90+ Days'
    }

    return {
      invoice_number: invoice.invoice_number,
      amount: invoice.amount,
      contact_name: invoice.contact
        ? `${(invoice.contact as any).first_name || ''} ${(invoice.contact as any).last_name || ''}`.trim()
        : '',
      contact_email: (invoice.contact as any)?.email || '',
      programme: (invoice.deal as any)?.pipeline?.name || '',
      due_date: invoice.due_date,
      days_past_due: Math.max(0, daysPastDue),
      age_bracket: ageBracket,
      status: invoice.status,
    }
  })

  const columns = [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'contact_name', label: 'Contact' },
    { key: 'contact_email', label: 'Email' },
    { key: 'amount', label: 'Amount (£)' },
    { key: 'programme', label: 'Programme' },
    { key: 'due_date', label: 'Due Date' },
    { key: 'days_past_due', label: 'Days Past Due' },
    { key: 'age_bracket', label: 'Age Bracket' },
    { key: 'status', label: 'Status' },
  ]

  return convertToCSV(ageingData, columns)
}

// Generate SMS Campaign Costs Report
async function generateSMSCostsReport(dateRange: { start: Date; end: Date }) {
  const supabase = createClient()

  // Get SMS messages with campaign info
  const { data, error } = await supabase
    .from('sms_messages')
    .select(`
      id, body, status, direction, segment_count, created_at,
      campaign:campaigns(name)
    `)
    .eq('direction', 'outbound')
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error

  // SMS cost per segment (UK typical rate)
  const COST_PER_SEGMENT = 0.04 // £0.04 per segment

  const smsData = (data || []).map((sms) => ({
    campaign_name: (sms.campaign as any)?.name || 'Direct Message',
    message_preview: sms.body?.substring(0, 50) + (sms.body && sms.body.length > 50 ? '...' : ''),
    status: sms.status,
    segments: sms.segment_count || 1,
    cost: ((sms.segment_count || 1) * COST_PER_SEGMENT).toFixed(2),
    sent_at: sms.created_at,
  }))

  // Calculate totals by campaign
  const campaignTotals = new Map<string, { messages: number; segments: number; cost: number }>()
  smsData.forEach((sms) => {
    const existing = campaignTotals.get(sms.campaign_name) || { messages: 0, segments: 0, cost: 0 }
    existing.messages++
    existing.segments += sms.segments
    existing.cost += parseFloat(sms.cost)
    campaignTotals.set(sms.campaign_name, existing)
  })

  // Add summary rows
  const summaryData = Array.from(campaignTotals.entries()).map(([name, totals]) => ({
    campaign_name: name,
    message_preview: `TOTAL: ${totals.messages} messages`,
    status: '-',
    segments: totals.segments,
    cost: totals.cost.toFixed(2),
    sent_at: '-',
  }))

  const columns = [
    { key: 'campaign_name', label: 'Campaign' },
    { key: 'message_preview', label: 'Message Preview' },
    { key: 'status', label: 'Status' },
    { key: 'segments', label: 'Segments' },
    { key: 'cost', label: 'Cost (£)' },
    { key: 'sent_at', label: 'Sent At' },
  ]

  // Return summary first, then details
  return convertToCSV([...summaryData, ...smsData], columns)
}

// Generate Deposit Conversion Rate Report
async function generateDepositConversionReport(dateRange: { start: Date; end: Date }, pipelineId?: string | null) {
  const supabase = createClient()

  // Get pipelines
  let pipelineQuery = supabase.from('pipelines').select('id, name')
  if (pipelineId) {
    pipelineQuery = pipelineQuery.eq('id', pipelineId)
  }
  const { data: pipelines } = await pipelineQuery

  if (!pipelines || pipelines.length === 0) {
    throw new Error('No data found for the selected date range and filters.')
  }

  const conversionData = await Promise.all(
    pipelines.map(async (pipeline) => {
      // Get deposit invoices for this pipeline
      const { data: deposits } = await supabase
        .from('invoices')
        .select(`
          id, status,
          deal:deals!inner(pipeline_id)
        `)
        .eq('type', 'deposit')
        .eq('deal.pipeline_id', pipeline.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())

      const totalDeposits = deposits?.length || 0
      const paidDeposits = deposits?.filter((d) => d.status === 'paid').length || 0

      // Get enrolments (deals marked as won) for this pipeline
      const { count: enrolments } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('pipeline_id', pipeline.id)
        .eq('status', 'won')
        .gte('updated_at', dateRange.start.toISOString())
        .lte('updated_at', dateRange.end.toISOString())

      const depositToPaidRate = totalDeposits > 0 ? ((paidDeposits / totalDeposits) * 100).toFixed(1) : '0.0'
      const paidToEnrolmentRate = paidDeposits > 0 ? (((enrolments || 0) / paidDeposits) * 100).toFixed(1) : '0.0'
      const overallConversionRate = totalDeposits > 0 ? (((enrolments || 0) / totalDeposits) * 100).toFixed(1) : '0.0'

      return {
        programme: pipeline.name,
        deposits_sent: totalDeposits,
        deposits_paid: paidDeposits,
        deposit_to_paid_rate: depositToPaidRate + '%',
        enrolments: enrolments || 0,
        paid_to_enrolment_rate: paidToEnrolmentRate + '%',
        overall_conversion_rate: overallConversionRate + '%',
      }
    })
  )

  const columns = [
    { key: 'programme', label: 'Programme' },
    { key: 'deposits_sent', label: 'Deposits Sent' },
    { key: 'deposits_paid', label: 'Deposits Paid' },
    { key: 'deposit_to_paid_rate', label: 'Deposit Payment Rate' },
    { key: 'enrolments', label: 'Enrolments' },
    { key: 'paid_to_enrolment_rate', label: 'Paid > Enrolment Rate' },
    { key: 'overall_conversion_rate', label: 'Overall Conversion' },
  ]

  return convertToCSV(conversionData, columns)
}

// Main export function
export async function generateReport(options: ReportOptions): Promise<void> {
  let csvContent: string

  switch (options.type) {
    case 'contacts':
      csvContent = await generateContactsReport(options.dateRange)
      break
    case 'pipeline':
      csvContent = await generatePipelineReport(options.dateRange, options.pipelineId, options.recruiterId)
      break
    case 'revenue':
      csvContent = await generateRevenueReport(options.dateRange, options.pipelineId)
      break
    case 'campaign':
      csvContent = await generateCampaignReport(options.dateRange)
      break
    case 'campaign-conversions':
      csvContent = await generateCampaignConversionsReport(options.dateRange, options.pipelineId)
      break
    case 'responses':
      csvContent = await generateResponsesReport(options.dateRange)
      break
    case 'automation':
      csvContent = await generateAutomationReport(options.dateRange, options.pipelineId)
      break
    case 'recruiter':
      csvContent = await generateRecruiterReport(options.dateRange, options.recruiterId)
      break
    case 'monthly':
      csvContent = await generateMonthlySummaryReport(options.dateRange, options.pipelineId)
      break
    case 'invoice-ageing':
      csvContent = await generateInvoiceAgeingReport(options.dateRange, options.pipelineId)
      break
    case 'sms-costs':
      csvContent = await generateSMSCostsReport(options.dateRange)
      break
    case 'deposit-conversion':
      csvContent = await generateDepositConversionReport(options.dateRange, options.pipelineId)
      break
    default:
      throw new Error(`Report type "${options.type}" not implemented`)
  }

  const filename = `${options.type}-report-${options.dateRange.start.toISOString().split('T')[0]}-to-${options.dateRange.end.toISOString().split('T')[0]}.csv`
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;')
}
