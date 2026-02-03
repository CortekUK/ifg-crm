// Supabase Edge Function: Send Email via Resend
// This function handles sending emails through the Resend API
// Supports merge tag replacement for personalisation

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MergeTagData {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  deal_title?: string | null
  deal_value?: number | null
  deal_stage?: string | null
  deal_pipeline?: string | null
  deal_owner_name?: string | null
  deal_owner_email?: string | null
  deal_owner_phone?: string | null
  deal_owner_calendly?: string | null
  deal_owner_signature?: string | null
  [key: string]: string | number | boolean | null | undefined
}

interface SendEmailRequest {
  to: string
  from_name?: string // Optional - will use deal owner name if deal_id provided
  from_email: string
  reply_to?: string // Optional - will use deal owner email if deal_id provided
  subject: string
  html_body: string
  tracking_id?: string
  // Optional tracking metadata
  contact_id?: string
  campaign_id?: string
  automation_log_id?: string
  // For merge tag replacement
  deal_id?: string
  merge_data?: MergeTagData // Optional pre-populated merge data
  apply_merge_tags?: boolean // Default true if deal_id or contact_id provided
}

interface SendEmailResponse {
  success: boolean
  message_id?: string
  error?: string
  merge_data_used?: MergeTagData
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const body: SendEmailRequest = await req.json()

    // Validate required fields
    if (!body.to || !body.from_email || !body.subject || !body.html_body) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: to, from_email, subject, html_body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch merge data if deal_id or contact_id provided
    let mergeData: MergeTagData = body.merge_data || {}
    let fromName = body.from_name || 'IFG Team'
    let replyTo = body.reply_to || body.from_email

    const shouldApplyMergeTags = body.apply_merge_tags !== false && 
      (body.deal_id || body.contact_id || Object.keys(mergeData).length > 0)

    if (body.deal_id) {
      const fetchedData = await fetchMergeDataForDeal(supabase, body.deal_id)
      mergeData = { ...fetchedData, ...mergeData } // Allow override from body.merge_data

      // Use deal owner info for from_name and reply_to if not explicitly provided
      if (!body.from_name && mergeData.deal_owner_name) {
        fromName = mergeData.deal_owner_name
      }
      if (!body.reply_to && mergeData.deal_owner_email) {
        replyTo = mergeData.deal_owner_email
      }
    } else if (body.contact_id && !mergeData.first_name) {
      // Fetch contact data if not already in merge_data
      const contactData = await fetchContactData(supabase, body.contact_id)
      mergeData = { ...contactData, ...mergeData }
    }

    // Apply merge tags to subject and body
    let processedSubject = body.subject
    let processedBody = body.html_body

    if (shouldApplyMergeTags) {
      processedSubject = replaceMergeTags(body.subject, mergeData)
      processedBody = replaceMergeTags(body.html_body, mergeData)
    }

    // Initialize Resend client
    const resend = new Resend(resendApiKey)

    // Send email via Resend
    const { data, error: resendError } = await resend.emails.send({
      from: `${fromName} <${body.from_email}>`,
      to: [body.to],
      reply_to: replyTo,
      subject: processedSubject,
      html: processedBody,
    })

