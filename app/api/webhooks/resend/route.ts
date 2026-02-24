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
        event = wh.verify(payload, svixHeaders) as unknown as ResendWebhookPayload
      } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else {
      event = JSON.parse(payload)
    }

    console.log(`Received Resend webhook: ${event.type}`, {
      email_id: event.data.email_id,
      to: event.data.to,
    })

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find the email_send record by resend_message_id
    const { data: emailSend, error: findError } = await supabase
      .from('email_sends')
      .select('id, recipient_contact_id, campaign_id, automation_log_id')
      .eq('resend_message_id', event.data.email_id)
      .single()

    if (findError && findError.code !== 'PGRST116') {
      console.error('Error finding email send:', findError)
    }

    // Process based on event type
    switch (event.type) {
      case 'email.delivered':
        if (emailSend) {
          await supabase
            .from('email_sends')
            .update({
              status: 'delivered',
              delivered_at: event.created_at,
            })
            .eq('id', emailSend.id)
        }
        break

      case 'email.opened':
        if (emailSend) {
          // Get current open count and increment
          const { data: currentEmail } = await supabase
            .from('email_sends')
            .select('open_count')
            .eq('id', emailSend.id)
            .single()

          await supabase
            .from('email_sends')
            .update({
              status: 'opened',
              opened_at: event.created_at,
              open_count: (currentEmail?.open_count || 0) + 1,
            })
            .eq('id', emailSend.id)
        }
        break

      case 'email.clicked':
        if (emailSend) {
          // Get current click count and increment
          const { data: currentEmailForClick } = await supabase
            .from('email_sends')
            .select('click_count')
            .eq('id', emailSend.id)
            .single()

          await supabase
            .from('email_sends')
            .update({
              status: 'clicked',
              clicked_at: event.created_at,
              click_count: (currentEmailForClick?.click_count || 0) + 1,
            })
            .eq('id', emailSend.id)

          // Log the click with URL if available
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
          await supabase
            .from('email_sends')
            .update({
              status: 'bounced',
              bounced_at: event.created_at,
              error_message: event.data.bounce?.message || 'Email bounced',
            })
            .eq('id', emailSend.id)

          // Mark contact email as invalid
          if (emailSend.recipient_contact_id) {
            await supabase
              .from('contacts')
              .update({ email_valid: false })
              .eq('id', emailSend.recipient_contact_id)
          }

          // Stop any active automation enrollments for this contact
          if (emailSend.automation_log_id) {
            const { data: log } = await supabase
              .from('automation_logs')
              .select('enrollment_id')
              .eq('id', emailSend.automation_log_id)
              .single()

            if (log?.enrollment_id) {
              await supabase
                .from('automation_enrollments')
                .update({
                  status: 'stopped',
                  stopped_reason: 'Email bounced',
                  next_step_at: null,
                })
                .eq('id', log.enrollment_id)
            }
          }
        }
        break

      case 'email.complained':
        if (emailSend) {
          await supabase
            .from('email_sends')
            .update({
              status: 'complained',
              error_message: 'Recipient marked as spam',
            })
            .eq('id', emailSend.id)

          // Mark contact as unsubscribed/do not contact
          if (emailSend.recipient_contact_id) {
            await supabase
              .from('contacts')
              .update({ 
                email_unsubscribed: true,
                email_unsubscribed_at: event.created_at,
              })
              .eq('id', emailSend.recipient_contact_id)
          }

          // Stop any active automation enrollments
          if (emailSend.automation_log_id) {
            const { data: log } = await supabase
              .from('automation_logs')
              .select('enrollment_id')
              .eq('id', emailSend.automation_log_id)
              .single()

            if (log?.enrollment_id) {
              await supabase
                .from('automation_enrollments')
                .update({
                  status: 'stopped',
                  stopped_reason: 'Recipient complained (spam)',
                  next_step_at: null,
                })
                .eq('id', log.enrollment_id)
            }
          }
        }
        break

      case 'email.delivery_delayed':
        if (emailSend) {
          await supabase
            .from('email_sends')
            .update({ status: 'delayed' })
            .eq('id', emailSend.id)
        }
        break

      default:
        console.log(`Unhandled Resend event type: ${event.type}`)
    }

    // Roll up stats to the campaigns table
    if (emailSend?.campaign_id && ['email.delivered', 'email.opened', 'email.clicked', 'email.bounced'].includes(event.type)) {
      try {
        // Count unique recipients per status from email_sends for this campaign
        const campaignId = emailSend.campaign_id

        // delivered = any email that got delivered (including those later opened/clicked)
        // opened = any email opened (including those later clicked)
        // clicked = any email with a link click
        // bounced = any email that bounced
        const [delivered, opened, clicked, bounced] = await Promise.all([
          supabase.from('email_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).not('delivered_at', 'is', null),
          supabase.from('email_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).not('opened_at', 'is', null),
          supabase.from('email_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).not('clicked_at', 'is', null),
          supabase.from('email_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'bounced'),
        ])

        await supabase
          .from('campaigns')
          .update({
            delivered_count: delivered.count || 0,
            open_count: opened.count || 0,
            click_count: clicked.count || 0,
            bounce_count: bounced.count || 0,
          })
          .eq('id', campaignId)
      } catch (err) {
        console.error('Failed to update campaign stats:', err)
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
      const recipientStatus = statusMap[event.type]
      if (recipientStatus) {
        try {
          await supabase
            .from('campaign_recipients')
            .update({
              status: recipientStatus,
              ...(event.type === 'email.delivered' ? { delivered_at: event.created_at } : {}),
              ...(event.type === 'email.opened' ? { opened_at: event.created_at } : {}),
              ...(event.type === 'email.clicked' ? { clicked_at: event.created_at } : {}),
              ...(event.type === 'email.bounced' ? { error_message: event.data.bounce?.message || 'Bounced' } : {}),
            })
            .eq('campaign_id', emailSend.campaign_id)
            .eq('resend_message_id', event.data.email_id)
        } catch (err) {
          console.error('Failed to update campaign_recipients:', err)
        }
      }
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Resend webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Resend may send GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'resend-webhook' })
}
