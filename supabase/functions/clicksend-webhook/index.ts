// Supabase Edge Function: ClickSend Webhook
// Handles delivery status callbacks from ClickSend

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payload = await req.json()

    // ClickSend webhook payload contains delivery status updates
    // The payload can be a single event or an array
    const events = Array.isArray(payload) ? payload : [payload]

    let processed = 0
    let errors = 0

    for (const event of events) {
      try {
        const messageId = event.message_id || event.messageid
        const status = normalizeStatus(event.status_code || event.status)

        if (!messageId || !status) {
          console.log('Skipping event with missing message_id or status:', JSON.stringify(event))
          continue
        }

        // Look up the sms_sends record by clicksend_message_id
        const { data: smsSend, error: lookupError } = await supabase
          .from('sms_sends')
          .select('id, status, campaign_id')
          .eq('clicksend_message_id', messageId)
          .single()

        if (lookupError || !smsSend) {
          console.log(`No sms_sends record found for message_id: ${messageId}`)
          continue
        }

        // Update the status
        const updates: Record<string, unknown> = { status }

        if (status === 'delivered') {
          updates.delivered_at = new Date().toISOString()
        }

        if (status === 'failed' || status === 'bounced') {
          updates.error_message = event.status_text || event.error_text || null
        }

        const { error: updateError } = await supabase
          .from('sms_sends')
          .update(updates)
          .eq('id', smsSend.id)

        if (updateError) {
          console.error(`Failed to update sms_sends ${smsSend.id}:`, updateError)
          errors++
        } else {
          processed++
          console.log(`Updated sms_sends ${smsSend.id} to ${status}`)

          // Roll up stats to the campaigns table (mirror Resend webhook pattern)
          if (smsSend.campaign_id && (status === 'delivered' || status === 'bounced' || status === 'failed')) {
            try {
              const campaignId = smsSend.campaign_id

              const [delivered, bounced] = await Promise.all([
                supabase.from('sms_sends').select('id', { count: 'exact', head: true })
                  .eq('campaign_id', campaignId).eq('status', 'delivered'),
                supabase.from('sms_sends').select('id', { count: 'exact', head: true })
                  .eq('campaign_id', campaignId).in('status', ['bounced', 'failed']),
              ])

              await supabase
                .from('campaigns')
                .update({
                  delivered_count: delivered.count || 0,
                  bounce_count: bounced.count || 0,
                })
                .eq('id', campaignId)
            } catch (err) {
              console.error(`Failed to rollup stats for campaign ${smsSend.campaign_id}:`, err)
            }
          }
        }
      } catch (err) {
        console.error('Error processing webhook event:', err)
        errors++
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, errors }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Normalize ClickSend status codes to our internal status values
 */
function normalizeStatus(statusCode: string | number | undefined): string | null {
  if (!statusCode) return null

  const code = String(statusCode).toUpperCase()

  // ClickSend status codes
  // See: https://developers.clicksend.com/docs/rest/v3/#status-codes
  switch (code) {
    case 'SUCCESS':
    case 'DELIVERED':
    case '201': // Delivered
      return 'delivered'
    case 'BOUNCED':
    case '301': // Undeliverable
      return 'bounced'
    case 'FAILED':
    case 'REJECTED':
    case '401': // Message rejected
    case '501': // Internal error
      return 'failed'
    default:
      // If it looks like a success code, treat as delivered
      if (code.startsWith('2')) return 'delivered'
      // Otherwise treat as failed
      if (code.startsWith('3') || code.startsWith('4') || code.startsWith('5')) return 'failed'
      return null
  }
}
