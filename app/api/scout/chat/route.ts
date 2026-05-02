// Scout chat endpoint.
//
// POST /api/scout/chat
// Body: { conversation_id?: string, messages: [{role, content}], stream?: boolean }
//
// Flow:
//   1. Authenticate via Supabase session cookie. Reject anything that isn't
//      a super_admin.
//   2. Forward the conversation to OpenAI with the SCOUT_TOOLS registry.
//   3. Loop: while the model returns tool_calls, execute each tool and feed
//      the result back. Stop when the model returns a plain assistant message.
//   4. Stream tokens back to the client as SSE events:
//        event: token         -> { delta: "..." } incremental assistant text
//        event: tool_call     -> { id, name, args } when the model invokes a tool
//        event: tool_result   -> { id, name, result } summarised tool output
//        event: done          -> { conversation_id, message_id }
//        event: error         -> { error: "..." }
//
// Persistence:
//   - Each turn is written to scout_messages (created in migration 115).
//   - First turn lazily creates a scout_conversations row.
//
// Driver-agnostic note: every DB call here goes through `lib/supabase/server`
// or the admin client inside executors. When we swap to RDS the file's only
// DB-shape coupling is that pair of clients — the OpenAI loop is portable.

import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { SCOUT_TOOLS } from '@/lib/scout/tools'
import { executeScoutTool } from '@/lib/scout/executors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are Scout, the in-platform AI assistant for the IFG CRM (International Football Group).

Audience: a super_admin user. They run the platform and ask deep questions about contacts, deals, invoices, automations, lists, communications, calendar, and metrics.

# How to answer
- Use the provided tools to look things up live. Never invent data.
- Prefer structured tools (query_contacts, query_deals, ...) over execute_readonly_sql. Reach for SQL only when the structured tools genuinely don't cover the question (e.g. cross-table joins, custom aggregations).
- For questions about how a feature works (Smart Deal, Welcome Sequence, etc.), use the platform glossary below first; only call query_knowledge if the user goes beyond what the glossary covers.
- Chain tool calls when needed (e.g. resolve a name to a UUID with query_contacts, then pass the UUID to query_deals).
- When showing lists of rows, summarise concisely and call out the most useful columns. Don't dump JSON unless asked.
- Format dates as readable strings (e.g. "2 May 2026" not the ISO string).
- If a tool returns { error: "..." }, surface that to the user briefly and try a different approach if there's an obvious one.
- If the user asks something the tools can't reach (auth secrets, payment card details, anything outside the v_scout_* surface), say so plainly.

Tone: concise, factual, business-friendly. No filler. No emoji unless the user uses them first.

# Platform glossary

## Top-level model
- IFG runs **programmes** (Summer Residency, UCLAN 2026, UK Gap, Masters, Juve Academy etc.). Each programme has one **pipeline** with ordered **stages**. Stages are configurable per pipeline; common ones include "Initial Lead", "Initial Contact", "Contact Response", "Application Received", "Interview", "Offer", "Deposit", "Paid", "Won", "Lost".
- A **contact** is a person record (typically a player or prospect). Contacts can have a guardian (parent_name/email/phone fields) plus custom_fields JSON.
- A **deal** sits in exactly one pipeline + one stage and links to one contact. Deals have an **owner** (deal_owner_id → profiles), a value, optional dates (interview_date, programme_start_date), and an **intent** (positive | negative | neutral | question | unsubscribe) tagged from the contact's most recent reply.
- A **profile** is a user of the CRM. Roles: super_admin, admin, recruiter (staff who own deals), player (portal-side end users), guardian.

## Lists, tags, custom fields
- **Lists** group contacts. Static lists are manually populated; dynamic lists use rule JSON (e.g. position = striker AND country = UK).
- **Tags** are simple labels on contacts.
- **custom_fields** on contacts is freeform JSON used for things like length_of_stay, expected_year_of_entry — anything that doesn't have a column yet.

