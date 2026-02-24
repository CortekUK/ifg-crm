// Supabase Edge Function: Process Campaign Emails
// This function handles sending campaign emails in batches
// Called by Vercel cron job every minute

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 50 // Process 50 emails per invocation

interface Campaign {
  id: string
  name: string
  type: 'email' | 'sms'
  status: string
  subject: string | null
  body_html: string | null
  body_text: string | null
  from_name: string | null
  from_email: string | null
  reply_to: string | null
  preview_text: string | null
  email_template_id: string | null
  sms_content: string | null
  recipient_list_ids: string[] | null
  total_recipients: number
  processed_recipients: number
  scheduled_at: string | null
}

interface ProcessingSummary {
  campaignsProcessed: number
  emailsSent: number
  emailsFailed: number
  campaignsCompleted: string[]
  errors: string[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const summary: ProcessingSummary = {
    campaignsProcessed: 0,
    emailsSent: 0,
    emailsFailed: 0,
    campaignsCompleted: [],
    errors: [],
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find campaigns ready to process
    // 1. Scheduled campaigns where scheduled_at <= now
    // 2. Campaigns already in 'sending' status (continuing from previous run)
    const now = new Date().toISOString()

    const { data: campaigns, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .or(`and(status.eq.scheduled,scheduled_at.lte.${now}),status.eq.sending`)
      .eq('type', 'email') // Only email campaigns for now
      .order('scheduled_at', { ascending: true })
      .limit(5) // Process max 5 campaigns per invocation

    if (fetchError) {
      console.error('Failed to fetch campaigns:', fetchError)
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message, summary }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No campaigns to process', summary }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${campaigns.length} campaigns to process`)

    // Process each campaign
    for (const campaign of campaigns) {
      try {
        await processCampaign(supabase, campaign as Campaign, summary)
        summary.campaignsProcessed++
      } catch (error) {
        const errorMsg = `Campaign ${campaign.id}: ${error.message}`
        console.error(errorMsg)
        summary.errors.push(errorMsg)

        // Update campaign with error
        await supabase
          .from('campaigns')
          .update({
            error_message: error.message,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', campaign.id)
      }
    }

    return new Response(
      JSON.stringify({ success: true, summary }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    summary.errors.push(error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message, summary }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function processCampaign(
  supabase: ReturnType<typeof createClient>,
  campaign: Campaign,
  summary: ProcessingSummary
): Promise<void> {
  console.log(`Processing campaign: ${campaign.name} (${campaign.id})`)

  // If campaign is scheduled, initialize it for sending
  if (campaign.status === 'scheduled') {
    // Expand recipients from lists into campaign_recipients table
    const totalRecipients = await expandRecipients(supabase, campaign)

    if (totalRecipients === 0) {
      // No recipients - mark as sent immediately
      await supabase
        .from('campaigns')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          total_recipients: 0,
          processed_recipients: 0,
          last_processed_at: new Date().toISOString(),
        })
        .eq('id', campaign.id)

      summary.campaignsCompleted.push(campaign.id)
      return
    }

    // Update campaign to sending status
    await supabase
      .from('campaigns')
      .update({
        status: 'sending',
        total_recipients: totalRecipients,
        processed_recipients: 0,
        last_processed_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)

    campaign.status = 'sending'
    campaign.total_recipients = totalRecipients
    campaign.processed_recipients = 0
  }

  // Fetch pending recipients for this campaign (limit to batch size)
  const { data: pendingRecipients, error: recipientsError } = await supabase
    .from('campaign_recipients')
    .select(`
      id,
      contact_id,
      contact:contacts(id, first_name, last_name, email)
    `)
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .limit(BATCH_SIZE)

  if (recipientsError) {
    throw new Error(`Failed to fetch recipients: ${recipientsError.message}`)
  }

  if (!pendingRecipients || pendingRecipients.length === 0) {
    // All recipients processed — check if any actually succeeded
    const { count: sentCount } = await supabase
      .from('campaign_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'sent')

    const allFailed = (sentCount ?? 0) === 0 && campaign.total_recipients > 0

    await supabase
      .from('campaigns')
      .update({
        status: allFailed ? 'failed' : 'sent',
        sent_at: new Date().toISOString(),
        last_processed_at: new Date().toISOString(),
        error_message: allFailed ? `All ${campaign.total_recipients} recipients failed` : null,
      })
      .eq('id', campaign.id)

    summary.campaignsCompleted.push(campaign.id)
    console.log(`Campaign ${campaign.id} completed (${allFailed ? 'all failed' : 'sent'})`)
    return
  }

  console.log(`Sending to ${pendingRecipients.length} recipients`)

  // Get email template content if using a template
  let emailSubject = campaign.subject || ''
  let emailBody = campaign.body_html || campaign.body_text || ''

  if (campaign.email_template_id) {
    const { data: template } = await supabase
      .from('email_templates')
      .select('subject, body_html')
      .eq('id', campaign.email_template_id)
      .single()

    if (template) {
      emailSubject = template.subject || emailSubject
      emailBody = template.body_html || emailBody
    }
  }

  // From email — always use FROM_EMAIL env var or Resend test domain
  // Campaign's from_email is stored for display/record but actual sending
  // must use a verified domain. Set FROM_EMAIL env var once a domain is verified.
  const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'
  const fromEmail = FROM_EMAIL
  const fromName = campaign.from_name || 'IFG Team'
  const replyTo = campaign.reply_to || campaign.from_email || fromEmail

  // Send emails to batch
  let successCount = 0
  let failCount = 0

  for (const recipient of pendingRecipients) {
    const contact = Array.isArray(recipient.contact)
      ? recipient.contact[0]
      : recipient.contact

    if (!contact?.email) {
      // Mark as failed - no email
      await supabase
        .from('campaign_recipients')
        .update({
          status: 'failed',
          error_message: 'No email address',
          sent_at: new Date().toISOString()
        })
        .eq('id', recipient.id)

      failCount++
      continue
    }

    try {
      // Call send-email edge function
      const sendResult = await sendEmail(supabase, {
        to: contact.email,
        from_name: fromName,
        from_email: fromEmail,
        reply_to: replyTo,
        subject: emailSubject,
        html_body: emailBody,
        contact_id: contact.id,
        campaign_id: campaign.id,
        merge_data: {
          first_name: contact.first_name || '',
          last_name: contact.last_name || '',
          email: contact.email,
        },
      })

      if (sendResult.success) {
        // Update recipient as sent
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            resend_message_id: sendResult.message_id,
          })
          .eq('id', recipient.id)

        successCount++
      } else {
        // Update recipient as failed
        const errorMsg = sendResult.error || 'Email send failed - no error details'
        console.error(`Failed to send to ${contact.email}: ${errorMsg}`)
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'failed',
            error_message: errorMsg,
            sent_at: new Date().toISOString(),
          })
          .eq('id', recipient.id)

        failCount++
      }
    } catch (error) {
      // Update recipient as failed
      const errorMsg = error.message || 'Unknown error during send'
      console.error(`Exception sending to recipient ${recipient.id}: ${errorMsg}`)
      await supabase
        .from('campaign_recipients')
        .update({
          status: 'failed',
          error_message: errorMsg,
          sent_at: new Date().toISOString(),
        })
        .eq('id', recipient.id)

      failCount++
    }

    // Small delay between sends to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Update campaign progress
  const newProcessedCount = campaign.processed_recipients + successCount + failCount

  // Check if all recipients are now processed
  const { count: remainingCount } = await supabase
    .from('campaign_recipients')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')

  if (remainingCount === 0) {
    // All recipients processed — check if any actually succeeded
    const { count: sentCount } = await supabase
      .from('campaign_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('status', 'sent')

    const allFailed = (sentCount ?? 0) === 0 && newProcessedCount > 0

    await supabase
      .from('campaigns')
      .update({
        status: allFailed ? 'failed' : 'sent',
        sent_at: new Date().toISOString(),
        processed_recipients: newProcessedCount,
        last_processed_at: new Date().toISOString(),
        error_message: allFailed ? `All ${newProcessedCount} recipients failed` : null,
      })
      .eq('id', campaign.id)

    summary.campaignsCompleted.push(campaign.id)
    console.log(`Campaign ${campaign.id} completed after batch (${allFailed ? 'all failed' : 'sent'})`)
  } else {
    // More to process - just update progress
    await supabase
      .from('campaigns')
      .update({
        processed_recipients: newProcessedCount,
        last_processed_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)
  }

  summary.emailsSent += successCount
  summary.emailsFailed += failCount

  console.log(`Batch complete: ${successCount} sent, ${failCount} failed, ${remainingCount} remaining`)
}

async function expandRecipients(
  supabase: ReturnType<typeof createClient>,
  campaign: Campaign
): Promise<number> {
  const listIds = campaign.recipient_list_ids || []

  if (listIds.length === 0) {
    return 0
  }

  // Get unique contacts from all lists
  const { data: contactLists, error } = await supabase
    .from('contact_lists')
    .select('contact_id')
    .in('list_id', listIds)

  if (error) {
    throw new Error(`Failed to fetch contacts from lists: ${error.message}`)
  }

  if (!contactLists || contactLists.length === 0) {
    return 0
  }

  // Deduplicate contact IDs
  const uniqueContactIds = [...new Set(contactLists.map(cl => cl.contact_id))]

  console.log(`Expanding ${uniqueContactIds.length} unique recipients from ${listIds.length} lists`)

  // Insert recipients in batches (Supabase has limits on insert size)
  const insertBatchSize = 100
  for (let i = 0; i < uniqueContactIds.length; i += insertBatchSize) {
    const batch = uniqueContactIds.slice(i, i + insertBatchSize)
    const recipients = batch.map(contactId => ({
      campaign_id: campaign.id,
      contact_id: contactId,
      status: 'pending',
    }))

    const { error: insertError } = await supabase
      .from('campaign_recipients')
      .upsert(recipients, {
        onConflict: 'campaign_id,contact_id',
        ignoreDuplicates: true
      })

    if (insertError) {
      console.error('Failed to insert recipients batch:', insertError)
      // Continue with other batches
    }
  }

  return uniqueContactIds.length
}

async function sendEmail(
  supabase: ReturnType<typeof createClient>,
  params: {
    to: string
    from_name: string
    from_email: string
    reply_to: string
    subject: string
    html_body: string
    contact_id: string
    campaign_id: string
    merge_data?: Record<string, string>
  }
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' }
    }

    console.log(`Sending email to ${params.to} for campaign ${params.campaign_id}`)

    // Apply merge tags to subject and body
    let processedSubject = params.subject
    let processedBody = params.html_body

    if (params.merge_data) {
      for (const [key, value] of Object.entries(params.merge_data)) {
        const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
        processedSubject = processedSubject.replace(pattern, value || '')
        processedBody = processedBody.replace(pattern, value || '')
      }
    }

    // Send via Resend directly
    const resend = new Resend(resendApiKey)
    const { data, error: resendError } = await resend.emails.send({
      from: `${params.from_name} <${params.from_email}>`,
      to: [params.to],
      reply_to: params.reply_to,
      subject: processedSubject,
      html: processedBody,
    })

    if (resendError) {
      console.error('Resend error:', JSON.stringify(resendError))
      return { success: false, error: resendError.message }
    }

    const messageId = data?.id || null
    const trackingId = crypto.randomUUID()

    // Log to email_sends table
    await supabase.from('email_sends').insert({
      tracking_id: trackingId,
      recipient_email: params.to,
      recipient_contact_id: params.contact_id,
      campaign_id: params.campaign_id,
      subject: processedSubject,
      status: 'sent',
      resend_message_id: messageId,
      sent_at: new Date().toISOString(),
    })

    console.log(`Email sent to ${params.to}, message_id: ${messageId}`)
    return { success: true, message_id: messageId }

  } catch (error) {
    console.error('Send email error:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}
