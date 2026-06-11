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
import { logOpenAIUsage } from '@/lib/ai/usage-logger'

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
- Website forms post to /api/webhooks/wordpress or /api/webhooks/activecampaign. Each automation of type deal_creation has a form_id config (e.g. "masters", "gap", "uclan"); the webhook matches incoming form_id to find which automation fires.
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

// Compose the per-request system prompt. The base SYSTEM_PROMPT is invariant;
// the leading block here changes per user (their name) and per session (their
// saved memories). Keep this small — every byte ships on every turn.
function buildSystemPrompt({
  firstName,
  fullName,
  memories,
}: {
  firstName: string
  fullName: string
  memories: string[]
}): string {
  // First-message rule is intentionally directive — the model was being too
  // permissive about skipping the name when the parsed first-name didn't look
  // human (e.g. an acronym). When in doubt, greet anyway.
  const greeting = firstName
    ? `You are speaking with ${fullName}. Address them as "${firstName}".\n\nMANDATORY: when the user sends their first message in a new conversation, open your reply with "Hi ${firstName}," (or "Hey ${firstName}," for short greetings) — even if their message is just "hi" or "hello". Do NOT skip the name even if it looks unusual; the user picked it. In replies AFTER the first one, do not repeat the greeting.`
    : `You are speaking with a super_admin whose display name isn't set. Open replies neutrally with "Hi there,".`

  // Anti-staleness rule. The model otherwise tends to remember its last tool
  // result within a chat and re-quote it instead of re-querying — so if the
  // user adds a contact between turns and asks "how many contacts now?" it
  // returns the old number. Force a fresh tool call every time. The current
  // timestamp is injected so the model has an unambiguous cue that time has
  // moved on between turns.
  const nowIso = new Date().toISOString()
  const freshnessRule = `\n\n# Live data — never cache across turns\nThe CRM is a live system. Records can be created, edited, or deleted between any two turns of this conversation, including by the user themselves in another tab.\n\nMANDATORY: every time the user asks for a count, a list, a metric, a status, or "how many / who / what / when" anything, you MUST call the relevant tool fresh — even if you answered the same or a similar question earlier in this same conversation. Never reuse a previous tool's result as the answer to a new turn. Treat each user turn as a brand-new request against live data.\n\nCurrent server time: ${nowIso}.`

  // Vision + attachments. Without this, the model reads the rest of the
  // prompt as "CRM tools only" and refuses to look at attached images
  // (returns "I'm unable to help with that"). Make it explicit.
  const attachmentRule = `\n\n# Attachments — images, screenshots, files\nThe user can attach images, screenshots, and text files to their messages. You CAN see images directly (vision is enabled). When the user attaches an image — a screenshot, a photo, a chart, a document, code, anything — look at it and answer like a normal capable assistant. Read the text in screenshots, summarise documents, debug code shown in pictures, describe what's there.\n\nText files arrive inlined in the user's message as fenced code blocks (\`File: name.ext\` followed by the contents). Treat those as normal text the user pasted.\n\nAttachments are NOT CRM data and don't need a tool call. Do NOT refuse with "I'm unable to help with that" — that's a refusal to use a capability you have. If an image is genuinely unreadable (blurry, blank), say so plainly. If it's something you can read, just answer.`

  // Inline chart rendering. The chat client recognises a fenced code block
  // with language "scout-chart" and renders it as an actual chart (Recharts)
  // in place of the code. Use this when a question is naturally answered
  // with a visual: revenue comparisons, trend over time, pipeline funnel,
  // top-N rankings, share of total, etc.
  const chartRule = `\n\n# Inline charts\nYou can render real charts inline in your reply. Emit a fenced block with language \`scout-chart\` containing a JSON spec; the client replaces it with a live chart.\n\nUse charts for: revenue comparisons, trends over time, pipeline funnels, top-N rankings, share-of-total. Pull the underlying numbers with your usual tools (query_metrics, query_pipeline_state, execute_readonly_sql), then visualise them. Always include a one-line summary in plain text BEFORE or AFTER the chart so the message still reads cleanly even if the chart fails to render.\n\nSpec shape:\n\`\`\`scout-chart\n{\n  "type": "bar" | "line" | "area" | "pie",\n  "title": "Optional title shown above the chart",\n  "data": [ { ... }, ... ],\n  "xKey": "month",            // bar/line/area only — category column\n  "series": ["2024", "2025"], // bar/line/area only — numeric columns to plot\n  "nameKey": "stage",         // pie only — text column for slice label\n  "yKey": "count"             // pie only — numeric column for slice value\n}\n\`\`\`\n\nExamples:\n- Revenue 2024 vs 2025 by month → \`type: "bar"\`, \`xKey: "month"\`, \`series: ["2024", "2025"]\`, data is one row per month with both year columns.\n- Leads over time → \`type: "line"\` or \`"area"\`, \`xKey: "date"\`, \`series: ["leads"]\`.\n- Pipeline stage breakdown → \`type: "pie"\`, \`nameKey: "stage"\`, \`yKey: "deal_count"\`.\n\nRules:\n- The data array must be small and clean (≤ 30 rows). Aggregate first if your tool returned 200 rows.\n- All values in series columns must be numbers, not strings.\n- Don't render a chart for a one-number answer ("you have 7 contacts" doesn't need a chart).\n- Don't render multiple charts if one would do.\n- If the question is "show me a chart of X" or "compare X vs Y" or "trend of X", strongly prefer a chart over a markdown table.`

  // PDF briefing — special fenced block that renders as a downloadable
  // one-pager in the chat. Use this when the user asks for a "briefing",
  // "weekly report", "summary", "executive recap", "one-pager" or anything
  // that should be exported / shared with someone else.
  const briefingRule = `\n\n# Briefings — exportable one-pagers\nWhen the user asks for a briefing, weekly recap, executive summary, one-pager, or anything they'd want to share or download, emit a fenced \`scout-briefing\` block. The client renders it as a styled card with a "Download PDF" button.\n\nSpec:\n\`\`\`scout-briefing\n{\n  "title": "Weekly Briefing",\n  "subtitle": "Optional one-line subtitle (e.g. date range)",\n  "sections": [\n    {\n      "heading": "Revenue",\n      "body": "Markdown body — plain prose, bullets, tables.",\n      "chart": { /* optional ScoutChartSpec — same schema as scout-chart */ }\n    },\n    { "heading": "Pipeline", "body": "..." }\n  ],\n  "footer": "Optional footnote line"\n}\n\`\`\`\n\nRules:\n- 3 to 6 sections, each short. This is a one-pager, not a report.\n- Pull all numbers from your tools first (query_metrics, query_pipeline_state, etc). Don't make up data.\n- Use a chart in 1-2 sections at most — they're emphasis, not decoration.\n- Don't put a briefing inside a normal answer; only emit one when the user explicitly asked for a briefing/recap/report.\n- After the briefing block you can add 1-2 lines of natural-language summary outside it.`

  // Entity hover-card syntax. When you mention a CRM record by name and you
  // have its UUID from a tool result, wrap the name in a markdown link with
  // the special scheme below. The client renders these as inline hover chips
  // that show a preview card on hover and link to the CRM page on click.
  const entityRule = `\n\n# Linking CRM entities (hover cards)\nWhen you mention a specific CRM record by name AND you have its UUID from a tool result, wrap the name in a markdown link with the custom scheme \`scout-entity:TYPE:UUID\`. The client turns these into hover cards.\n\nSyntax: \`[Display Name](scout-entity:TYPE:UUID)\`\n\nValid TYPE values: contact, deal, invoice, automation, list, pipeline, user\n\nExamples:\n- "[Khan Smith](scout-entity:contact:8f2c1d34-...) is in the [Summer Residency](scout-entity:pipeline:0a1b...) pipeline."\n- "Invoice [INV-1023](scout-entity:invoice:9b...) is overdue."\n- "The [Welcome Sequence](scout-entity:automation:...) automation is paused."\n\nRules:\n- ONLY use this when you have the actual UUID from a tool result. Never fabricate UUIDs — a broken hover card is worse than plain text.\n- Don't wrap every mention; once per unique entity per reply is enough. After the first link, plain text is fine.\n- Don't use it inside markdown tables (cells are tight enough already).\n- If you only have a name (no UUID), just write the name as plain text.`

  const memoryHeader =
    '# What you already know about this user\nThese are durable facts saved across past conversations. Apply them silently when relevant — do not restate them verbatim or remark that you remembered. If a memory clearly contradicts what the user is telling you now, trust the current message.'

  const memoryBody =
    memories.length === 0
      ? '_No memories saved yet. Use the save_memory tool when you spot a durably-useful fact (preferences, conventions, recurring people/programmes) or when the user explicitly asks you to remember something._'
      : memories.map((m) => `- ${m}`).join('\n')

  return `${greeting}${freshnessRule}${attachmentRule}${chartRule}${briefingRule}${entityRule}\n\n${memoryHeader}\n${memoryBody}\n\n${SYSTEM_PROMPT}`
}

