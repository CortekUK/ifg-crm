// Supabase Edge Function: Calendly Webhook Handler
// Receives webhook events from Calendly and syncs to database

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, calendly-webhook-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CalendlyInvitee {
  uri: string
  email: string
  name: string
  timezone: string
  created_at: string
  updated_at: string
  canceled: boolean
  cancellation?: {
    canceled_by: string
    reason: string
  }
}

interface CalendlyEvent {
  uri: string
  name: string
  start_time: string
  end_time: string
  event_type: string
  location?: {
    type: string
    location?: string
    join_url?: string
  }
  invitees_counter: {
    total: number
    active: number
    limit: number
  }
}

interface CalendlyUser {
  uri: string
  email: string
  name: string
}

interface CalendlyWebhookPayload {
  event: 'invitee.created' | 'invitee.canceled'
  created_at: string
  payload: {
    event: CalendlyEvent
    invitee: CalendlyInvitee
    scheduled_event?: {
      uri: string
      name: string
      start_time: string
      end_time: string
      event_type: string
      location?: {
        type: string
        location?: string
        join_url?: string
      }
    }
    event_membership?: {
      user: string // user URI
    }
    event_type?: {
      uuid: string
      uri: string
      name: string
      slug: string
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Initialize Supabase client with service role
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Get the raw body for signature verification
    const rawBody = await req.text()
    
    // Verify webhook signature if secret is configured
    const webhookSecret = Deno.env.get('CALENDLY_WEBHOOK_SECRET')
    const signature = req.headers.get('calendly-webhook-signature')
    
    if (webhookSecret && signature) {
      const isValid = verifySignature(rawBody, signature, webhookSecret)
      if (!isValid) {
        console.error('Invalid webhook signature')
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Parse the webhook payload
    const payload: CalendlyWebhookPayload = JSON.parse(rawBody)
    
    console.log('Calendly webhook received:', payload.event)

    // Handle the event
    switch (payload.event) {
      case 'invitee.created':
        await handleInviteeCreated(supabase, payload)
        break
      case 'invitee.canceled':
        await handleInviteeCanceled(supabase, payload)
        break
      default:
        console.log('Unhandled event type:', payload.event)
    }

    return new Response(
      JSON.stringify({ success: true, event: payload.event }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Calendly webhook error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Verify Calendly webhook signature
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    // Calendly uses HMAC-SHA256 for webhook signatures
    // Format: t=timestamp,v1=signature
    const parts = signature.split(',')
    const timestamp = parts.find(p => p.startsWith('t='))?.slice(2)
    const v1Signature = parts.find(p => p.startsWith('v1='))?.slice(3)

    if (!timestamp || !v1Signature) {
      return false
    }

    // Recreate the signed payload
    const signedPayload = `${timestamp}.${payload}`
    const expectedSignature = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex')

    return v1Signature === expectedSignature
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * Handle invitee.created event - new meeting scheduled
 */
async function handleInviteeCreated(
  supabase: ReturnType<typeof createClient>,
  payload: CalendlyWebhookPayload
) {
  const { event: scheduledEvent, invitee } = payload.payload
  
  // Extract event details
  const eventData = payload.payload.scheduled_event || scheduledEvent
  const eventTypeData = payload.payload.event_type
  
  // Find contact by email
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('email', invitee.email.toLowerCase())
    .single()

  // Find recruiter/host by Calendly user URI
  let recruiterId: string | null = null
  const hostUri = payload.payload.event_membership?.user
  
  if (hostUri) {
    const { data: recruiter } = await supabase
      .from('profiles')
      .select('id')
      .eq('calendly_user_uri', hostUri)
      .single()
    
    recruiterId = recruiter?.id || null
  }

  // Find associated deal for this contact
  let dealId: string | null = null
  if (contact) {
    const { data: deal } = await supabase
      .from('deals')
      .select('id')
      .eq('contact_id', contact.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    dealId = deal?.id || null
  }

  // Calculate duration in minutes
  const startTime = new Date(eventData.start_time)
  const endTime = new Date(eventData.end_time)
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

  // Extract location details
  const location = eventData.location?.type || 'Unknown'
  const joinUrl = eventData.location?.join_url || null

  // Create calendly_events record
  const { data: createdEvent, error } = await supabase
    .from('calendly_events')
    .upsert({
      contact_id: contact?.id || null,
      user_id: recruiterId,
      deal_id: dealId,
      event_type: eventTypeData?.slug || 'meeting',
      event_name: eventData.name || eventTypeData?.name || 'Calendly Meeting',
      start_time: eventData.start_time,
      end_time: eventData.end_time,
      duration_minutes: durationMinutes,
      location,
      join_url: joinUrl,
      status: 'scheduled',
      calendly_event_id: extractIdFromUri(eventData.uri),
      calendly_invitee_id: extractIdFromUri(invitee.uri),
      calendly_event_uri: eventData.uri,
      invitee_email: invitee.email,
      invitee_name: invitee.name,
      invitee_timezone: invitee.timezone,
    }, {
      onConflict: 'calendly_event_id',
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create calendly event:', error)
    throw error
  }

  console.log('Created Calendly event:', createdEvent?.id)

  // If we have a deal, log the activity
  if (dealId) {
    await supabase.from('deal_activities').insert({
      deal_id: dealId,
      activity_type: 'meeting_scheduled',
      description: `Calendly meeting scheduled: ${eventData.name} on ${formatDateTime(startTime)}`,
      performed_by_id: recruiterId,
      metadata: {
        calendly_event_id: createdEvent?.id,
        start_time: eventData.start_time,
        join_url: joinUrl,
      },
    })

    // Check if deal should be moved to "Zoom Scheduled" stage
    await checkAndMoveDealToZoomStage(supabase, dealId)
  }

  // If we have a contact but no deal, still log to contact activity
  if (contact && !dealId) {
    console.log('Calendly event created for contact without active deal:', contact.id)
  }
}

/**
 * Handle invitee.canceled event - meeting cancelled
 */
async function handleInviteeCanceled(
  supabase: ReturnType<typeof createClient>,
  payload: CalendlyWebhookPayload
) {
  const { event: scheduledEvent, invitee } = payload.payload
  const eventData = payload.payload.scheduled_event || scheduledEvent
  
  const calendlyEventId = extractIdFromUri(eventData.uri)
  
  // Update the event status to cancelled
  const { data: updatedEvent, error } = await supabase
    .from('calendly_events')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: invitee.cancellation?.reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('calendly_event_id', calendlyEventId)
    .select('id, deal_id, event_name')
    .single()

  if (error) {
    console.error('Failed to update cancelled event:', error)
    // Don't throw - event might not exist
    return
  }

  console.log('Cancelled Calendly event:', updatedEvent?.id)

  // Log cancellation activity if associated with a deal
  if (updatedEvent?.deal_id) {
    await supabase.from('deal_activities').insert({
      deal_id: updatedEvent.deal_id,
      activity_type: 'meeting_cancelled',
      description: `Calendly meeting cancelled: ${updatedEvent.event_name}`,
      metadata: {
        calendly_event_id: updatedEvent.id,
        cancellation_reason: invitee.cancellation?.reason,
      },
    })
  }
}

/**
 * Check if a deal should be moved to "Zoom Scheduled" stage
 */
async function checkAndMoveDealToZoomStage(
  supabase: ReturnType<typeof createClient>,
  dealId: string
) {
  // Get the deal and its pipeline
  const { data: deal } = await supabase
    .from('deals')
    .select('id, pipeline_id, current_stage_id')
    .eq('id', dealId)
    .single()

  if (!deal) return

  // Find a stage named "Zoom Scheduled" or similar in the same pipeline
  const { data: zoomStage } = await supabase
    .from('stages')
    .select('id, name')
    .eq('pipeline_id', deal.pipeline_id)
    .or('name.ilike.%zoom%,name.ilike.%scheduled%,name.ilike.%meeting%')
    .limit(1)
    .single()

  if (!zoomStage || zoomStage.id === deal.current_stage_id) {
    // No matching stage or already in that stage
    return
  }

  // Check if auto-move is enabled (could be a setting, for now we'll skip auto-move)
  // This is a placeholder for future configuration
  const autoMoveEnabled = false

  if (autoMoveEnabled) {
    await supabase
      .from('deals')
      .update({
        current_stage_id: zoomStage.id,
        stage_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', dealId)

    console.log(`Auto-moved deal ${dealId} to stage ${zoomStage.name}`)
  }
}

/**
 * Extract ID from Calendly URI
 */
function extractIdFromUri(uri: string): string {
  const parts = uri.split('/')
  return parts[parts.length - 1]
}

/**
 * Format date/time for display
 */
function formatDateTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
