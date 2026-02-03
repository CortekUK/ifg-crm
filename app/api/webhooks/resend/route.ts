import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

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

// Verify Resend webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    console.warn('Missing signature or secret for webhook verification')
    return false
  }

  try {
    // Resend uses HMAC SHA256
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    // Compare signatures (timing-safe comparison)
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const signature = request.headers.get('svix-signature') || request.headers.get('resend-signature')

    // Verify webhook signature in production
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (webhookSecret && process.env.NODE_ENV === 'production') {
      if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
        console.error('Invalid webhook signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }

    const event: ResendWebhookPayload = JSON.parse(payload)

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