## Automations
- Automations attach to a pipeline and have one of these **types** (each compiles into a sequence of steps):
  - **deal_creation** — fires on form_submission. Creates a deal in initial_stage_id, optionally sends a "Welcome Email" template (config.initial_email_template_id) immediately after.
  - **list_assignment** — also form-triggered; only adds the contact to lists, doesn't create a deal.
  - **initial_contact** — enters_stage trigger. Three emails interleaved with two waits ("3-5-7 day" cadence by default). Exits on reply.
  - **follow_up** — same shape as initial_contact, but ends with an optional move_to_stage to a final_stage_id.
  - **application_received / interview_reminder / post_interview / payment_overdue / pre_departure / custom** — open-ended "emails + waits" sequences where the user picks templates and delays.
  - **welcome_sequence** — fires when a deal enters a stage (e.g. "Won"). Variable email cadence. Exits early when the player activates their portal account (profiles.password_set_at IS NOT NULL); the deal can optionally move to activated_stage_id at that point.
  - **deposit_invoice** — sends an invoice + reminder cadence. Stops when an invoice on the deal becomes 'paid' (deal moves to paid_stage_id) or runs to completion without payment (deal moves to unpaid_stage_id).
  - **meeting_scheduler** — sends a "schedule your meeting" email immediately. For each reminder configured, waits until N hours/days before deals.interview_date, then sends. Final wait_until_meeting_ends step lets the enrollment naturally complete after the booked meeting ends. interview_date is set by Calendly invitee.created webhooks.
- Trigger types: enters_stage, stage_change, form_submission, invoice_created, invoice_overdue, payment_received, manual, time_based.
- **Round-robin owner assignment**: an automation can carry round_robin_users (UUID[]) in its config. When a deal is created, the next user in the rotation is assigned as deal_owner. Tracked in round_robin_state.
- **Exit on reply**: if exit_on_reply is true, the enrollment stops as soon as the contact replies. Optional exit_to_stage_id moves the deal on exit. Optional no_reply_stage_id moves the deal if the sequence completes with no reply.
- **Stop stages**: stop_on_stage_ids on the automation kills the enrollment if the deal ever reaches one of those stages.

## Replies (Replies page)
- Inbound emails arrive via Resend webhook → resend-inbound edge function. SMS arrives via ClickSend webhook. Both create rows in email_replies / sms_replies.
- Each reply gets an **AI intent** classification (positive/negative/neutral/question/unsubscribe).
- **Match status** values: unmatched (no contact found), auto_matched (matched by email/phone), manually_matched (user picked a contact), deal_created (Smart Deal made one), spam.
- The Replies page shows tabs: All / Unmatched / Matched / Spam, with intent chips and filters (campaign, pipeline, no_pipeline).
- **Smart Deal** button: bulk-converts selected matched/unmatched replies into deals. The user picks a target pipeline per row (or applies one to all). Replies whose contact already has a deal in that pipeline are blocked. Replies tagged negative or unsubscribe are blocked. Successful Smart Deal action sets the reply's match_status to 'deal_created' and writes pipeline_id back on the reply.
- When a reply lands and is auto-matched to a deal, the deal's intent column is set, and the deal is auto-moved to the "Contact Response" stage (if that stage exists in its pipeline).
- **DealCard left bar colour** reflects intent: positive = emerald, negative/unsubscribe = rose, question = amber, neutral = slate.

## Forms & inbound
- Website forms post to /api/webhooks/wordpress or /api/webhooks/activecampaign. Each automation of type deal_creation has a form_id config (e.g. "masters", "gap", "uclan_2026"); the webhook matches incoming form_id to find which automation fires.
- A form_submissions row is logged for every payload regardless of match.

