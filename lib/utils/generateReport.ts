import { createClient } from '@/lib/supabase/client'

export type ReportType =
  | 'contacts'
  | 'pipeline'
  | 'revenue'
  | 'campaign'
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
}

// Convert data to CSV
function convertToCSV(data: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
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
async function generatePipelineReport(dateRange: { start: Date; end: Date }) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('deals')
    .select(`
      id, title, value, status, created_at, updated_at, deal_owner_id,
      contact:contacts(first_name, last_name, email),
      stage:pipeline_stages!current_stage_id(name),
      pipeline:pipelines(name)
    `)
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())
    .order('created_at', { ascending: false })

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
async function generateRevenueReport(dateRange: { start: Date; end: Date }) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('payments')
    .select(`
      id, amount, status, payment_method, created_at,
      invoice:invoices(invoice_number, type, contact:contacts(first_name, last_name))
    `)
    .eq('status', 'successful')
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error

  const flattenedData = (data || []).map((payment) => ({
    amount: payment.amount,
    payment_method: payment.payment_method,
    invoice_number: (payment.invoice as any)?.invoice_number || '',
    invoice_type: (payment.invoice as any)?.type || '',
    contact_name: (payment.invoice as any)?.contact 
      ? `${(payment.invoice as any).contact.first_name || ''} ${(payment.invoice as any).contact.last_name || ''}`.trim()
      : '',
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
    { key: 'status', label: 'Status' },
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
async function generateAutomationReport(dateRange: { start: Date; end: Date }) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('automation_logs')
    .select(`
      id, status, error_message, executed_at,
      automation:automations(name),
      deal:deals(title, contact:contacts(first_name, last_name)),
      step:automation_steps(name, action_type)
    `)
    .gte('executed_at', dateRange.start.toISOString())
    .lte('executed_at', dateRange.end.toISOString())
    .order('executed_at', { ascending: false })
    .limit(1000)

  if (error) throw error

  const flattenedData = (data || []).map((log) => ({
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

// Generate Recruiter Performance Report
async function generateRecruiterReport(dateRange: { start: Date; end: Date }) {
  const supabase = createClient()
  
  // Get all recruiters
  const { data: recruiters } = await supabase
    .from('profiles')
    .select('id, full_name, email')

  if (!recruiters) return ''

  // Get deals for each recruiter
  const recruiterData = await Promise.all(
    recruiters.map(async (recruiter) => {
      const { data: deals } = await supabase
        .from('deals')
        .select('id, value, status')
        .eq('owner_id', recruiter.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())

      const totalDeals = deals?.length || 0
      const wonDeals = deals?.filter((d) => d.status === 'won').length || 0
      const totalValue = deals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0
      const wonValue = deals?.filter((d) => d.status === 'won').reduce((sum, d) => sum + (d.value || 0), 0) || 0

      return {
        name: recruiter.full_name || recruiter.email,
        email: recruiter.email,
        total_deals: totalDeals,
        won_deals: wonDeals,
        win_rate: totalDeals > 0 ? ((wonDeals / totalDeals) * 100).toFixed(1) + '%' : '0%',
        total_value: totalValue,
        won_value: wonValue,
      }
    })
  )

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

// Generate Invoice Ageing Report
async function generateInvoiceAgeingReport(dateRange: { start: Date; end: Date }) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, amount, status, due_date, created_at,
      contact:contacts(first_name, last_name, email)
    `)
    .in('status', ['sent', 'viewed', 'overdue'])
    .order('due_date', { ascending: true })

  if (error) throw error

  const today = new Date()

  const ageingData = (data || []).map((invoice) => {
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
async function generateDepositConversionReport(dateRange: { start: Date; end: Date }) {
  const supabase = createClient()

  // Get pipelines
  const { data: pipelines } = await supabase.from('pipelines').select('id, name')

  if (!pipelines) return ''

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
    { key: 'paid_to_enrolment_rate', label: 'Paid → Enrolment Rate' },
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
      csvContent = await generatePipelineReport(options.dateRange)
      break
    case 'revenue':
      csvContent = await generateRevenueReport(options.dateRange)
      break
    case 'responses':
      csvContent = await generateResponsesReport(options.dateRange)
      break
    case 'automation':
      csvContent = await generateAutomationReport(options.dateRange)
      break
    case 'recruiter':
      csvContent = await generateRecruiterReport(options.dateRange)
      break
    case 'invoice-ageing':
      csvContent = await generateInvoiceAgeingReport(options.dateRange)
      break
    case 'sms-costs':
      csvContent = await generateSMSCostsReport(options.dateRange)
      break
    case 'deposit-conversion':
      csvContent = await generateDepositConversionReport(options.dateRange)
      break
    default:
      throw new Error(`Report type "${options.type}" not implemented`)
  }

  const filename = `${options.type}-report-${options.dateRange.start.toISOString().split('T')[0]}-to-${options.dateRange.end.toISOString().split('T')[0]}.csv`
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;')
}
