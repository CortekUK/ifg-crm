// Supabase Edge Function: Email Webhook Handler
// Receives and processes email events from Resend (opens, clicks, bounces, complaints)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Webhook } from 'npm:svix@1.15.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
}

// Resend webhook event types
interface ResendWebhookEvent {
  type: 'email.sent' | 'email.delivered' | 'email.delivery_delayed' | 'email.complained' | 'email.bounced' | 'email.opened' | 'email.clicked'
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    // Additional fields for specific events
    click?: {
      ipAddress: string
      link: string
      timestamp: string
      userAgent: string
    }
    open?: {
      ipAddress: string
      timestamp: string
      userAgent: string
    }
    bounce?: {
      message: string
    }
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
    let event: ResendWebhookEvent

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
        }) as ResendWebhookEvent
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
      event = JSON.parse(rawBody) as ResendWebhookEvent
    }

    console.log(`Processing webhook event: ${event.type}`, event.data.email_id)

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find the email send record by Resend message ID
    const { data: emailSend, error: findError } = await supabase
      .from('email_sends')
      .select('id, automation_log_id, open_count, click_count, status')
      .eq('resend_message_id', event.data.email_id)
      .single()

    if (findError || !emailSend) {
      // Try to find by recipient email as fallback (for older records)
      console.log(`Email send not found for message_id: ${event.data.email_id}`)
      
      // Return success anyway - don't want Resend to keep retrying
      return new Response(
        JSON.stringify({ success: true, message: 'Email record not found, event ignored' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process based on event type
    const now = new Date().toISOString()

    switch (event.type) {
      case 'email.delivered': {
        await supabase
          .from('email_sends')
          .update({
            status: 'delivered',
            delivered_at: now,
          })
          .eq('id', emailSend.id)
        break
      }

      case 'email.opened': {
        const isFirstOpen = emailSend.open_count === 0

        await supabase
          .from('email_sends')
          .update({
            status: 'opened',
            opened_at: isFirstOpen ? now : undefined, // Only set on first open
            open_count: (emailSend.open_count || 0) + 1,
          })
          .eq('id', emailSend.id)

        // Update automation step stats if this is an automation email
        if (emailSend.automation_log_id && isFirstOpen) {
          await updateAutomationStepStats(supabase, emailSend.automation_log_id, 'opened')
        }
        break
      }

      case 'email.clicked': {
        const isFirstClick = emailSend.click_count === 0

        await supabase
          .from('email_sends')
          .update({
            status: 'clicked',
            clicked_at: isFirstClick ? now : undefined, // Only set on first click
            click_count: (emailSend.click_count || 0) + 1,
          })
          .eq('id', emailSend.id)

        // Update automation step stats if this is an automation email
        if (emailSend.automation_log_id && isFirstClick) {
          await updateAutomationStepStats(supabase, emailSend.automation_log_id, 'clicked')
        }
        break
      }

      case 'email.bounced': {
        await supabase
          .from('email_sends')
          .update({
            status: 'bounced',
            bounced_at: now,
            error_message: event.data.bounce?.message || 'Email bounced',
          })
          .eq('id', emailSend.id)

        // Update contact subscription status if we have contact info
        const { data: emailRecord } = await supabase
          .from('email_sends')
          .select('recipient_contact_id')
          .eq('id', emailSend.id)
          .single()

        if (emailRecord?.recipient_contact_id) {
          await supabase
            .from('contacts')
            .update({ subscription_status: 'bounced' })
            .eq('id', emailRecord.recipient_contact_id)
        }
        break
      }

      case 'email.complained': {
        await supabase
          .from('email_sends')
          .update({
            status: 'complained',
            complained_at: now,
          })
          .eq('id', emailSend.id)

        // Update contact subscription status and mark as unsubscribed
        const { data: emailRecord } = await supabase
          .from('email_sends')
          .select('recipient_contact_id')
          .eq('id', emailSend.id)
          .single()

        if (emailRecord?.recipient_contact_id) {
          await supabase
            .from('contacts')
            .update({ subscription_status: 'unsubscribed' })
            .eq('id', emailRecord.recipient_contact_id)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ success: true, event_type: event.type }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Update automation step stats when an email is opened or clicked
 */
async function updateAutomationStepStats(
  supabase: ReturnType<typeof createClient>,
  automationLogId: string,
  eventType: 'opened' | 'clicked'
) {
  try {
    // Get the automation log to find the step
    const { data: log, error: logError } = await supabase
      .from('automation_logs')
      .select('step_id')
      .eq('id', automationLogId)
      .single()

    if (logError || !log?.step_id) {
      console.error('Failed to find automation log:', logError)
      return
    }

    // Get current stats for the step
    const { data: step, error: stepError } = await supabase
      .from('automation_steps')
      .select('stats')
      .eq('id', log.step_id)
      .single()

    if (stepError) {
      console.error('Failed to find automation step:', stepError)
      return
    }

    // Update stats
    const currentStats = (step?.stats as Record<string, number>) || {}
    const statKey = eventType === 'opened' ? 'opened' : 'clicked'
    const newValue = (currentStats[statKey] || 0) + 1

    await supabase
      .from('automation_steps')
      .update({
        stats: {
          ...currentStats,
          [statKey]: newValue,
        },
      })
      .eq('id', log.step_id)

    console.log(`Updated automation step ${log.step_id} stats: ${statKey} = ${newValue}`)

  } catch (err) {
    console.error('Error updating automation step stats:', err)
  }
}
