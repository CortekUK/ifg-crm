import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Webhook } from 'svix'

// Resend webhook events
type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.complained'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked'

interface ResendWebhookPayload {
  type: ResendEventType
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    click?: {
      link: string
      timestamp: string
    }
    bounce?: {
      message: string
    }
  }
}

export async function POST(request: NextRequest) {
  const debug: Record<string, unknown> = {}

  try {
    const payload = await request.text()

    // Verify webhook signature using Svix (Resend's webhook provider)
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    let event: ResendWebhookPayload

    if (webhookSecret) {
      try {
        const wh = new Webhook(webhookSecret)
        const svixHeaders = {
          'svix-id': request.headers.get('svix-id') || '',
          'svix-timestamp': request.headers.get('svix-timestamp') || '',
          'svix-signature': request.headers.get('svix-signature') || '',
        }
        const verified = wh.verify(payload, svixHeaders)
        debug.verified = true
        debug.rawKeys = Object.keys(verified as object)
        event = verified as unknown as ResendWebhookPayload
      } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else {
      event = JSON.parse(payload)
      debug.verified = false
    }

    // Extract event type - Resend may put type at top level or we may need the svix header
    const eventType = event.type || request.headers.get('svix-event-type') as ResendEventType
    debug.eventType = eventType
    debug.eventTypeFromBody = event.type
    debug.eventTypeFromHeader = request.headers.get('svix-event-type')
    debug.emailId = event.data?.email_id

    if (!eventType) {
      debug.error = 'No event type found'
      return NextResponse.json({ received: true, debug })
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      debug.error = 'Missing Supabase credentials'
      return NextResponse.json({ received: true, debug })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find the email_send record by resend_message_id
    const { data: emailSend, error: findError } = await supabase
      .from('email_sends')
      .select('id, recipient_contact_id, campaign_id, automation_log_id, status')
      .eq('resend_message_id', event.data.email_id)
      .single()

    debug.emailSendFound = !!emailSend
    debug.emailSendId = emailSend?.id
    debug.campaignId = emailSend?.campaign_id
    if (findError) debug.findError = findError.message

    // Idempotency: skip if this event has already been processed
    // Status progression: sent → delivered → opened → clicked (terminal: bounced, complained)
    const statusRank: Record<string, number> = {
      sent: 0, delivered: 1, opened: 2, clicked: 3, bounced: 99, complained: 99,
    }
    const eventToStatus: Record<string, string> = {
      'email.delivered': 'delivered',
      'email.opened': 'opened',
      'email.clicked': 'clicked',
      'email.bounced': 'bounced',
      'email.complained': 'complained',
    }
    const incomingStatus = eventToStatus[eventType]
    if (emailSend && incomingStatus) {
      const currentRank = statusRank[emailSend.status] ?? 0
      const incomingRank = statusRank[incomingStatus] ?? 0
      // Allow re-processing of opens/clicks (they increment counters), but skip if terminal or same non-counter event
      const isCounterEvent = eventType === 'email.opened' || eventType === 'email.clicked'
      if (!isCounterEvent && currentRank >= incomingRank) {
        debug.action = `skipped (already ${emailSend.status})`
        return NextResponse.json({ received: true, debug })
      }
    }

    // Process based on event type
    switch (eventType) {
      case 'email.delivered':
        if (emailSend) {
          const { error: updateError } = await supabase
            .from('email_sends')
            .update({
              status: 'delivered',
              delivered_at: event.created_at,
            })
            .eq('id', emailSend.id)
          debug.updateError = updateError?.message || null
          debug.action = 'delivered'
        }
        break

      case 'email.opened':
        if (emailSend) {
          const { data: currentEmail } = await supabase
            .from('email_sends')
            .select('open_count')
            .eq('id', emailSend.id)
            .single()

          const { error: updateError } = await supabase
            .from('email_sends')
            .update({
              status: 'opened',
              opened_at: event.created_at,
              open_count: (currentEmail?.open_count || 0) + 1,
            })
            .eq('id', emailSend.id)
          debug.updateError = updateError?.message || null
          debug.action = 'opened'
        }
        break

      case 'email.clicked':
        if (emailSend) {
          const { data: currentEmailForClick } = await supabase
            .from('email_sends')
            .select('click_count')
            .eq('id', emailSend.id)
            .single()

          const { error: updateError } = await supabase
            .from('email_sends')
            .update({
              status: 'clicked',
              clicked_at: event.created_at,
              click_count: (currentEmailForClick?.click_count || 0) + 1,
            })
            .eq('id', emailSend.id)
          debug.updateError = updateError?.message || null
          debug.action = 'clicked'

          if (event.data.click?.link) {
            try {
              await supabase.from('email_clicks').insert({
                email_send_id: emailSend.id,
                contact_id: emailSend.recipient_contact_id,
                link_url: event.data.click.link,
                clicked_at: event.data.click.timestamp || event.created_at,
              })
            } catch {
              // Table might not exist yet
            }
          }
        }
        break

      case 'email.bounced':
        if (emailSend) {
          // Primary update: mark email as bounced
          const { error: updateError } = await supabase
            .from('email_sends')
            .update({
              status: 'bounced',
              bounced_at: event.created_at,
              error_message: event.data.bounce?.message || 'Email bounced',
            })
            .eq('id', emailSend.id)
          debug.updateError = updateError?.message || null
          debug.action = 'bounced'

          if (updateError) {
            // Primary update failed — skip secondary updates
            debug.secondarySkipped = 'primary update failed'
            break
          }

          // Secondary updates: run in parallel, isolate failures
          const bounceSecondary: Promise<{ op: string; error?: string }>[] = []

          if (emailSend.recipient_contact_id) {
            bounceSecondary.push(
              Promise.resolve(
                supabase
                  .from('contacts')
                  .update({ email_valid: false })
                  .eq('id', emailSend.recipient_contact_id)
              ).then(({ error: e }) => ({ op: 'contact_email_valid', error: e?.message }))
            )
          }

          if (emailSend.automation_log_id) {
            bounceSecondary.push(
              (async () => {
                const { data: log } = await supabase
                  .from('automation_logs')
                  .select('enrollment_id')
                  .eq('id', emailSend.automation_log_id)
                  .single()

                if (log?.enrollment_id) {
                  const { error: e } = await supabase
                    .from('automation_enrollments')
                    .update({
                      status: 'stopped',
                      stopped_reason: 'Email bounced',
                      next_step_at: null,
                    })
                    .eq('id', log.enrollment_id)
                  return { op: 'stop_enrollment', error: e?.message }
                }
                return { op: 'stop_enrollment', error: undefined }
              })()
            )
          }

          if (bounceSecondary.length > 0) {
            const results = await Promise.allSettled(bounceSecondary)
            debug.secondaryResults = results.map((r) =>
              r.status === 'fulfilled' ? r.value : { op: 'unknown', error: String(r.reason) }
            )
          }
        }
        break

      case 'email.complained':
        if (emailSend) {
          // Primary update: mark email as complained
          const { error: updateError } = await supabase
            .from('email_sends')
            .update({
              status: 'complained',
              error_message: 'Recipient marked as spam',
            })
            .eq('id', emailSend.id)
          debug.updateError = updateError?.message || null
          debug.action = 'complained'

          if (updateError) {
            debug.secondarySkipped = 'primary update failed'
            break
          }

          // Secondary updates: run in parallel, isolate failures
          const complainSecondary: Promise<{ op: string; error?: string }>[] = []

          if (emailSend.recipient_contact_id) {
            complainSecondary.push(
              Promise.resolve(
                supabase
                  .from('contacts')
                  .update({
                    email_unsubscribed: true,
                    email_unsubscribed_at: event.created_at,
                  })
                  .eq('id', emailSend.recipient_contact_id)
              ).then(({ error: e }) => ({ op: 'unsubscribe_contact', error: e?.message }))
            )
          }

          if (emailSend.automation_log_id) {
            complainSecondary.push(
              (async () => {
                const { data: log } = await supabase
                  .from('automation_logs')
                  .select('enrollment_id')
                  .eq('id', emailSend.automation_log_id)
                  .single()

                if (log?.enrollment_id) {
                  const { error: e } = await supabase
                    .from('automation_enrollments')
                    .update({
                      status: 'stopped',
                      stopped_reason: 'Recipient complained (spam)',
                      next_step_at: null,
                    })
                    .eq('id', log.enrollment_id)
                  return { op: 'stop_enrollment', error: e?.message }
                }
                return { op: 'stop_enrollment', error: undefined }
              })()
            )
          }

          if (complainSecondary.length > 0) {
            const results = await Promise.allSettled(complainSecondary)
            debug.secondaryResults = results.map((r) =>
              r.status === 'fulfilled' ? r.value : { op: 'unknown', error: String(r.reason) }
            )
          }
        }
        break

      case 'email.delivery_delayed':
        if (emailSend) {
          // Note: 'delayed' not in CHECK constraint, use 'sent' to avoid constraint error
          debug.action = 'delivery_delayed (no-op)'
        }
        break

      default:
        debug.action = `unhandled: ${eventType}`
    }

    // Roll up stats to the campaigns table
    if (emailSend?.campaign_id && ['email.delivered', 'email.opened', 'email.clicked', 'email.bounced'].includes(eventType)) {
      try {
        const campaignId = emailSend.campaign_id

        const [delivered, opened, clicked, bounced] = await Promise.all([
          supabase.from('email_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).not('delivered_at', 'is', null),
          supabase.from('email_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).not('opened_at', 'is', null),
          supabase.from('email_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).not('clicked_at', 'is', null),
          supabase.from('email_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'bounced'),
        ])

        const { error: rollupError } = await supabase
          .from('campaigns')
          .update({
            delivered_count: delivered.count || 0,
            open_count: opened.count || 0,
            click_count: clicked.count || 0,
            bounce_count: bounced.count || 0,
          })
          .eq('id', campaignId)

        debug.rollup = {
          delivered: delivered.count,
          opened: opened.count,
          clicked: clicked.count,
          bounced: bounced.count,
          error: rollupError?.message || null,
        }
      } catch (err) {
        debug.rollupError = err instanceof Error ? err.message : 'Unknown'
      }
    }

    // Also update campaign_recipients status to match
    if (emailSend?.campaign_id && event.data.email_id) {
      const statusMap: Record<string, string> = {
        'email.delivered': 'delivered',
        'email.opened': 'opened',
        'email.clicked': 'clicked',
        'email.bounced': 'failed',
      }
      const recipientStatus = statusMap[eventType]
      if (recipientStatus) {
        try {
          await supabase
            .from('campaign_recipients')
            .update({
              status: recipientStatus,
              ...(eventType === 'email.delivered' ? { delivered_at: event.created_at } : {}),
              ...(eventType === 'email.opened' ? { opened_at: event.created_at } : {}),
              ...(eventType === 'email.clicked' ? { clicked_at: event.created_at } : {}),
              ...(eventType === 'email.bounced' ? { error_message: event.data.bounce?.message || 'Bounced' } : {}),
            })
            .eq('campaign_id', emailSend.campaign_id)
            .eq('resend_message_id', event.data.email_id)
        } catch (err) {
          console.error('Failed to update campaign_recipients:', err)
        }
      }
    }

    return NextResponse.json({ received: true, debug })

  } catch (error) {
    console.error('Resend webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', debug },
      { status: 500 }
    )
  }
}

// Resend may send GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'resend-webhook' })
}
