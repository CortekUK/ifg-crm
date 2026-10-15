// Supabase Edge Function: Resend Inbound Reply Handler
//
// LEGACY. Resend inbound is being replaced by SES receiving — see
// ses-inbound/index.ts. This stays deployed until the Resend account is
// cancelled, so that a reply still in flight to the old address is not lost.
//
// All it does now is turn Resend's payload into an InboundMessage. Everything
// that happens to a reply lives in _shared/inbound-core.ts and is shared with
// the SES path, so a fix lands in both.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Webhook } from 'npm:svix@1.15.0'
import { firstNonBlank, handleInboundMessage, stripHtml } from '../_shared/inbound-core.ts'

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

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
    const rawBody = await req.text()
    let event: ResendInboundEmail

    if (webhookSecret) {
      const svixId = req.headers.get('svix-id')
      const svixTimestamp = req.headers.get('svix-timestamp')
      const svixSignature = req.headers.get('svix-signature')

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.error('Missing Svix headers')
        return json({ error: 'Missing webhook signature headers' }, 400)
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
        return json({ error: 'Invalid webhook signature' }, 401)
      }
    } else {
      // No secret configured - parse body directly (development mode)
      console.warn('RESEND_WEBHOOK_SECRET not configured - skipping signature verification')
      event = JSON.parse(rawBody) as ResendInboundEmail
    }

    if (event.type !== 'email.received') {
      console.log(`Ignoring non-inbound event type: ${event.type}`)
      return json({ success: true, message: 'Event type not handled' }, 200)
    }

    console.log(`Processing inbound email from: ${event.data.from}`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Resend's email.received webhook only carries metadata. The body (for
    // display + AI classification) and the In-Reply-To / References headers
    // (for thread stitching) both come from /emails/receiving/{id}.
    const fetched = await fetchInboundBody(event.data.email_id)

    const outcome = await handleInboundMessage(supabase, {
      // event.data.from is the bare address — no display name — so every
      // reply was stored with from_name null (0 of 38 in the live table). The
      // From: header on the fetched message is where "Hamza Shafique"
      // <hamza@...> actually is.
      from: fetched.from || event.data.from,
      // The receiving response's `to` field carries the VERP-encoded address
      // we set as Reply-To on the outbound — that's how the tracking_id is
      // recovered.
      to: fetched.to ?? (event.data.to as string[] | undefined) ?? null,
      subject: event.data.subject || null,
      // The fetch is the reliable source, but if it fails the webhook payload
      // is better than storing an empty body for a reply we know arrived.
      text:
        firstNonBlank(
          fetched.text,
          stripHtml(fetched.html || ''),
          event.data.text,
          stripHtml(event.data.html || ''),
        ) || null,
      html: fetched.html || event.data.html || null,
      headers: fetched.headers,
      inReplyTo: fetched.inReplyTo || event.data.in_reply_to || null,
      references: fetched.references || null,
      messageId: event.data.message_id || null,
      receivedAt: event.created_at || new Date().toISOString(),
    })

    return json(outcome.body, outcome.status)
  } catch (error) {
    console.error('Inbound webhook processing error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

/**
 * Fetch the full body + headers of an inbound email from Resend.
 * The email.received webhook only contains metadata; we need the In-Reply-To
 * header (for thread stitching) and the rendered text/html (for display).
 * Both come from GET /emails/receiving/{id}.
 */
async function fetchInboundBody(
  emailId: string
): Promise<{
  text: string | null
  html: string | null
  inReplyTo: string | null
  references: string | null
  to: string[] | null
  /** The raw `From:` header, which is where the sender's display name lives. */
  from: string | null
  /** All headers, lower-cased keys — read by detectAutoReply. */
  headers: Record<string, string>
}> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const empty = {
    text: null,
    html: null,
    inReplyTo: null,
    references: null,
    to: null,
    from: null,
    headers: {} as Record<string, string>,
  }
  if (!apiKey || !emailId) return empty

  try {
    const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!response.ok) {
      console.error(`Resend inbound fetch failed: ${response.status} ${await response.text()}`)
      return empty
    }

    const body = await response.json() as {
      text?: string | null
      html?: string | null
      headers?: Record<string, string | string[]> | null
      in_reply_to?: string | null
      references?: string | string[] | null
      to?: string[] | string | null
    }

    // Header keys arrive case-insensitively across providers — normalize.
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(body.headers ?? {})) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v.join(' ') : (v ?? '')
    }

    const inReplyTo =
      body.in_reply_to ??
      headers['in-reply-to'] ??
      null

    const referencesRaw = body.references ?? headers['references'] ?? null
    const references = Array.isArray(referencesRaw) ? referencesRaw.join(' ') : referencesRaw

    // The receiving response's `to` field (or `to` header) carries the
    // VERP-encoded address we set as Reply-To on the outbound — that's how
    // we recover the tracking_id.
    const toRaw = body.to ?? headers['to'] ?? null
    const to = Array.isArray(toRaw) ? toRaw : (toRaw ? [toRaw] : null)

    return {
      text: body.text ?? null,
      html: body.html ?? null,
      inReplyTo,
      references,
      to,
      // The webhook's event.data.from is the bare address — no display name —
      // so every reply was stored with from_name null (0 of 38 in the live
      // table). The From: header on the fetched message is where "Hamza
      // Shafique" <hamza@...> actually is.
      from: headers['from'] || null,
      headers,
    }
  } catch (err) {
    console.error('Resend inbound fetch error:', err)
    return empty
  }
}