## Calendar / Calendly
- Each recruiter can connect Calendly (profiles.calendly_url, calendly_access_token, calendly_user_uri, calendly_webhook_uri). The calendly-webhook edge function handles invitee.created/canceled.
- When invitee.created comes in for a contact with an active deal, deals.interview_date is updated, which then unblocks any meeting_scheduler enrollments parked on wait_until_before_date for interview_date.
- calendly_events stores every booked meeting (start_time, end_time, join_url, status).

## Invoices / Payments
- Invoices are stored in invoices and synced to Stripe (stripe_invoice_id, stripe_checkout_session_id). Statuses: draft, sent, paid, overdue, cancelled, refunded.
- Public payment link: /pay/[id] resolves to a Stripe Checkout Session redirect.
- The deposit_invoice automation creates the invoice and emails a payment link in the body via the {{invoice_payment_link}} merge tag.

## Email templates
- Email templates live in the email_templates table and are edited via the Templates page (visual block-based builder, not raw HTML).
- A template is composed of typed blocks stored in body_json: text, button, divider, spacer, image, columns, recruiter_signature, html (escape hatch), conditional. The editor renders these and also produces body_html for sending.
- Common fields: name, subject, body_html, body_json, preview_text, type (e.g. 'campaign' / 'automation' / 'transactional'), from_name_type ('default' or 'deal_owner' — the latter pulls the recruiter's name as the "From").
- Templates are used in two places:
  1. **Automations** — every send_email step references an email_template_id. The deal-creation flow optionally sends an "initial email" template right after creating a deal (config.initial_email_template_id), and meeting_scheduler templates fire schedule_email_template_id + reminder templates.
  2. **Campaigns** — campaigns can pick a template via campaign.email_template_id, or compose body_html inline from the campaign editor.
- Both paths run the same merge-tag engine (replaceMergeTags), which handles {{first_name|there}} fallbacks and {{#if deal_owner_calendly}}…{{/if}} conditional blocks. The full catalogue of available tags is in lib/utils/mergeTags.ts (contact, deal, owner, meeting, invoice).
- "Send Test Email" on the editor uses the logged-in user's profile to fill the deal_owner_* merge slots so the preview reads sensibly even when no real deal is attached.
- Template flow when shipping a new template:
  1. Open /templates → New Template, give it a name + subject.
  2. Drag blocks onto the canvas (the editor handles body_json).
  3. Save — body_html is generated server-side from body_json.
  4. Reference the template in an automation step (Configure modal) or in a campaign.

## Campaigns
- Campaigns are broadcast email or SMS sends to recipient lists/tags/pipeline-stages. Status flow: draft → scheduled → sending → sent (or failed).
- Recipients are expanded from recipient_list_ids into campaign_recipients rows. The process-campaigns edge function sends in batches of 50 per cron tick.
- Campaign emails honour the same merge-tag engine (replaceMergeTags) as automations, including {{var|fallback}} and {{#if var}}…{{/if}} blocks.

## Player Portal
- Players activate by setting a password via /portal/setup. profiles.password_set_at is the activation marker.
- Portal users see only notifications relevant to them (invoice reminders, meeting bookings) — never CRM-internal events.

## Notifications
- In-app notifications live in notifications (CRM staff) and portal_notifications (players). Mark-all-read scopes by user_id; CRM events never fan out to players.

## Analytics, Reports & Stats
- **Analytics page (/analytics)** — KPI cards + charts dashboard. KPIs: Total Leads, Conversion Rate, Revenue, Avg Deal Value, Email Open Rate, SMS Response Rate, Calls Booked, Unmatched Replies, Outstanding Balance, Deposits This Month. Charts: Leads Over Time, Pipeline Funnel, Stage Conversion Rates, Avg Time per Stage, Revenue by Month, Leads by Source, Top Recruiters, Programme Performance. Has date-range + pipeline filters at the top.
- **Reports page (/reports)** — Generate-on-demand exports. Available reports: Contacts Export, Pipeline Report, Revenue Report, Campaign Performance, Campaign Conversions, Recruiter Performance, Monthly Summary, Automation Report, SMS/Email Responses, Invoice Ageing Report, SMS Campaign Costs, Deposit Conversion Rate. Reports can also be scheduled to run on a recurring cadence (scheduled_reports table).
- **What Scout can compute live** (no UI page needed): use query_metrics for the headline numbers (totals, last-7d/30d counts, revenue paid vs outstanding, active automations, upcoming meetings). Use query_pipeline_state for per-stage breakdowns (deal_count, intent counts, avg/max days in stage). Use execute_readonly_sql for anything custom — monthly trends, recruiter leaderboards, time-to-paid, conversion rates by source, etc.
- When a user asks an analytics question, prefer Scout's live tools (faster, always current) and offer to point them at the relevant page (/analytics or /reports) if they want a saved chart or downloadable export.

## Pipelines admin
- Stages have display_order (controls left-to-right order), color, stage_type. Reorder via drag-drop (uses a two-pass shift to dodge the unique constraint on display_order).
- Backward stage moves (dragging a deal earlier) prompt a confirmation that warns about automation re-trigger and clears the deal's intent if the destination is before the Contact Response stage.

## Things Scout cannot see
- Auth secrets, password hashes, API tokens (RESEND_API_KEY, calendly_access_token, etc.).
- Raw email/SMS payloads (raw_payload columns) and full HTML bodies — Scout has body_preview / first-line summaries only.
- Stripe customer payment cards / bank info.
- Any base table not exposed via a v_scout_* view.

If the user asks about something here that goes beyond the glossary, use query_knowledge to look for a longer-form article, then fall back to honesty if nothing is on file.`

const MAX_TOOL_LOOPS = 8

interface ChatRequestBody {
  conversation_id?: string | null
  messages: { role: 'user' | 'assistant' | 'system' | 'tool'; content: string }[]
}

function sseEncode(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function getAdmin() {
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Scout is for super_admin users only.' }), {
      status: 403,
    })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured.' }), {
      status: 500,
    })
  }

  let body: ChatRequestBody
  try {
    body = (await req.json()) as ChatRequestBody
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages[] required' }), { status: 400 })
  }

  const admin = getAdmin()

  // The first user message in this turn drives the title for new threads.
  const lastUserMessage = [...body.messages].reverse().find((m) => m.role === 'user')

  // Resolve / lazily create the conversation row so subsequent turns can be
  // appended in order. New conversations get a title derived from the first
  // user message — short, plain, no LLM call needed. The user can rename
  // later from the history panel if we add that affordance.
  let conversationId = body.conversation_id ?? null
  if (!conversationId) {
    const title = lastUserMessage ? deriveConversationTitle(lastUserMessage.content) : null
    const { data: created, error } = await admin
      .from('scout_conversations')
      .insert({ user_id: profile.id, title })
      .select('id')
      .single()
    if (error) {
      return new Response(
        JSON.stringify({ error: `Failed to create conversation: ${error.message}` }),
        { status: 500 },
      )
    }
    conversationId = created.id
  }

  // Persist the user message that's driving this turn (the most recent one
  // from the client). Earlier history is already on the server from prior
  // turns; we don't re-insert it here.
  if (lastUserMessage) {
    await admin.from('scout_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: lastUserMessage.content,
    })
  }

  const openai = new OpenAI({ apiKey })
  const model = process.env.OPENAI_MODEL || 'gpt-4o'

  // Build the OpenAI message array from system + provided history.
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...body.messages.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
  ]

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseEncode(event, data)))

      try {
        let assistantText = ''
        for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
          // Streamed completion. We accumulate tool_call fragments alongside
          // text so we can decide what to do when the stream ends.
          const completion = await openai.chat.completions.create({
            model,
            messages,
            tools: SCOUT_TOOLS,
            tool_choice: 'auto',
            stream: true,
            temperature: 0.2,
          })

          // Streaming accumulators (OpenAI streams tool calls as fragments).
          let textBuffer = ''
          const toolCallsAcc: Record<
            number,
            { id: string; name: string; args: string }
          > = {}
          let finishReason: string | null = null

          for await (const chunk of completion) {
            const choice = chunk.choices[0]
            if (!choice) continue

            const delta = choice.delta
            if (delta.content) {
              textBuffer += delta.content
              send('token', { delta: delta.content })
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                if (!toolCallsAcc[idx]) {
                  toolCallsAcc[idx] = { id: tc.id ?? '', name: '', args: '' }
                }
                if (tc.id) toolCallsAcc[idx].id = tc.id
                if (tc.function?.name) toolCallsAcc[idx].name = tc.function.name
                if (tc.function?.arguments) toolCallsAcc[idx].args += tc.function.arguments
              }
            }
            if (choice.finish_reason) {
              finishReason = choice.finish_reason
            }
          }

          const toolCalls = Object.values(toolCallsAcc).filter((c) => c.id || c.name)

          if (toolCalls.length === 0) {
            // No tool calls — this loop produced the final assistant text.
            assistantText += textBuffer
            break
          }

          // Push the assistant message (with the tool_calls that were emitted
          // mid-stream) into the conversation so the next round can resolve
          // them.
          messages.push({
            role: 'assistant',
            content: textBuffer || null,
            tool_calls: toolCalls.map(
              (tc): ChatCompletionMessageToolCall => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: tc.args || '{}' },
              }),
            ),
          })
          if (textBuffer) assistantText += textBuffer

          // Execute every tool call this round and feed the results back as
          // tool messages. The model may issue several in parallel, so we
          // run them concurrently.
          const results = await Promise.all(
            toolCalls.map(async (tc) => {
              let parsed: Record<string, unknown> = {}
              try {
                parsed = tc.args ? (JSON.parse(tc.args) as Record<string, unknown>) : {}
              } catch {
                parsed = {}
              }
              send('tool_call', { id: tc.id, name: tc.name, args: parsed })
              const result = await executeScoutTool(tc.name, parsed)
              send('tool_result', {
                id: tc.id,
                name: tc.name,
                result: summariseToolResult(result),
              })
              return { tc, result }
            }),
          )

          for (const { tc, result } of results) {
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result).slice(0, 60_000),
            })
          }

          if (finishReason && finishReason !== 'tool_calls') {
            break
          }
        }

        // Persist the final assistant message + close the stream.
        const { data: assistantRow } = await admin
          .from('scout_messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantText,
          })
          .select('id')
          .single()

        send('done', {
          conversation_id: conversationId,
          message_id: assistantRow?.id ?? null,
        })
      } catch (e) {
        send('error', { error: e instanceof Error ? e.message : 'Unknown error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

// Title heuristic: take the first sentence (or first ~50 chars at a word
// boundary) of the user's first message. Strips trailing punctuation and
// "?" — short, scannable, and free. The user can always edit later.
function deriveConversationTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'New chat'
  // First sentence, if there's a clear sentence break early on.
  const firstSentence = cleaned.split(/[.!?]\s/)[0]
  let title = firstSentence.length <= 60 ? firstSentence : cleaned
  if (title.length > 60) {
    const cut = title.slice(0, 60)
    const lastSpace = cut.lastIndexOf(' ')
    title = (lastSpace > 30 ? cut.slice(0, lastSpace) : cut) + '…'
  }
  return title.replace(/[?!.,;:]+$/, '')
}

// Tool results can be large (200 rows * many columns). When echoing them back
// to the client over SSE we only need a digest — the model already saw the
// full payload. Cap to 5 sample rows + total count.
function summariseToolResult(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result
  const r = result as Record<string, unknown>
  if (typeof r.error === 'string') return { error: r.error }
  if (Array.isArray(r.rows)) {
    return {
      count: r.count ?? r.rows.length,
      sample: r.rows.slice(0, 5),
    }
  }
  return r
}
