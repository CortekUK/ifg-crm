// Supabase Edge Function: Resend Inbound Reply Handler
// Receives inbound email webhooks from Resend when contacts reply to automation emails
// Creates email_replies records and triggers automation exit conditions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Webhook } from 'npm:svix@1.15.0'
import { extractTrackingUuids, extractTrackingIdFromTo } from '../_shared/message-id.ts'

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
    // Use the canonical enum values the rest of the app expects. Previously
    // this set 'matched' which isn't a valid match_status, so the row fell
    // back to 'unmatched' and was only ever flipped to 'manually_matched' by
    // a human. As a result no reply was ever marked auto_matched.
    const matchStatus = contact ? 'auto_matched' : 'unmatched'

    if (contactError && contactError.code !== 'PGRST116') {
      console.error('Error finding contact:', contactError)
    }

    // ============================================
    // 2. FETCH FULL EMAIL BODY + HEADERS FROM RESEND API
    // ============================================
    // Resend's email.received webhook only carries metadata. We need the body
    // (for display + AI classification) and the In-Reply-To / References
    // headers (for thread stitching). Both come from /emails/receiving/{id}.
    const fetched = await fetchInboundBody(event.data.email_id)
    const replyText = fetched.text || stripHtml(fetched.html || '')
    const inReplyTo = fetched.inReplyTo || event.data.in_reply_to || null
    const references = fetched.references || null
    const inboundTo = fetched.to ?? (event.data.to as string[] | undefined) ?? null

    // ============================================
    // 2.5 RESOLVE THE OUTBOUND EMAIL THIS REPLIES TO
    // ============================================
    // Primary path: VERP — extract the tracking_id from the To: address
    // (replies+{tracking_id}@reply.<domain>) and look up email_sends directly.
    // Falls through to In-Reply-To header matching if VERP isn't present.
    const linkedEmailSendId = await resolveThreadEmailSendId(
      supabase,
      contactId,
      inboundTo,
      inReplyTo,
      references
    )

    // Once we know the originating email_send, derive campaign_id and
    // pipeline_id so the Replies list can show which programme the contact
    // was contacted under. Done here (rather than in the trigger) so the
    // values are present from the very first read of the row.
    const replySourceMeta = await deriveReplySourceMeta(supabase, linkedEmailSendId)

    // ============================================
    // 3. CREATE EMAIL REPLY RECORD (idempotent on message_id)
    // ============================================
    // Resend retries failed webhook deliveries, and our fixes today caused a
    // backlog of retries to land at once. We dedupe by RFC Message-Id (unique
    // partial index, migration 084) so retries become no-ops.
    const messageId = event.data.message_id || null
    let replyRecord: { id: string } | null = null

    if (messageId) {
      // Short-circuit duplicates without touching the table — avoids needless
      // load and lets us return 200 fast so Resend stops retrying.
      const { data: existing } = await supabase
        .from('email_replies')
        .select('id')
        .eq('message_id', messageId)
        .maybeSingle()

      if (existing) {
        console.log(`Duplicate webhook for message_id ${messageId}, skipping (existing reply ${existing.id})`)
        return new Response(
          JSON.stringify({ success: true, deduped: true, reply_id: existing.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const { data: insertedReply, error: insertError } = await supabase
      .from('email_replies')
      .insert({
        contact_id: contactId,
        email_send_id: linkedEmailSendId,
        campaign_id: replySourceMeta.campaignId,
        pipeline_id: replySourceMeta.pipelineId,
        from_email: fromEmail,
        from_name: fromName || null,
        subject: event.data.subject || null,
        body_preview: truncateText(replyText, 500),
        body: replyText || null,
        html_body: fetched.html || null,
        message_id: messageId,
        in_reply_to: inReplyTo,
        received_at: event.created_at || new Date().toISOString(),
        match_status: matchStatus,
        processed: false,  // Will be processed by check-replies or process-automations
      })
      .select('id')
      .single()

    if (insertError) {
      // 23505 = unique_violation. Treat as a successful dedupe — concurrent
      // retry won the race, our work is done.
      if ((insertError as { code?: string }).code === '23505') {
        console.log(`Race-condition duplicate for message_id ${messageId}, skipping`)
        return new Response(
          JSON.stringify({ success: true, deduped: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.error('Error creating email reply record:', insertError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create reply record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    replyRecord = insertedReply
    console.log(`Created email reply record: ${replyRecord.id}, contact: ${contactId}, match_status: ${matchStatus}`)

    // ============================================
    // 3.5 CLASSIFY REPLY INTENT WITH AI
    // ============================================
    // Strip the quoted-thread boilerplate before classifying. Without
    // this, a contact's one-word reply ("interested") gets buried under
    // hundreds of chars of our original outreach and the classifier
    // returns nothing matching the valid set → ai_intent stays null.
    const aiIntent = await classifyIntent(stripQuotedThread(replyText))

    if (aiIntent) {
      await supabase
        .from('email_replies')
        .update({ ai_intent: aiIntent })
        .eq('id', replyRecord.id)
      console.log(`Classified reply ${replyRecord.id} intent: ${aiIntent}`)

      // Tag the deal with the reply's intent and auto-move it into the
      // pipeline's "Contact Response" stage so the recruiter can triage
      // the inbox at a glance. We only act when we have both a matched
      // contact and a known pipeline (campaign or automation chain).
      // Deals already past the Contact Response stage are left alone —
      // the kanban shouldn't roll a deal backwards just because a reply
      // landed.
      if (contactId && replySourceMeta.pipelineId) {
        const { data: deal } = await supabase
          .from('deals')
          .select('id, current_stage_id, pipeline_id')
          .eq('contact_id', contactId)
          .eq('pipeline_id', replySourceMeta.pipelineId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (deal) {
          // Always tag the latest intent — overrides any previous reply.
          await supabase
            .from('deals')
            .update({ intent: aiIntent })
            .eq('id', deal.id)

          // Find the Contact Response stage in this pipeline and check
          // whether the deal should be moved.
          const { data: stages } = await supabase
            .from('pipeline_stages')
            .select('id, name, display_order')
            .eq('pipeline_id', deal.pipeline_id)
            .order('display_order', { ascending: true })

          if (stages && stages.length > 0) {
            const responseStage = stages.find((s) => s.name === 'Contact Response')
            const currentIdx = stages.findIndex((s) => s.id === deal.current_stage_id)
            const responseIdx = responseStage
              ? stages.findIndex((s) => s.id === responseStage.id)
              : -1
            if (responseStage && responseIdx >= 0 && currentIdx < responseIdx) {
              await supabase
                .from('deals')
                .update({
                  current_stage_id: responseStage.id,
                  // Column is `stage_entered_at` on this schema — using
                  // the wrong name made the whole UPDATE fail silently
                  // (Postgres rejects unknown columns), which is why
                  // intent was getting written but the deal never moved.
                  stage_entered_at: new Date().toISOString(),
                })
                .eq('id', deal.id)
              console.log(
                `Moved deal ${deal.id} to Contact Response stage (intent: ${aiIntent})`,
              )
            }
          }
        }
      }
    }

    // Exit-on-reply is now handled by the email_reply_match_stops_enrollments
    // trigger (migration 083). The trigger fires on insert and on any later
    // update of contact_id, so Smart Match and manual match get the same
    // exit behaviour as auto-match without us having to call anything here.

    return new Response(
      JSON.stringify({
        success: true,
        reply_id: replyRecord.id,
        contact_id: contactId,
        match_status: matchStatus,
        ai_intent: aiIntent || null,
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
 * Walk back from email_send to figure out which campaign and/or pipeline this
 * reply belongs to, so the Replies list can render those columns.
 *
 * Two paths through the schema:
 *   - Campaign blast:   email_send.campaign_id      → campaigns.pipeline_id
 *   - Automation drip:  email_send.automation_log_id → automation_logs.enrollment_id
 *                       → automation_enrollments.automation_id → automations.pipeline_id
 *
 * Returns nulls (not undefined) so the insert column list works regardless.
 */
async function deriveReplySourceMeta(
  supabase: ReturnType<typeof createClient>,
  emailSendId: string | null
): Promise<{ campaignId: string | null; pipelineId: string | null }> {
  if (!emailSendId) return { campaignId: null, pipelineId: null }

  const { data: send, error } = await supabase
    .from('email_sends')
    .select('campaign_id, automation_log_id')
    .eq('id', emailSendId)
    .single()

  if (error || !send) {
    if (error) console.error('deriveReplySourceMeta: email_sends lookup failed:', error)
    return { campaignId: null, pipelineId: null }
  }

  // Campaign path — the simpler of the two.
  if (send.campaign_id) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('pipeline_id')
      .eq('id', send.campaign_id)
      .single()
    return {
      campaignId: send.campaign_id,
      pipelineId: campaign?.pipeline_id ?? null,
    }
  }

  // Automation path — chase the chain to get the automation's pipeline.
  if (send.automation_log_id) {
    const { data: log } = await supabase
      .from('automation_logs')
      .select('enrollment:automation_enrollments(automation:automations(pipeline_id))')
      .eq('id', send.automation_log_id)
      .single()

    const enrollment = (log as unknown as {
      enrollment?: { automation?: { pipeline_id?: string | null } | null } | null
    } | null)?.enrollment
    return {
      campaignId: null,
      pipelineId: enrollment?.automation?.pipeline_id ?? null,
    }
  }

  return { campaignId: null, pipelineId: null }
}

/**
 * Classify the intent of a reply using OpenAI gpt-4o-mini.
 * Returns one of: positive | negative | neutral | question | unknown
 * Or null when classification was skipped or failed (caller stores NULL).
 *
 * Guardrails:
 *   - skip if body > 2000 chars (cost cap; long emails are usually quoted threads)
 *   - skip if body is empty
 *   - on API failure, return null silently (don't break the inbound pipeline)
 */
const CLASSIFICATION_PROMPT = `You are classifying the intent of a reply to a business outreach/recruitment email.

Classify as exactly one of:
- positive: Interested, wants to learn more, agrees to meeting/call, asks about opportunity details
- negative: Not interested, asks to be removed, opt-out, do not contact, already employed/not looking
- question: Asking a question that needs a human response (salary, role details, timeline) without clear positive/negative signal
- neutral: Auto-reply, out of office, acknowledgment without clear intent, forwarded without comment
- unknown: Cannot determine intent, too short/ambiguous, or in a language that cannot be classified

Respond with ONLY the classification word, nothing else.`

const MAX_CLASSIFICATION_CHARS = 2000

/**
 * Strip the quoted-reply thread that mail clients append to a reply,
 * leaving just the new content the contact actually typed.
 *
 * Cuts at:
 *   - the first "On <date>, <name> wrote:" separator (Gmail / Apple Mail)
 *   - the first line that starts with ">" (the canonical quote prefix)
 *   - the first "-----Original Message-----" / "From: ..." block (Outlook)
 *
 * Always preserves the leading lines so a one-word reply ("interested")
 * survives. Falls back to the original text when no quote markers are
 * present.
 */
function stripQuotedThread(text: string): string {
  if (!text) return ''
  const patterns: RegExp[] = [
    /^On .+ wrote:\s*$/im,
    /^>+\s?/m,
    /^-----\s*Original Message\s*-----\s*$/im,
    /^From:\s.+$/im,
    /^Sent from my (iPhone|iPad|Android|Samsung)/im,
  ]
  let cutAt = text.length
  for (const re of patterns) {
    const m = re.exec(text)
    if (m && typeof m.index === 'number' && m.index < cutAt) {
      cutAt = m.index
    }
  }
  const head = text.slice(0, cutAt).trim()
  return head.length > 0 ? head : text.trim()
}

async function classifyIntent(text: string): Promise<string | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey || !text) return null

  // Cost guardrail: long emails (typically quoted threads) eat tokens for no
  // gain. The intent of a 5000-char message is in the first paragraph anyway;
  // skip rather than send the whole thing.
  if (text.length > MAX_CLASSIFICATION_CHARS) {
    console.log(`Skipping intent classification (length ${text.length} > ${MAX_CLASSIFICATION_CHARS})`)
    return null
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 5,
        temperature: 0,
        messages: [
          { role: 'system', content: CLASSIFICATION_PROMPT },
          { role: 'user', content: text },
        ],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      console.error('OpenAI API error:', response.status, errBody.slice(0, 200))
      return null
    }

    const result = await response.json()
    const intent = result.choices?.[0]?.message?.content?.trim().toLowerCase()

    const validIntents = ['positive', 'negative', 'neutral', 'question', 'unknown']
    return validIntents.includes(intent) ? intent : null
  } catch (err) {
    console.error('Intent classification failed:', err)
    return null
  }
}

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
}> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const empty = { text: null, html: null, inReplyTo: null, references: null, to: null }
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
    }
  } catch (err) {
    console.error('Resend inbound fetch error:', err)
    return empty
  }
}

/**
 * Resolve which outbound email_send a reply is threading to.
 *
 * Strategy (in order of confidence):
 *   0. VERP Reply-To — the To: header on the inbound looks like
 *      `replies+{tracking_id}@reply.<domain>`. The local part's `+UUID`
 *      segment is exactly our `email_sends.tracking_id`. This is the
 *      bulletproof path: SES preserves Reply-To verbatim, so it always works.
 *   1. Custom Message-ID — local part of our `Message-ID` header. SES often
 *      rewrites this, but if it survives, the In-Reply-To references it.
 *   2. Resend's own internal email_id — stored as `resend_message_id`. Last
 *      resort, in case the SES-generated In-Reply-To happens to contain it.
 *
 * Returns null when nothing matches. The DB trigger then falls back to a
 * "most recent send to this contact" heuristic — see migration 086.
 */
async function resolveThreadEmailSendId(
  supabase: ReturnType<typeof createClient>,
  contactId: string | null,
  toAddress: string | string[] | null,
  inReplyTo: string | null,
  references: string | null
): Promise<string | null> {
  // Path 0: VERP — extract the tracking_id from the "To:" header. Works
  // even when contactId is unknown, because the address itself identifies
  // the originating send.
  const verpTrackingId = extractTrackingIdFromTo(toAddress)
  if (verpTrackingId) {
    const { data, error } = await supabase
      .from('email_sends')
      .select('id')
      .eq('tracking_id', verpTrackingId)
      .maybeSingle()
    if (data?.id) return data.id
    if (error) console.error('Thread resolution by VERP tracking_id failed:', error)
  }

  if (!contactId) return null

  const headerBlob = [inReplyTo ?? '', references ?? ''].join(' ')
  const candidates = extractTrackingUuids(headerBlob)
  if (candidates.length === 0) return null

  // Path 1: tracking_id appearing inside In-Reply-To (custom Message-ID).
  const byTracking = await supabase
    .from('email_sends')
    .select('id, sent_at')
    .eq('recipient_contact_id', contactId)
    .in('tracking_id', candidates)
    .order('sent_at', { ascending: false })
    .limit(1)

  if (byTracking.data?.[0]?.id) {
    return byTracking.data[0].id
  }
  if (byTracking.error) {
    console.error('Thread resolution by tracking_id failed:', byTracking.error)
  }

  // Path 2: resend_message_id.
  const byResendId = await supabase
    .from('email_sends')
    .select('id, sent_at')
    .eq('recipient_contact_id', contactId)
    .in('resend_message_id', candidates)
    .order('sent_at', { ascending: false })
    .limit(1)

  if (byResendId.data?.[0]?.id) {
    return byResendId.data[0].id
  }
  if (byResendId.error) {
    console.error('Thread resolution by resend_message_id failed:', byResendId.error)
  }

  return null
}

/**
 * Parse an email address from "Name <email@example.com>" format.
 * For bare emails (no angle brackets) the whole string is the address —
 * the previous version's regex greedily split bare addresses like
 * gd.team.all@gmail.com into name="gd.team.al" + email="l@gmail.com".
 */
function parseEmailAddress(from: string): { email: string | null; name: string | null } {
  if (!from) return { email: null, name: null }
  const trimmed = from.trim()

  // "Name <email@example.com>" — only treat as name+email when angle brackets are present
  if (trimmed.includes('<')) {
    const match = trimmed.match(/^"?([^"<]*?)"?\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/)
    if (match) {
      return {
        name: match[1]?.trim() || null,
        email: match[2]?.toLowerCase() || null,
      }
    }
  }

  // Bare email (no angle brackets) — the whole string is the address
  if (trimmed.includes('@')) {
    return { email: trimmed.toLowerCase(), name: null }
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