const MAX_TOOL_LOOPS = 8

// Content can either be plain text OR an OpenAI multimodal content-parts
// array (text + image_url blocks). The client builds the parts array when the
// user attaches images so we can pass them straight through to gpt-4o vision.
type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }

interface ChatRequestBody {
  conversation_id?: string | null
  // Temporary chat mode. When true: skip creating a conversation row, skip
  // persisting user/assistant messages, and skip executing any save_memory
  // tool calls. Memories are still INJECTED into the prompt (read-only).
  incognito?: boolean
  messages: {
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string | OpenAIContentPart[]
  }[]
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

  // Pull this user's saved memories (scout_memories) so we can prepend them to
  // the system prompt as continuity context. Scout writes here via the
  // save_memory tool. Cap at 100 / ~10k chars to keep the prompt manageable.
  const { data: memoryRows } = await admin
    .from('scout_memories')
    .select('content')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(100)
  const memoryBlock = (memoryRows ?? []).slice(0, 100)
  const totalMemoryChars = memoryBlock.reduce((n, r) => n + (r.content?.length ?? 0), 0)
  const memoryTrimmed = totalMemoryChars > 10_000
    ? memoryBlock.slice(0, Math.floor((memoryBlock.length * 10_000) / totalMemoryChars))
    : memoryBlock