    if (resendError) {
      console.error('Full Resend error:', JSON.stringify(resendError))
      console.error('Resend error:', resendError)
      
      // Log failed send to database if we have tracking info
      if (body.tracking_id) {
        await logEmailSend({
          tracking_id: body.tracking_id,
          recipient_email: body.to,
          recipient_contact_id: body.contact_id,
          campaign_id: body.campaign_id,
          automation_log_id: body.automation_log_id,
          subject: body.subject,
          status: 'failed',
          error_message: resendError.message,
        })
      }

      return new Response(
        JSON.stringify({ success: false, error: resendError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const messageId = data?.id || null

    // Log successful send to database if we have tracking info
    if (body.tracking_id || body.contact_id || body.campaign_id) {
      await logEmailSend({
        tracking_id: body.tracking_id || crypto.randomUUID(),
        recipient_email: body.to,
        recipient_contact_id: body.contact_id,
        campaign_id: body.campaign_id,
        automation_log_id: body.automation_log_id,
        subject: body.subject,
        status: 'sent',
        resend_message_id: messageId,
      })
    }

    const response: SendEmailResponse = {
      success: true,
      message_id: messageId,
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper function to log email sends to database
async function logEmailSend(params: {
  tracking_id: string
  recipient_email: string
  recipient_contact_id?: string
  campaign_id?: string
  automation_log_id?: string
  subject: string
  status: 'sent' | 'failed'
  resend_message_id?: string | null
  error_message?: string
}) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials not configured')
      return
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase.from('email_sends').insert({
      tracking_id: params.tracking_id,
      recipient_email: params.recipient_email,
      recipient_contact_id: params.recipient_contact_id || null,
      campaign_id: params.campaign_id || null,
      automation_log_id: params.automation_log_id || null,
      subject: params.subject,
      status: params.status,
      resend_message_id: params.resend_message_id || null,
      error_message: params.error_message || null,
      sent_at: new Date().toISOString(),
    })

    if (error) {
      console.error('Failed to log email send:', error)
    }
  } catch (err) {
    console.error('Error logging email send:', err)
  }
}

/**
 * Fetch merge tag data for a deal
 * Uses separate queries instead of embedded joins for reliability
 */
async function fetchMergeDataForDeal(
  supabase: ReturnType<typeof createClient>,
  dealId: string
): Promise<MergeTagData> {
  // Fetch deal first (without joins)
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, title, value, contact_id, deal_owner_id, owner_id, current_stage_id, pipeline_id')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    console.error('Failed to fetch deal for merge tags:', dealError)
    return {}
  }

  // Fetch contact separately
  let contact: { first_name: string; last_name: string; email: string; phone: string } | null = null
  if (deal.contact_id) {
    const { data: contactData } = await supabase
      .from('contacts')
      .select('first_name, last_name, email, phone')
      .eq('id', deal.contact_id)
      .single()
    contact = contactData
  }

  // Fetch owner separately (check both deal_owner_id and owner_id)
  let owner: { full_name: string; email: string; phone: string; calendly_url: string; email_signature: string } | null = null
  const ownerId = deal.deal_owner_id || deal.owner_id
  if (ownerId) {
    const { data: ownerData } = await supabase
      .from('profiles')
      .select('full_name, email, phone, calendly_url, email_signature')
      .eq('id', ownerId)
      .single()
    owner = ownerData
  }

  // Fetch stage separately (using pipeline_stages, not stages)
  let stage: { name: string } | null = null
  if (deal.current_stage_id) {
    const { data: stageData } = await supabase
      .from('pipeline_stages')
      .select('name')
      .eq('id', deal.current_stage_id)
      .single()
    stage = stageData
  }

  // Fetch pipeline separately
  let pipeline: { name: string } | null = null
  if (deal.pipeline_id) {
    const { data: pipelineData } = await supabase
      .from('pipelines')
      .select('name')
      .eq('id', deal.pipeline_id)
      .single()
    pipeline = pipelineData
  }

  return {
    // Contact fields
    first_name: contact?.first_name || null,
    last_name: contact?.last_name || null,
    email: contact?.email || null,
    phone: contact?.phone || null,
    
    // Deal fields
    deal_title: deal.title || null,
    deal_value: deal.value || null,
    deal_stage: stage?.name || null,
    deal_pipeline: pipeline?.name || null,
    
    // Owner fields
    deal_owner_name: owner?.full_name || null,
    deal_owner_email: owner?.email || null,
    deal_owner_phone: owner?.phone || null,
    deal_owner_calendly: owner?.calendly_url || null,
    deal_owner_signature: owner?.email_signature || null,
  }
}

/**
 * Fetch contact data for merge tags
 */
async function fetchContactData(
  supabase: ReturnType<typeof createClient>,
  contactId: string
): Promise<MergeTagData> {
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('first_name, last_name, email, phone')
    .eq('id', contactId)
    .single()

  if (error || !contact) {
    console.error('Failed to fetch contact for merge tags:', error)
    return {}
  }

  return {
    first_name: contact.first_name || null,
    last_name: contact.last_name || null,
    email: contact.email || null,
    phone: contact.phone || null,
  }
}

/**
 * Replace merge tags in a template string
 */
function replaceMergeTags(template: string, data: MergeTagData): string {
  if (!template) return ''
  
  let result = template
  
  // Process conditional blocks first
  result = processConditionalBlocks(result, data)
  
  // Then replace simple tags
  result = replaceSimpleTags(result, data)
  
  return result
}

/**
 * Process conditional blocks
 */
function processConditionalBlocks(template: string, data: MergeTagData): string {
  let result = template
  
  // {{#if field_name equals "value"}}content{{/if}}
  const equalsPattern = /\{\{#if\s+(\w+)\s+equals\s+"([^"]+)"\}\}([\s\S]*?)\{\{\/if\}\}/gi
  result = result.replace(equalsPattern, (_, fieldName, expectedValue, content) => {
    const actualValue = data[fieldName]
    return actualValue === expectedValue ? content : ''
  })
  
  // {{#if field_name not_equals "value"}}content{{/if}}
  const notEqualsPattern = /\{\{#if\s+(\w+)\s+not_equals\s+"([^"]+)"\}\}([\s\S]*?)\{\{\/if\}\}/gi
  result = result.replace(notEqualsPattern, (_, fieldName, expectedValue, content) => {
    const actualValue = data[fieldName]
    return actualValue !== expectedValue ? content : ''
  })
  
  // {{#if field_name}}content{{/if}}
  const truthyPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/gi
  result = result.replace(truthyPattern, (_, fieldName, content) => {
    const value = data[fieldName]
    return value && value !== '' ? content : ''
  })
  
  // {{#unless field_name}}content{{/unless}}
  const unlessPattern = /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/gi
  result = result.replace(unlessPattern, (_, fieldName, content) => {
    const value = data[fieldName]
    return !value || value === '' ? content : ''
  })
  
  return result
}

/**
 * Replace simple merge tags
 */
function replaceSimpleTags(template: string, data: MergeTagData): string {
  // {{field_name}} or {{field_name|fallback}}
  const tagPattern = /\{\{(\w+)(?:\|([^}]+))?\}\}/g
  
  return template.replace(tagPattern, (_, fieldName, fallback) => {
    const value = data[fieldName]
    
    if (value !== null && value !== undefined && value !== '') {
      // Format currency values
      if (typeof value === 'number') {
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
          minimumFractionDigits: 0,
        }).format(value)
      }
      return String(value)
    }
    
    return fallback !== undefined ? fallback : ''
  })
}
