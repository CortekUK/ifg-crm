// Supabase Edge Function: Resend Inbound Reply Handler
// Receives inbound email webhooks from Resend when contacts reply to automation emails
// Creates email_replies records and triggers automation exit conditions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Webhook } from 'npm:svix@1.15.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
}

// Resend inbound email webhook payload structure
interface ResendInboundEmail {
  type: 'email.received'
  created_at: string
  data: {
    email_id: string
    from: string  // "Name <email@example.com>" format
    to: string[]
    cc?: string[]
    bcc?: string[]
    reply_to?: string[]
    subject: string
    text?: string
    html?: string
    headers?: Record<string, string>
    attachments?: Array<{
      filename: string
      content_type: string
      content: string  // base64 encoded
    }>
    // Threading information
    in_reply_to?: string
    references?: string[]
    message_id?: string
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Get webhook secret for verification
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
    
    // Get the raw body for signature verification
    const rawBody = await req.text()
    let event: ResendInboundEmail

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const svixId = req.headers.get('svix-id')
      const svixTimestamp = req.headers.get('svix-timestamp')
      const svixSignature = req.headers.get('svix-signature')

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.error('Missing Svix headers')
        return new Response(
          JSON.stringify({ error: 'Missing webhook signature headers' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      try {
        const wh = new Webhook(webhookSecret)
        event = wh.verify(rawBody, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        }) as ResendInboundEmail
      } catch (err) {
        console.error('Webhook verification failed:', err)
        return new Response(
          JSON.stringify({ error: 'Invalid webhook signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // No secret configured - parse body directly (development mode)
      console.warn('RESEND_WEBHOOK_SECRET not configured - skipping signature verification')
      event = JSON.parse(rawBody) as ResendInboundEmail
    }

    // Only process inbound email events
    if (event.type !== 'email.received') {
      console.log(`Ignoring non-inbound event type: ${event.type}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Event type not handled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing inbound email from: ${event.data.from}`)

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse the "from" field to extract email and name
    const { email: fromEmail, name: fromName } = parseEmailAddress(event.data.from)

    if (!fromEmail) {
      console.error('Could not parse from email address:', event.data.from)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid from address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // 1. FIND THE CONTACT by email address
    // ============================================
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name')
      .ilike('email', fromEmail)
      .limit(1)
      .single()

    const contactId = contact?.id || null
    const matchStatus = contact ? 'matched' : 'unmatched'

    if (contactError && contactError.code !== 'PGRST116') {
      console.error('Error finding contact:', contactError)
    }

    // ============================================
    // 2. TRY TO LINK TO ORIGINAL EMAIL (if reply)
    // ============================================
    let linkedEmailSendId: string | null = null

    if (event.data.in_reply_to) {
      // Try to find the original email by message_id
      const { data: originalEmail } = await supabase
        .from('email_sends')
        .select('id, automation_log_id')
        .eq('resend_message_id', event.data.in_reply_to.replace(/[<>]/g, ''))
        .single()

      if (originalEmail) {
        linkedEmailSendId = originalEmail.id
      }
    }

    // ============================================
    // 3. CREATE EMAIL REPLY RECORD
    // ============================================
    const { data: replyRecord, error: insertError } = await supabase
      .from('email_replies')
      .insert({
        contact_id: contactId,
        email_send_id: linkedEmailSendId,
        from_email: fromEmail,
        from_name: fromName || null,
        subject: event.data.subject || null,
        body_preview: truncateText(event.data.text || stripHtml(event.data.html || ''), 500),
        message_id: event.data.message_id || null,
        in_reply_to: event.data.in_reply_to || null,
        received_at: event.created_at || new Date().toISOString(),
        processed: false,  // Will be processed by check-replies or process-automations
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Error creating email reply record:', insertError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create reply record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Created email reply record: ${replyRecord.id}, contact: ${contactId}, match_status: ${matchStatus}`)

    // ============================================
    // 4. CHECK FOR IMMEDIATE EXIT CONDITIONS
    // ============================================
    let enrollmentsStopped = 0

    if (contactId) {
      // Find active enrollments for this contact's deals where exit_on_reply is enabled
      const { data: enrollmentsToStop, error: enrollmentError } = await supabase
        .from('automation_enrollments')
        .select(`
          id,
          automation_id,
          deal_id,
          automation:automations(exit_on_reply, config)
        `)
        .eq('status', 'active')
        .in('deal_id', 
          supabase
            .from('deals')
            .select('id')
            .eq('contact_id', contactId)
        )

      if (enrollmentError) {
        console.error('Error finding enrollments to stop:', enrollmentError)
      } else if (enrollmentsToStop && enrollmentsToStop.length > 0) {
        for (const enrollment of enrollmentsToStop) {
          // Check if automation should exit on reply
          const automation = enrollment.automation as { exit_on_reply?: boolean; config?: { exit_on_reply?: boolean } } | null
          const exitOnReply = automation?.exit_on_reply ?? automation?.config?.exit_on_reply ?? true

          if (exitOnReply) {
            // Stop the enrollment
            const { error: stopError } = await supabase
              .from('automation_enrollments')
              .update({
                status: 'stopped',
                stopped_reason: 'Contact replied to email',
                next_step_at: null,
              })
              .eq('id', enrollment.id)

            if (stopError) {
              console.error(`Failed to stop enrollment ${enrollment.id}:`, stopError)
            } else {
              enrollmentsStopped++
              console.log(`Stopped enrollment ${enrollment.id} - contact replied`)

              // Log the stop in automation_logs
              await supabase.from('automation_logs').insert({
                enrollment_id: enrollment.id,
                step_id: null,
                deal_id: enrollment.deal_id,
                status: 'skipped',
                sent_at: new Date().toISOString(),
                log_type: 'enrollment_stopped',
                error_message: 'Contact replied to email',
              })
            }
          }
        }
      }
    }

    // ============================================
    // 5. MARK REPLY AS PROCESSED (if we stopped enrollments)
    // ============================================
    if (enrollmentsStopped > 0) {
      await supabase
        .from('email_replies')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq('id', replyRecord.id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        reply_id: replyRecord.id,
        contact_id: contactId,
        match_status: matchStatus,
        enrollments_stopped: enrollmentsStopped,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Inbound webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Parse an email address from "Name <email@example.com>" format
 */
function parseEmailAddress(from: string): { email: string | null; name: string | null } {
  if (!from) return { email: null, name: null }

  // Try to match "Name <email@example.com>" format
  const match = from.match(/^(?:"?([^"<]*)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?$/)
  
  if (match) {
    return {
      name: match[1]?.trim() || null,
      email: match[2]?.toLowerCase() || null,
    }
  }

  // If no match, assume the whole string is an email
  if (from.includes('@')) {
    return { email: from.toLowerCase().trim(), name: null }
  }

  return { email: null, name: null }
}

/**
 * Strip HTML tags from a string
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}
