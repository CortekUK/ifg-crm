// Supabase Edge Function: ClickSend Inbound SMS
// Handles incoming SMS messages from ClickSend and creates sms_messages records

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

    // ClickSend inbound SMS payload format:
    // { from: "+61411111111", to: "+61422222222", body: "message text", ... }
    // Can also be array of messages
    const messages = Array.isArray(payload) ? payload : [payload]

    let processed = 0
    let errors = 0

    for (const msg of messages) {
      try {
        const senderPhone = msg.from || msg.from_number
        const recipientPhone = msg.to || msg.to_number
        const content = msg.body || msg.message || ''

        if (!senderPhone || !content) {
          console.log('Skipping inbound SMS with missing from or body:', JSON.stringify(msg))
          continue
        }

        // Try to match sender phone to a contact
        // Normalize phone: strip spaces/dashes, try matching with and without country code
        const normalizedPhone = senderPhone.replace(/[\s\-()]/g, '')
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .or(`phone.eq.${normalizedPhone},phone.eq.${senderPhone}`)
          .limit(1)
          .single()

        // Try to find which pipeline this number is associated with
        // by matching the recipient phone (our ClickSend number)
        let pipelineId: string | null = null
        if (recipientPhone) {
          const normalizedRecipient = recipientPhone.replace(/[\s\-()]/g, '')
          // Check sms_sends for recent outbound to this sender from a specific pipeline
          const { data: recentSend } = await supabase
            .from('sms_sends')
            .select('campaign_id')
            .eq('recipient_phone', normalizedPhone)
            .order('sent_at', { ascending: false })
            .limit(1)
            .single()

          if (recentSend?.campaign_id) {
            const { data: campaign } = await supabase
              .from('campaigns')
              .select('pipeline_id')
              .eq('id', recentSend.campaign_id)
              .single()

            pipelineId = campaign?.pipeline_id || null
          }
        }

        // Create sms_messages record
        const { error: insertError } = await supabase
          .from('sms_messages')
          .insert({
            contact_id: contact?.id || null,
            phone_number: senderPhone,
            direction: 'inbound',
            content,
            click_send_number: recipientPhone || null,
            pipeline_id: pipelineId,
            match_status: contact?.id ? 'auto_matched' : 'unmatched',
          })

        if (insertError) {
          console.error('Failed to insert sms_messages:', insertError)
          errors++
        } else {
          processed++
          console.log(`Inbound SMS from ${senderPhone} → contact: ${contact?.id || 'unmatched'}`)
        }
      } catch (err) {
        console.error('Error processing inbound SMS:', err)
        errors++
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, errors }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Inbound SMS webhook error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
