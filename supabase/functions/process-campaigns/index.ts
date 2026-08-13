// Supabase Edge Function: Process Campaign Emails & SMS
// This function handles sending campaign emails and SMS in batches
// Called by Vercel cron job every minute

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@2.0.0'
import { sendSMS } from '../_shared/clicksend.ts'
import { buildOutboundMessageId, buildReplyToAddress } from '../_shared/message-id.ts'
import { replaceMergeTags } from '../_shared/merge-tags.ts'

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
  from_user_id: string | null
  created_by_id: string | null
  total_recipients: number
  processed_recipients: number
  scheduled_at: string | null
}

interface ProcessingSummary {
  campaignsProcessed: number
  emailsSent: number
  emailsFailed: number
  smsSent: number
  smsFailed: number
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
    smsSent: 0,
    smsFailed: 0,
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
      contact:contacts(id, first_name, last_name, email, phone, sms_subscribed)
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

  console.log(`Sending to ${pendingRecipients.length} recipients (type: ${campaign.type})`)

  // Resolve the campaign's "from" user once. Templates reference owner-style
  // tags ({{deal_owner_name}}, {{deal_owner_calendly}}, etc.) and conditional
  // blocks ({{#if deal_owner_title}}...{{/if}}). Campaigns aren't tied to a
  // specific deal, so the sender profile fills those slots.
  const senderId = campaign.from_user_id || campaign.created_by_id
  let sender: {
    full_name: string | null
    email: string | null
    phone: string | null
    title: string | null
    calendly_url: string | null
    email_signature: string | null
    avatar_url: string | null
  } | null = null
  if (senderId) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, email, phone, title, calendly_url, email_signature, avatar_url')
      .eq('id', senderId)
      .maybeSingle()
    sender = data ?? null
  }

  // ============================================
  // SMS CAMPAIGN BRANCH
  // ============================================
  if (campaign.type === 'sms') {
    // Guard: reject campaigns with no SMS content
    if (!campaign.sms_content) {
      await supabase
        .from('campaigns')
        .update({
          status: 'failed',
          error_message: 'No SMS content — compose a message before sending.',
          last_processed_at: new Date().toISOString(),
        })
        .eq('id', campaign.id)

      summary.campaignsCompleted.push(campaign.id)
      console.log(`Campaign ${campaign.id} failed: no SMS content`)
      return
    }

    let successCount = 0
    let failCount = 0

    for (const recipient of pendingRecipients) {
      const contact = Array.isArray(recipient.contact)
        ? recipient.contact[0]
        : recipient.contact

      if (!contact?.phone) {
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'failed',
            error_message: 'No phone number',
            sent_at: new Date().toISOString(),
          })
          .eq('id', recipient.id)
        failCount++
        continue
      }

      if (contact.sms_subscribed === false) {
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'failed',
            error_message: 'Contact not SMS subscribed',
            sent_at: new Date().toISOString(),
          })
          .eq('id', recipient.id)
        failCount++
        continue
      }

      try {
        // Replace merge tags in SMS content using the canonical engine
        // (handles {{key|fallback}} and {{#if key}}...{{/if}} blocks).
        const mergeData = buildCampaignMergeData(contact, sender)
        const processedContent = replaceMergeTags(campaign.sms_content, mergeData)

        // Send via ClickSend
        const smsResult = await sendSMS({
          to: contact.phone,
          body: processedContent,
          source: `campaign-${campaign.id}`,
        })

        if (smsResult.success) {
          await supabase
            .from('campaign_recipients')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
            })
            .eq('id', recipient.id)

          // Log to sms_sends table
          await supabase.from('sms_sends').insert({
            recipient_phone: contact.phone,
            recipient_contact_id: contact.id,
            campaign_id: campaign.id,
            content: processedContent,
            status: 'sent',
            clicksend_message_id: smsResult.message_id,
            segments: smsResult.segments || 1,
            sent_at: new Date().toISOString(),
          })

          successCount++
        } else {
          const errorMsg = smsResult.error || 'SMS send failed'
          console.error(`Failed to send SMS to ${contact.phone}: ${errorMsg}`)
          await supabase
            .from('campaign_recipients')
            .update({
              status: 'failed',
              error_message: errorMsg,
              sent_at: new Date().toISOString(),
            })
            .eq('id', recipient.id)

          // Log failed send
          await supabase.from('sms_sends').insert({
            recipient_phone: contact.phone,
            recipient_contact_id: contact.id,
            campaign_id: campaign.id,
            content: processedContent,
            status: 'failed',
            error_message: errorMsg,
            sent_at: new Date().toISOString(),
          })

          failCount++
        }
      } catch (error) {
        const errorMsg = error.message || 'Unknown error during SMS send'
        console.error(`Exception sending SMS to recipient ${recipient.id}: ${errorMsg}`)
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
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Update campaign progress
    await updateCampaignProgress(supabase, campaign, successCount, failCount, summary)
    summary.smsSent += successCount
    summary.smsFailed += failCount
    console.log(`SMS batch complete: ${successCount} sent, ${failCount} failed`)
    return
  }

  // ============================================
  // EMAIL CAMPAIGN BRANCH
  // ============================================

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

  // Guard: reject campaigns with no email content
  if (!emailBody) {
    await supabase
      .from('campaigns')
      .update({
        status: 'failed',
        error_message: 'No email content — add a template or compose a body before sending.',
        last_processed_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)

    summary.campaignsCompleted.push(campaign.id)
    console.log(`Campaign ${campaign.id} failed: no email content`)
    return
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
      // Build full merge data per recipient — contact fields plus sender
      // mapped onto deal_owner_* slots so templates that reference
      // {{deal_owner_name}}, {{#if deal_owner_calendly}}…{{/if}}, etc.
      // resolve correctly for broadcast campaigns (no per-deal owner).
      const sendResult = await sendEmail(supabase, {
        to: contact.email,
        from_name: fromName,
        from_email: fromEmail,
        reply_to: replyTo,
        subject: emailSubject,
        html_body: emailBody,
        contact_id: contact.id,
        campaign_id: campaign.id,
        merge_data: buildCampaignMergeData(contact, sender),
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
  await updateCampaignProgress(supabase, campaign, successCount, failCount, summary)
  summary.emailsSent += successCount
  summary.emailsFailed += failCount

  console.log(`Email batch complete: ${successCount} sent, ${failCount} failed`)
}

async function updateCampaignProgress(
  supabase: ReturnType<typeof createClient>,
  campaign: Campaign,
  successCount: number,
  failCount: number,
  summary: ProcessingSummary
): Promise<void> {
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

  // Filter out unsubscribed/bounced contacts
  // For SMS campaigns, also require sms_subscribed = true
  let contactQuery = supabase
    .from('contacts')
    .select('id')
    .in('id', uniqueContactIds)
    .eq('subscription_status', 'subscribed')

  if (campaign.type === 'sms') {
    contactQuery = contactQuery.eq('sms_subscribed', true)
  }

  const { data: subscribedContacts, error: subError } = await contactQuery

  if (subError) {
    throw new Error(`Failed to filter unsubscribed contacts: ${subError.message}`)
  }

  const subscribedIds = (subscribedContacts || []).map(c => c.id)
  const filteredOut = uniqueContactIds.length - subscribedIds.length
  if (filteredOut > 0) {
    console.log(`Filtered out ${filteredOut} unsubscribed/bounced contacts`)
  }

  console.log(`Expanding ${subscribedIds.length} subscribed recipients from ${listIds.length} lists`)

  // Insert recipients in batches (Supabase has limits on insert size)
  const insertBatchSize = 100
  for (let i = 0; i < subscribedIds.length; i += insertBatchSize) {
    const batch = subscribedIds.slice(i, i + insertBatchSize)
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

  return subscribedIds.length
}

// Shape returned from the campaign sender profile lookup. Kept loose because
// any field can be null — templates handle missing values via {{|fallback}}
// and {{#if}}…{{/if}} blocks once we route through replaceMergeTags.
type CampaignSender = {
  full_name: string | null
  email: string | null
  phone: string | null
  title: string | null
  calendly_url: string | null
  email_signature: string | null
  avatar_url: string | null
} | null

type CampaignContact = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
}

function buildCampaignMergeData(
  contact: CampaignContact,
  sender: CampaignSender
): Record<string, string | number | boolean | null | undefined> {
  return {
    // Contact fields
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    email: contact.email || '',
    phone: contact.phone || null,
    // Owner / sender fields — campaigns are broadcast and not deal-scoped, so
    // we map the campaign's "from" user into the deal_owner_* slots that the
    // shared templates expect.
    deal_owner_name: sender?.full_name || 'The Team',
    deal_owner_email: sender?.email || '',
    deal_owner_phone: sender?.phone || null,
    deal_owner_title: sender?.title || null,
    deal_owner_calendly: sender?.calendly_url || null,
    deal_owner_signature: sender?.email_signature || null,
    deal_owner_photo: sender?.avatar_url || null,
  }
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
    merge_data?: Record<string, string | number | boolean | null | undefined>
  }
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' }
    }

    console.log(`Sending email to ${params.to} for campaign ${params.campaign_id}`)

    // Apply merge tags to subject and body via the canonical engine —
    // supports {{field}}, {{field|fallback}}, {{#if field}}…{{/if}}, etc.
    const mergeData = params.merge_data ?? {}
    const processedSubject = replaceMergeTags(params.subject, mergeData)
    const processedBody = replaceMergeTags(params.html_body, mergeData)

    // Generate trackingId up-front so we can use it as the local part of
    // both the Reply-To (VERP) and the Message-ID we set on the outbound.
    // The contact's reply lands at replies+{tracking_id}@reply.<domain>, so
    // the inbound webhook recovers it from the To: header — no Message-ID
    // guessing needed even if SES rewrites our custom header.
    const trackingId = crypto.randomUUID()
    const trackingReplyTo = buildReplyToAddress(trackingId, `${params.from_name} at IFG`)

    // Send via Resend directly
    const resend = new Resend(resendApiKey)
    const { data, error: resendError } = await resend.emails.send({
      from: `${params.from_name} <${params.from_email}>`,
      to: [params.to],
      reply_to: trackingReplyTo ?? params.reply_to,
      subject: processedSubject,
      html: processedBody,
      headers: {
        'Message-ID': buildOutboundMessageId(trackingId),
      },
    })

    if (resendError) {
      console.error('Resend error:', JSON.stringify(resendError))
      return { success: false, error: resendError.message }
    }

    const messageId = data?.id || null

    // Log to email_sends table
    await supabase.from('email_sends').insert({
      tracking_id: trackingId,
      recipient_email: params.to,
      recipient_contact_id: params.contact_id,
      campaign_id: params.campaign_id,
      subject: processedSubject,
      body_html: processedBody,
      from_name: params.from_name,
      from_email: params.from_email,
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