  const firstName = (profile.full_name ?? '').trim().split(/\s+/)[0] || ''
  const personalSystemPrompt = buildSystemPrompt({
    firstName,
    fullName: profile.full_name ?? '',
    memories: memoryTrimmed.map((m) => m.content),
  })

  // The first user message in this turn drives the title for new threads.
  const lastUserMessage = [...body.messages].reverse().find((m) => m.role === 'user')

  // Resolve / lazily create the conversation row so subsequent turns can be
  // appended in order. New conversations get a title derived from the first
  // user message — short, plain, no LLM call needed. The user can rename
  // later from the history panel if we add that affordance.
  // Flatten multimodal content into a string for title derivation + DB
  // persistence. We don't store image bytes — too big and not useful for
  // history scrubbing. We append a "[N image(s)]" suffix so the saved row
  // accurately reflects that the turn included attachments.
  const flattenForStorage = (
    content: string | OpenAIContentPart[],
  ): string => {
    if (typeof content === 'string') return content
    const text = content
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('\n')
      .trim()
    const imageCount = content.filter((p) => p.type === 'image_url').length
    if (imageCount > 0) {
      const suffix = `[${imageCount} image${imageCount > 1 ? 's' : ''} attached]`
      return text ? `${text}\n\n${suffix}` : suffix
    }
    return text
  }

  const incognito = body.incognito === true

  let conversationId = body.conversation_id ?? null
  if (!conversationId && !incognito) {
    const title = lastUserMessage
      ? deriveConversationTitle(flattenForStorage(lastUserMessage.content))
      : null
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
  // turns; we don't re-insert it here. Skipped entirely in incognito mode.
  if (lastUserMessage && !incognito && conversationId) {
    await admin.from('scout_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: flattenForStorage(lastUserMessage.content),
    })
  }

  const openai = new OpenAI({ apiKey })
  const model = process.env.OPENAI_MODEL || 'gpt-4o'

  // Build the OpenAI message array from system + provided history. The system
  // prompt is rebuilt per request so memories + the user's name flow in
  // automatically.
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: personalSystemPrompt },
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
          // include_usage so OpenAI emits a final chunk with token
          // counts, which we forward to the OpenAI Usage dashboard.
          const aiStartedAt = performance.now()
          const completion = await openai.chat.completions.create({
            model,
            messages,
            tools: SCOUT_TOOLS,
            tool_choice: 'auto',
            stream: true,
            stream_options: { include_usage: true },
            temperature: 0.2,
          })

          // Streaming accumulators (OpenAI streams tool calls as fragments).
          let textBuffer = ''
          const toolCallsAcc: Record<
            number,
            { id: string; name: string; args: string }
          > = {}
          let finishReason: string | null = null
          let streamUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null = null

          for await (const chunk of completion) {
            // The final chunk in stream_options:include_usage mode
            // carries `usage` (and an empty choices array). Capture it.
            if (chunk.usage) {
              streamUsage = {
                prompt_tokens: chunk.usage.prompt_tokens ?? 0,
                completion_tokens: chunk.usage.completion_tokens ?? 0,
                total_tokens: chunk.usage.total_tokens ?? 0,
              }
            }
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

          // Log usage for THIS loop's completion call. Each tool-loop
          // is a separate OpenAI billing event so we record it
          // separately under the same feature key.
          await logOpenAIUsage({
            feature: 'scout-chat',
            model,
            usage: streamUsage,
            startedAt: aiStartedAt,
            userId: profile.id,
          })

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
              // In incognito mode, intercept save_memory so the model can
              // still "say" it remembered something but nothing actually
              // gets persisted to scout_memories. This matches Claude's
              // ephemeral mode.
              if (incognito && tc.name === 'save_memory') {
                const fauxResult = {
                  saved: false,
                  reason: 'Skipped — temporary chat. Memory writes are disabled in this session.',
                }
                send('tool_result', { id: tc.id, name: tc.name, result: fauxResult })
                return { tc, result: fauxResult }
              }
              const result = await executeScoutTool(tc.name, parsed, {
                userId: profile.id,
              })
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

        // Persist the final assistant message + close the stream. Skipped
        // entirely in incognito mode — the conversation never touches the DB.
        let assistantMessageId: string | null = null
        if (!incognito && conversationId) {
          const { data: assistantRow } = await admin
            .from('scout_messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: assistantText,
            })
            .select('id')
            .single()
          assistantMessageId = (assistantRow?.id as string | undefined) ?? null
        }

        send('done', {
          conversation_id: conversationId,
          message_id: assistantMessageId,
          incognito,
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
