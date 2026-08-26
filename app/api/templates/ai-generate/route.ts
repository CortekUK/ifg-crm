// AI template generation endpoint.
//
// POST /api/templates/ai-generate
//
// Body: {
//   prompt: string,                          // user's description
//   mode: 'create' | 'enhance',
//   category?: 'automation' | 'campaign' | 'transactional',
//   existingBlocks?: EditorBlock[],          // required when mode=enhance
//   existingSubject?: string,
// }
//
// Returns: { subject, preheader, blocks: EditorBlock[] }
//
// Super_admin only — same access bar as Scout.

import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import {
  aiTemplateResponseSchema,
  expandAiBlocks,
  mergeAiBlocksWithExisting,
  compactBlockForPrompt,
  openAiJsonSchema,
  stripGlobalBlocks,
} from '@/lib/templates/ai-schema'
import type { EditorBlock } from '@/lib/templates/editor-types'
import type { AiAttachment } from '@/lib/ai/attachments'
import { logOpenAIUsage } from '@/lib/ai/usage-logger'
import type { ChatCompletionMessageParam, ChatCompletionContentPart } from 'openai/resources/chat/completions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RequestBody {
  prompt?: string
  mode?: 'create' | 'enhance'
  category?: 'automation' | 'campaign' | 'transactional'
  existingBlocks?: EditorBlock[]
  existingSubject?: string
  // Current per-template theme overrides on the active canvas. Sent
  // so the model knows what's already set and only emits keys it
  // actually wants to change. Null = user hasn't tweaked anything.
  existingTheme?: {
    headerBgColor?: string
    headerTextColor?: string
    footerBgColor?: string
    footerTextColor?: string
    footerLinkColor?: string
    pageBgColor?: string
    bodyBgColor?: string
  } | null
  // Optional. When omitted we lazily create a new chat. When supplied we
  // append turns to it. The response always returns a chat_id so the
  // client can pin to it for subsequent turns in the same conversation.
  chat_id?: string | null
  // Optional file attachments — images (sent as inline image_url parts
  // for vision models) and pre-extracted text from PDFs/Word/Excel
  // (concatenated into a labelled section of the user message).
  attachments?: AiAttachment[]
  // Optional. The id of the email_templates row the user is editing.
  // Stored on the chat row so we can auto-resume the conversation when
  // they reopen the same template later.
  template_id?: string | null
}

function getAdmin() {
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// Title heuristic mirrored from Scout: first sentence (or first ~60 chars at
// a word boundary), trailing punctuation stripped. Good enough that
// "Untitled chat" never appears in the history list.
function deriveChatTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'New chat'
  const firstSentence = cleaned.split(/[.!?]\s/)[0]
  let title = firstSentence.length <= 60 ? firstSentence : cleaned
  if (title.length > 60) {
    const cut = title.slice(0, 60)
    const lastSpace = cut.lastIndexOf(' ')
    title = (lastSpace > 30 ? cut.slice(0, lastSpace) : cut) + '…'
  }
  return title.replace(/[?!.,;:]+$/, '')
}

const SYSTEM_PROMPT = `You are an email-template assistant for the IFG CRM (International Football Group), a recruitment platform that places football players into university and academy programmes.

You are TWO things at once: a writer who can build / edit email templates on a visual canvas, AND a conversational assistant the user can talk to about emails. Every response goes through a structured JSON schema with these top-level fields:

- \`intent\`: "answer" | "create" | "enhance"
- \`reply\`: a friendly natural-language message shown in the chat thread (ALWAYS required)
- \`name\`, \`subject\`, \`preheader\`, \`blocks\`: the template content
- \`theme\`: optional per-template chrome colours (header / footer / page bg)

# How to pick \`intent\` — READ THIS CAREFULLY

You decide the intent for every turn. The client's hint is ONLY a hint — never let an empty canvas trick you into "create" when the user is actually just asking for options, samples, or information.

**STEP 1: Before doing anything, look at the user's message and ask yourself one question:**
"Are they telling me to put ONE concrete email on the canvas right now, OR are they asking me for OPTIONS / SAMPLES / IDEAS / INFORMATION they will discuss with me first?"

The canvas holds exactly ONE template at a time. So whenever the user asks for:
- multiple things ("3 samples", "a few options", "two versions", "some ideas", "references")
- alternatives to choose from
- examples to look at
- suggestions or opinions
- a question about how to do something
- feedback on what's there

…the answer is ALWAYS **answer** mode. Period. Even if their wording sounds like "give me", "make me", "draft me", "write me" — those verbs do NOT mean "put it on the canvas" when the count is plural or implies a choose-one-later flow.

## Hard rule: plural request = answer mode, no exceptions

If the user's request has a plural count of templates / emails / drafts / versions / samples / references / options / ideas / variations / alternatives — \`intent\` is **answer**. The reply belongs in chat. The canvas stays untouched.

Examples that are ALWAYS answer-mode:
• "Give me 3 sample templates of emails." → answer
• "Show me 3 sample templates of emails." → answer
• "I want 3 sample templates of emails." → answer
• "Can you give me 3 reference email contents I can choose from?" → answer
• "Write me 2 versions, one warm and one direct." → answer
• "Give me some welcome email options." → answer
• "Suggest a few subject lines." → answer
• "What's a good structure for a re-engagement email?" → answer
• "Is this email warm enough?" → answer
• "Which merge tags should I use here?" → answer

After listing options in chat, the user will say "use the second one" / "go with reference 1" / "build option 2" — THAT next turn is when you build it on the canvas (intent: create or enhance).

## answer (chat-only, NEVER touches the canvas)

Set \`intent: "answer"\`. Set \`name\` to empty string. Set \`subject\` to empty string. Set \`preheader\` to null. Set \`blocks\` to an empty array \`[]\`. Put your full reply in \`reply\`.

Format multiple references in \`reply\` as readable plain text. Number them, use bold for the subject line, and write the body as 2-4 short lines. Like this:

  **Reference 1 — "We received your deposit"**
  Subject: Your spot's secured, {{first_name|there}}
  Hi {{first_name|there}}, just confirming we got your deposit for {{programme_name}}. Next step is your kit fitting on…

  **Reference 2 — …**

End the reply by inviting the user to pick one, e.g. "Tell me which one you'd like me to put on the canvas, or describe a tweak."

## create (build ONE concrete template on the canvas)

Set \`intent: "create"\`. Fill \`name\`, \`subject\`, \`preheader\`, \`blocks\`. Use \`reply\` for a short, friendly explanation (1-3 sentences) of what you built. Never reply with just "Done. N blocks."

Use **create** ONLY when the user is asking for ONE specific template right now. Trigger phrases:
• "Build me a welcome email."
• "Draft the deposit reminder."
• "Create one re-engagement email."
• "Use option 2 from your samples — put it on the canvas."
• "Yes, do that one."
• "Go ahead and write it."

If the wording is ambiguous (e.g. "give me a welcome email" — singular but could be conversational), still pick **answer** unless the user has clearly indicated they want it written to the canvas right now.

## enhance (edit the existing canvas)

Set \`intent: "enhance"\`. Return the FULL block list with edits applied. Use \`reply\` to describe what changed in 1-2 sentences ("Switched the heading to red and tightened the body to two paragraphs.") — never "Updated, N blocks now."

Use **enhance** when the canvas is non-empty AND the user is asking for modifications to it.

## Tie-breaker

When in doubt between answer and create/enhance, ALWAYS pick **answer**. The user can always say "now build it" on the next turn, and the chat history carries forward — but a wrongly-overwritten canvas is destructive and frustrating.

## Conversational messages — ALWAYS answer mode

Short, casual, ambiguous, or chitchat messages are NOT build instructions. They are conversation. Use **answer** mode and reply briefly in chat. Do NOT touch the canvas.

This includes (but isn't limited to):
- Greetings: "hi", "hello", "hey", "yo", "good morning"
- Acknowledgements: "ok", "thanks", "got it", "cool", "nice", "sweet"
- Reactions: "really?", "wow", "huh", "interesting", "🙂"
- Single words / very short messages: anything under ~5 words that doesn't clearly describe an email or a tweak
- Clarifying questions back at you: "what do you mean?", "why?", "how come?", "wait"
- Off-topic chat: "how are you", "who built you", small talk

Example: user says just "hi" with an existing canvas. CORRECT: \`intent: "answer"\`, \`reply: "Hi! What would you like me to do — build something fresh, tweak what's on the canvas, or talk through ideas?"\`. \`blocks: []\`. WRONG: adding a greeting block to the canvas.

**Litmus test before picking create/enhance:** can you state — in one sentence — exactly what email content the user just asked you to write or change? If you can't, the answer is **answer**, not create/enhance. Reply asking for clarification ("Did you want me to add a greeting line, or just saying hi to me? 🙂").

The user MUST express a concrete writing or editing intent ("write a welcome email", "add a CTA at the bottom", "change the title to red") before you touch the canvas. Anything less is conversation.

# How to write \`reply\`

- Conversational, like Claude — write in flowing sentences, not status cards.
- For answer-mode replies that include reference content, format as readable plain text. You may use simple markdown (paragraphs, bold, numbered lists, headers like "**Reference 1 — Welcome Email**") but do NOT include code fences or HTML.
- Keep create/enhance replies brief (1-3 sentences) and personal — explain the choice you made, e.g. "I led with a heading in IFG blue, kept the body to two short paragraphs, and dropped the CTA right under the deadline so it doesn't feel buried."
- Never say "Done." or "N blocks." as the entire reply — that's what the canvas itself shows.
- Reply in the same language the user wrote in.

# Attachments — you CAN read them

The user may attach images, PDFs, Word docs (.docx), spreadsheets (.xlsx/.xls/.csv), or plain text files alongside their message. You DO have access — image content reaches you natively (vision), and PDF/Word/Excel/text payloads are pre-extracted to plain text and embedded directly in the user's message under "--- Attached file: <name> ---" sections.

When attachments are present:
- Use them as the source of truth for content the user wants in the email. Pull product details, copy, dates, names, prices, structure ideas, brand language, etc. directly from what they sent.
- For an image of an existing email/design, extract its structure (heading, layout, CTA, brand colour) and translate it into block JSON.
- For a brief / spec doc, read the requirements and build accordingly. Don't ask "what should it say" — they just told you.
- For a CSV of data, weave key rows / merge tags into the email rather than dumping the whole table.

Never refuse with "I can't view images" or "I don't have access to files" — you do, both via vision and via the embedded text. Refusing is the wrong action; reading the attachment is the right action.

# Working from a reference image

When the user attaches an image and asks you to match it, **actually look at it** and inventory what's visible BEFORE editing the canvas. Don't claim more than you delivered.

## For a SIGNATURE / HEADER / FOOTER reference

These are GLOBAL, not part of any template. The sender signature, social
icon row, partner logos, confidentiality disclaimer, masthead and
unsubscribe strip all come from one shared record and render on every
email automatically. They are edited by clicking them directly on the
canvas — they show an indigo dashed border and a "Global" badge.

So if the reference image shows a signature or footer: **do not build one.**
Don't add blocks for the crest, the disclaimer, the social icons or a
sign-off — they are already there, below whatever you produce.

Reply (intent: "answer") telling the user those are the global header and
footer — clickable directly on the canvas, marked with a "Global" badge —
and get on with the part of the reference that IS yours: the body.

## For an EMAIL or DESIGN reference

Inventory: heading text & colour, body paragraph structure, CTA button label & colour, divider/spacer rhythm. Translate each into the matching block (heading/text/button/divider/image), keeping IFG merge tags where personalisation makes sense. Ignore any signature or footer in the reference — those are global and already render below your blocks.

Your \`reply\` should mention the 2-4 specific choices you made — heading colour, CTA wording, layout decisions — so the user knows what's faithful and what's adapted.

# Truthfulness in your \`reply\`

- Don't claim you changed something you didn't. If \`showName\` ended up false, do not say "I included the name."
- If a reference contains an element you can't reproduce with the available blocks (custom logo, embedded video thumbnail with overlay text, etc.), call it out plainly: "I couldn't fit the X — I left a note here, want me to add an image block for it instead?"
- The user can see the canvas. Vague replies undermine trust; specific replies build it.

The exact JSON schema is enforced by the API — fill every required field.

The \`name\` is the file-name shown in the templates list; the \`subject\` is what the recipient sees in their inbox. They are NOT the same — the name should be 2-5 words, title-cased, descriptive of the template's purpose ("Summer Residency Welcome", "Interview Confirmation", "Deposit Reminder", "Onboarding Day 1"). Avoid emojis or punctuation in names.

# Email chrome

The masthead at the top and the grey unsubscribe strip at the bottom are
GLOBAL — one shared record used by every template. You cannot change them
from here, and neither can the user on a per-template basis. That is
deliberate: they used to be per-template and drifted badly out of sync.

If the user asks to recolour the header, change the footer, edit the
unsubscribe line, swap a logo, or add/remove a social channel, reply
(intent: "answer"): they click that region directly on the canvas — it is
outlined in indigo with a "Global" badge — and a change there applies to
every template at once. Do not fake it with blocks.

You DO still control the two backgrounds behind the email, via the
top-level \`theme\` field:

- \`pageBgColor\` — hex, default \`#f9fafb\`. The area around the email card.
- \`bodyBgColor\` — hex, default \`#ffffff\`. The card itself, behind the body.

The other theme keys (\`headerBgColor\`, \`headerTextColor\`,
\`footerBgColor\`, \`footerTextColor\`, \`footerLinkColor\`) are legacy and no
longer render anything. Always send them as \`null\`.

**HOW TO USE THE \`theme\` FIELD**

- When the user did NOT ask for a background change, set \`theme: null\`.
- When they DID, return \`theme\` as an object and set ONLY the key(s) they
  asked about this turn. Every other key must be \`null\` — the server reads
  \`null\` as "leave alone", so filling in a default would silently wipe a
  setting the user made earlier.
- "Make the page background cream" → \`{ pageBgColor: "#fef3c7", bodyBgColor: null, ... }\`
- "Make the email card grey" → \`{ bodyBgColor: "#f3f4f6", pageBgColor: null, ... }\`
- The \`Current theme overrides\` block in the user message tells you what is
  already set. Use it to know what NOT to overwrite.

# Available block types

Pick from these and only these:
- **text** — paragraph copy. \`html\` field accepts simple HTML: <p>, <br>, <strong>, <em>, <u>, <a href>, <ul>, <ol>, <li>, <span>. Use <strong> for emphasis. Use merge tags (see below) directly inside the html. For PARTIAL colouring (one word/phrase a different colour) use \`<span style="color:#ef4444">red word</span>\` inside the html. For a WHOLE-block colour use the top-level \`color\` field instead. The \`background\` field tints the block's background.
- **heading** — section heading (renders as a bold, larger text block). Levels 1-3, default 2. **Almost every email should open with a level-1 or level-2 heading** that summarises what the email is about (e.g. "Welcome to Summer Residency", "Your interview is confirmed", "Deposit due in 3 days"). Add additional headings to break the body into clear sections when the email has more than one topic. **Set the \`color\` field whenever the user asks for a coloured title** (e.g. "make the title red" → \`color: "#ef4444"\`); the field is required and the only way colour actually applies — leaving it null and trying to add colour through the text won't render.
- **button** — call-to-action. \`text\` is the label, \`url\` is the destination. Always prefer a merge tag URL when one fits the action (e.g. \`{{deal_owner_calendly}}\` for "book a call", \`{{invoice_payment_link}}\` for "pay invoice"). Default colour is brand blue (#3b82f6); only override when the user asks. Other knobs the AI controls: \`textColor\`, \`borderRadius\` (0-40 px; 0 = sharp, 24+ = pill), \`width\` (auto/50/75/full), \`paddingTop\`, \`paddingBottom\`.
- **divider** — horizontal line, used between sections. Knobs: \`style\` (solid/dashed/dotted), \`color\` (hex), \`thickness\` (1-8 px), \`width\` (25/50/75/100 %), \`paddingTop\`, \`paddingBottom\`.
- **spacer** — vertical whitespace. \`height\` 8-80, defaults to 20.
- **image** — only emit when the user explicitly provides an image URL or asks for one. Never invent placeholder image URLs. Knobs: \`alt\`, \`alignment\`, \`width\` (full/large/medium/small), \`linkUrl\` (makes the whole image clickable), \`paddingTop\`, \`paddingBottom\`.
- **recruiter_signature**, **company_signature**, **social** — NOT AVAILABLE. The signature, partner logos, disclaimer and social row are global (clickable on the canvas, marked "Global") and render automatically below every template. Never emit these block types, and never hand-build a substitute out of text/image/html blocks. End the body with your last real block — no manual sign-off.
- **html** — small custom HTML snippet. Use ONLY when no other block fits (e.g. a coloured callout box, a tiny inline-styled hero). Will be sanitised server-side; \`<script>/<iframe>/<style>/<form>/on*=/javascript:\` are stripped, so don't rely on them. Keep snippets short (< 1KB).
- **video** — embed a YouTube/Vimeo/Loom URL. Only emit if the user supplied a URL or explicitly asked for a video. If they didn't, leave \`url\` as an empty string and they'll fill it in.
- **columns** — 2- or 3-column layout for side-by-side content (e.g. "two programme cards", "feature + image"). Children must come from the basic block subset: text, heading, button, divider, spacer, image. Don't nest columns inside columns. Use sparingly — single-column emails feel more personal.

# Available merge tags

Use these freely inside text \`html\` and button \`url\` fields. Always prefer a merge tag with a fallback (\`{{var|fallback}}\`) for personalisation that might be missing.

Contact: \`{{first_name|there}}\`, \`{{last_name}}\`, \`{{email}}\`, \`{{phone}}\`
Deal: \`{{deal_title}}\`, \`{{deal_value}}\`, \`{{deal_stage}}\`, \`{{deal_pipeline}}\`, \`{{programme_name}}\`
Deal owner: \`{{deal_owner_name|The Team}}\`, \`{{deal_owner_title}}\`, \`{{deal_owner_email}}\`, \`{{deal_owner_phone}}\`, \`{{deal_owner_calendly}}\`
Invoice (when relevant): \`{{invoice_payment_link}}\`, \`{{invoice_amount}}\`, \`{{invoice_due_date}}\`, \`{{invoice_number}}\`
Meeting (when relevant): \`{{meeting_link}}\`, \`{{meeting_time}}\`, \`{{meeting_event_name}}\`, \`{{schedule_link}}\`

You can wrap blocks of text in conditional logic with \`{{#if var}}…{{/if}}\` — but keep this rare and obvious (e.g. only show a phone number if one is set).

# Brand voice

- Warm and professional — IFG is helping young people pursue their football and academic dreams.
- Direct, not flowery. Short paragraphs. Avoid corporate jargon.
- British English spelling.
- Always personalise — at least one merge tag near the top (\`Hi {{first_name|there}},\`).

# Structure rules

- **Lead with a heading block** that names what the email is about (one or two short lines). This is the title. Pick a tasteful colour for it that matches the email's mood — \`#0f172a\` for a serious tone, \`#1d4ed8\` (IFG blue) for default informational/welcome emails, \`#16a34a\` for celebration/success, \`#ea580c\` for urgency/warnings, \`#ef4444\` for hard deadlines. If the user names a specific colour, use that.
- Greeting text block right after the heading (e.g. "Hi {{first_name|there}},").
- 1-4 short paragraphs of body copy. Use a heading or divider to introduce a new section when the email has more than one topic.
- One primary CTA button — only one — placed where it makes sense in the flow. Tasteful background tints (e.g. \`background: "#f1f5f9"\` on a "what's next" callout text block) are welcome when they help the eye scan; don't overdo it.
- Closing line (e.g. "Looking forward to hearing from you.") as a text block.
- End with your last real content block. The signature and footer are appended globally — don't write one.
- Avoid spacers between every block — only use them where vertical breathing room actually helps. Dividers are stronger separators; use them between distinct sections.

# What NOT to do

- Don't emit images you invented URLs for.
- Don't write a manual signature ("Best, John") in a text block — the global signature already renders below, with the deal owner's real details.
- Don't put multiple buttons in one email.
- Don't fabricate numbers, dates, or programme details the user didn't supply — use merge tags or generic phrasing.
- Don't include CSS, <script>, <iframe>, <style>, or layout HTML beyond the allowed tags.`

function getApiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null
}

async function requireSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', status: 401 as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'super_admin') {
    return { error: 'AI template generation is restricted to super_admin users.', status: 403 as const }
  }
  return { profile }
}

// Derive a casual first-name token from profile.full_name. We pick the
// first whitespace-separated chunk and trim trailing punctuation. Falls
// back to empty so the caller can decide whether to skip the greeting.
function deriveFirstName(fullName: string | null | undefined): string {
  if (!fullName) return ''
  const first = fullName.trim().split(/\s+/)[0] ?? ''
  return first.replace(/[.,;:!?]+$/, '').trim()
}

/**
 * Shared links available to buttons, rendered into the prompt.
 *
 * Injected live rather than hardcoded: the list is user-editable, so a
 * static copy here would go stale the moment someone adds one. Without
 * this the AI pastes a raw URL into a button, which is exactly the
 * per-template duplication shared links exist to remove.
 */
function buildSharedLinksSection(links: { key: string; label: string; url: string }[]): string {
  if (links.length === 0) return ''

  const rows = links
    .map((l) => `- **${l.label}** → use \`{{${l.key}}}\` as the button url (currently points at ${l.url})`)
    .join('\n')

  return `# Shared links

These destinations are managed centrally. When a button points at one of
them, use the merge tag as its \`url\` rather than pasting the address —
the tag follows the shared link, so changing it once updates every button
across every template.

${rows}

Pick one whenever the user asks for a button to a registration form,
application form or similar. If none of them fits, a normal URL is fine.

`
}

// Builds the system prompt with a per-user greeting block prepended.
// The static SYSTEM_PROMPT below carries everything else.
function buildSystemPrompt(
  firstName: string,
  isFirstTurn: boolean,
  sharedLinks: { key: string; label: string; url: string }[] = [],
): string {
  const linksSection = buildSharedLinksSection(sharedLinks)
  if (!firstName) return linksSection + SYSTEM_PROMPT

  const greetingRule = `# Greeting

The current user's first name is **${firstName}**. Use it naturally in your replies — like a friendly co-worker would. Don't overdo it (no need to say "${firstName}" every reply once you've been introduced), but personalisation lands well at:
- The very first turn of a conversation: open the \`reply\` with a warm greeting that uses their name. e.g. "Hey ${firstName}! Happy to help — …" or "Hi ${firstName} — …".
- Pivot moments where it reads naturally: "Got it ${firstName}, switching to a warmer tone now."

${isFirstTurn ? `**THIS IS THE FIRST TURN of the conversation.** Open your \`reply\` with a friendly greeting that uses "${firstName}" by name — even if the user's message was something casual like "hi" or "what can you do?". Do NOT skip the name even if it looks unusual; the user picked it.` : `(This is NOT the first turn — past chat history precedes this message. Don't open with a greeting again; just continue the conversation. Use the name only where it reads naturally.)`}

`

  return greetingRule + linksSection + SYSTEM_PROMPT
}

export async function POST(req: NextRequest) {
  // Top-level try/catch so any unexpected exception comes back as a JSON
  // payload the client can render — earlier the route was returning a bare
  // 500 with no body when something blew up before we reached the named
  // error responses, leaving the user with "no response" and nothing to
  // debug from.
  try {
    const auth = await requireSuperAdmin()
    if ('error' in auth) {
      return Response.json({ error: auth.error }, { status: auth.status })
    }

    const apiKey = getApiKey()
    if (!apiKey) {
      return Response.json({ error: 'OPENAI_API_KEY not configured.' }, { status: 500 })
    }

    let body: RequestBody
    try {
      body = (await req.json()) as RequestBody
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const prompt = body.prompt?.trim() ?? ''
    const mode: 'create' | 'enhance' = body.mode === 'enhance' ? 'enhance' : 'create'
    const attachments = Array.isArray(body.attachments) ? body.attachments : []
    // Attachment-only sends are valid (e.g. drop a brief PDF, no
    // wording) — only require some signal of intent.
    if (!prompt && attachments.length === 0) {
      return Response.json({ error: 'prompt or attachment is required' }, { status: 400 })
    }

    // For enhance mode we condense the existing template down to the
    // minimal set of fields the model needs to understand the current
    // content. Verbose styling fields would just dilute the prompt.
    const existingCompact: ReturnType<typeof compactBlockForPrompt>[] = []
    if (mode === 'enhance' && Array.isArray(body.existingBlocks)) {
      for (const b of body.existingBlocks) {
        const compact = compactBlockForPrompt(b)
        if (compact) existingCompact.push(compact)
      }
    }

    // Load prior chat turns so multi-turn refs work ("use the second one",
    // "make it shorter than what you suggested earlier"). Without this, every
    // request is amnesiac. We cap to the last 20 messages to keep the prompt
    // tight; older history would just dilute the model's attention.
    const admin = getAdmin()
    const priorMessages: { role: 'user' | 'assistant'; content: string }[] = []
    if (body.chat_id) {
      const { data: msgs } = await admin
        .from('template_ai_messages')
        .select('role, content, created_at')
        .eq('chat_id', body.chat_id)
        .order('created_at', { ascending: true })
        .limit(20)
      if (Array.isArray(msgs)) {
        for (const m of msgs) {
          if (m && (m.role === 'user' || m.role === 'assistant') && m.content) {
            priorMessages.push({ role: m.role, content: String(m.content) })
          }
        }
      }
    }

    // Split attachments by kind: images stay binary (sent as image_url
    // content parts to the vision model), text payloads get folded into
    // a labelled section inside the user-message string.
    const imageAttachments = attachments.filter((a) => a.kind === 'image')
    const textAttachments = attachments.filter((a) => a.kind === 'text')

    const userMessage = (() => {
      const parts: string[] = []
      if (body.category) {
        parts.push(`Template category: ${body.category}.`)
      }
      // Always tell the model what's on the canvas right now, even on
      // create-hint turns — the user might be asking a question about an
      // empty canvas, and the model needs that context to decide intent.
      if (Array.isArray(body.existingBlocks) && body.existingBlocks.length > 0) {
        parts.push(`Current canvas has ${body.existingBlocks.length} blocks. Subject: "${body.existingSubject ?? ''}".`)
      } else {
        parts.push('Current canvas is empty.')
      }

      // Tell the model the existing theme overrides so it knows what
      // the user already set. This is CRITICAL: the OpenAI strict
      // schema forces every theme key to be present in the response,
      // so without this hint the model fills unchanged keys with
      // guessed defaults and wipes the user's previous overrides.
      const existingTheme = body.existingTheme && typeof body.existingTheme === 'object'
        ? body.existingTheme
        : null
      if (existingTheme && Object.keys(existingTheme).some((k) => existingTheme[k as keyof typeof existingTheme])) {
        parts.push(
          [
            'Current theme overrides (these are ALREADY APPLIED — preserve them unless the user explicitly asks to change a specific key):',
            JSON.stringify(existingTheme, null, 2),
            'When you respond, set ONLY the theme keys the user is asking about THIS turn. Set every OTHER theme key to null. The server merges your response with the current theme — null = "no change to that key", a string = "set to this colour".',
          ].join('\n'),
        )
      } else {
        parts.push(
          'Current theme: defaults (no per-template overrides). When you change one chrome colour, set ONLY that key on the theme; leave the others null.',
        )
      }
      if (mode === 'enhance') {
        // The strongest preservation guarantees come from the server-side
        // merge step, but we also lean on the prompt: explicit instructions
        // to preserve byte-for-byte text on every block the user did not
        // ask about. This stops the model from paraphrasing copy and
        // forcing the merge step to fall back on a fresh expansion.
        parts.push(
          [
            `You are editing an existing template. Apply ONLY the change the user explicitly asks for.`,
            `STRICT PRESERVATION RULES:`,
            `1. Return EVERY existing block unless the user asked to remove one. Order must match unless they asked to reorder.`,
            `2. For any block the user did not mention, copy its fields VERBATIM (same html text, same url, same colour, same alignment, etc.). Do NOT rephrase or "improve" untouched copy.`,
            `3. Only modify the specific field(s) the user named. Example: "make the title bold" — only change the heading/text block they're referring to; leave every other block exactly as it was.`,
            `4. If the user asks for an addition, insert the new block in the most natural position; do not touch the other blocks.`,
            `5. Keep the subject unchanged unless the user explicitly asks to change the subject.`,
          ].join('\n'),
        )
        if (body.existingSubject) {
          parts.push(`Current subject (keep unless asked otherwise): ${body.existingSubject}`)
        }
        parts.push(`Current blocks (JSON):\n${JSON.stringify(existingCompact, null, 2)}`)
        parts.push(`User instruction:\n${prompt || '(no message — see attachments)'}`)
      } else {
        parts.push(
          `Generate a new template. User description:\n${
            prompt || '(no message — see attachments)'
          }`,
        )
      }
      // Append extracted text from PDFs/Word/Excel/text files. The model
      // is instructed (in SYSTEM_PROMPT's "Attachments" section) to use
      // these as the source of truth for content.
      for (const a of textAttachments) {
        parts.push(`--- Attached file: ${a.name} ---\n${a.content}`)
      }
      return parts.join('\n\n')
    })()

    const openai = new OpenAI({ apiKey })
    // Structured outputs requires gpt-4o-2024-08-06 or newer. Default to a
    // pinned snapshot we know supports it; OPENAI_MODEL_TEMPLATE_AI lets us
    // override without touching Scout's model choice.
    const model =
      process.env.OPENAI_MODEL_TEMPLATE_AI ||
      process.env.OPENAI_MODEL ||
      'gpt-4o-2024-08-06'

    // Build the user message. With images, OpenAI requires a
    // content-parts array (text part + one image_url part per image);
    // without images, a plain string is fine.
    const userContent: string | ChatCompletionContentPart[] =
      imageAttachments.length === 0
        ? userMessage
        : [
            { type: 'text', text: userMessage },
            ...imageAttachments.map(
              (a) =>
                ({
                  type: 'image_url',
                  image_url: { url: a.dataUrl },
                }) as ChatCompletionContentPart,
            ),
          ]

    // Personalised greeting — pulls the super_admin's first name from
    // their profile and feeds it into the system prompt so the model
    // opens the first turn of every conversation by name.
    const firstName = deriveFirstName(auth.profile.full_name)
    const isFirstTurn = priorMessages.length === 0
    // Read the shared links so the AI can reference them by tag. Best
    // effort — a failure here just means it falls back to plain URLs.
    let sharedLinks: { key: string; label: string; url: string }[] = []
    try {
      const { data: brandingRow } = await admin
        .from('crm_settings')
        .select('value')
        .eq('key', 'email_branding')
        .maybeSingle()
      const configured = (brandingRow?.value as { config?: { links?: typeof sharedLinks } } | null)
        ?.config?.links
      if (Array.isArray(configured)) {
        sharedLinks = configured.filter((l) => l?.key && l?.url)
      }
    } catch (err) {
      console.error('Could not load shared links for the AI prompt:', err)
    }

    const systemPrompt = buildSystemPrompt(firstName, isFirstTurn, sharedLinks)

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...priorMessages,
      { role: 'user', content: userContent },
    ]

    let response
    const aiStartedAt = performance.now()
    try {
      response = await openai.chat.completions.create({
        model,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: openAiJsonSchema,
        },
        temperature: 0.5,
      })
    } catch (e) {
      console.error('[ai-generate] OpenAI request failed:', e)
      const message = e instanceof Error ? e.message : 'OpenAI request failed'
      // Log the failed call so the OpenAI Usage dashboard surfaces
      // it in the "errors still cost tokens" warning.
      await logOpenAIUsage({
        feature: 'template-ai-generate',
        model,
        startedAt: aiStartedAt,
        error: message,
        userId: auth.profile.id,
      })
      return Response.json({ error: `OpenAI: ${message}` }, { status: 502 })
    }
    // Successful completion — log usage / cost / latency.
    await logOpenAIUsage({
      feature: 'template-ai-generate',
      model,
      usage: response.usage,
      startedAt: aiStartedAt,
      userId: auth.profile.id,
    })

    const choice = response.choices[0]
    // If the model returned a refusal, surface that to the user verbatim
    // rather than swallowing it as "empty response".
    const refusal = choice?.message?.refusal
    if (refusal) {
      return Response.json({ error: `AI refused: ${refusal}` }, { status: 422 })
    }

    const raw = choice?.message?.content
    if (!raw) {
      return Response.json({ error: 'OpenAI returned an empty response.' }, { status: 502 })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return Response.json({ error: 'OpenAI returned invalid JSON.' }, { status: 502 })
    }

    const validation = aiTemplateResponseSchema.safeParse(parsed)
    if (!validation.success) {
      console.error('[ai-generate] schema validation failed:', validation.error)
      return Response.json(
        {
          error: 'AI returned a template that did not match the expected schema.',
          issues: validation.error.issues,
        },
        { status: 502 },
      )
    }

    // The model picks the intent itself (answer vs. create vs. enhance).
    // Trust it — the client's mode is just a hint. For 'answer' we skip
    // block expansion entirely; nothing should hit the canvas.
    const aiIntent = validation.data.intent
    const reply = validation.data.reply

    let blocks: ReturnType<typeof expandAiBlocks> = []
    let subject = ''
    let preheader = ''
    let name = ''
    // Theme overrides: only forwarded to the client when intent !=
    // 'answer'. The model returns null when no theme change is
    // intended; we strip null leaf fields so the client's merge is a
    // pure subset of the user-asked-for changes (preserves keys the
    // user previously set).
    type ThemeOverrides = {
      headerBgColor?: string
      headerTextColor?: string
      footerBgColor?: string
      footerTextColor?: string
      footerLinkColor?: string
      pageBgColor?: string
      bodyBgColor?: string
    }
    let theme: ThemeOverrides | null = null

    if (aiIntent !== 'answer') {
      // For enhance turns, run the preservation-aware merge: any returned
      // block whose content is identical to the original at the same index
      // gets reused as-is (preserving custom paddings, colours, and the
      // existing block id). Only blocks the AI actually changed get freshly
      // expanded. Stops "change one word" from regenerating the whole email.
      const produced =
        aiIntent === 'enhance' && Array.isArray(body.existingBlocks)
          ? mergeAiBlocksWithExisting(validation.data.blocks, body.existingBlocks)
          : expandAiBlocks(validation.data.blocks)

      // Last line of defence against a duplicated footer: the signature,
      // social row and partner logos are appended globally at send time, so
      // a copy inside the template would render them twice.
      const guarded = stripGlobalBlocks(produced)
      if (guarded.removed > 0) {
        console.warn(
          `AI returned ${guarded.removed} global block(s) (signature/social/company); stripped before saving.`,
        )
      }
      blocks = guarded.blocks
      subject = validation.data.subject
      preheader = validation.data.preheader ?? ''
      name = validation.data.name
      const t = validation.data.theme
      if (t) {
        const onlySet: ThemeOverrides = {}
        if (t.headerBgColor) onlySet.headerBgColor = t.headerBgColor
        if (t.headerTextColor) onlySet.headerTextColor = t.headerTextColor
        if (t.footerBgColor) onlySet.footerBgColor = t.footerBgColor
        if (t.footerTextColor) onlySet.footerTextColor = t.footerTextColor
        if (t.footerLinkColor) onlySet.footerLinkColor = t.footerLinkColor
        if (t.pageBgColor) onlySet.pageBgColor = t.pageBgColor
        if (t.bodyBgColor) onlySet.bodyBgColor = t.bodyBgColor
        if (Object.keys(onlySet).length > 0) theme = onlySet
      }
    }

    // Persist the turn so the user can resume later. Done with the service-
    // role client (bypasses RLS); the route already gated on super_admin
    // above so authorisation is settled.
    let chatId = body.chat_id ?? null

    // Lazily create the chat. Title comes from the first user message via
    // deriveChatTitle so the history list doesn't fill with "Untitled".
    if (!chatId) {
      const { data: created, error: createErr } = await admin
        .from('template_ai_chats')
        .insert({
          user_id: auth.profile.id,
          title: deriveChatTitle(prompt || 'Attachment'),
          // Pin the chat to the active email template so we can
          // auto-resume the conversation when the user re-opens this
          // template after a refresh / browser-close. Null when the
          // user is on a brand-new template that hasn't been saved yet.
          template_id: body.template_id ?? null,
        })
        .select('id')
        .single()
      if (createErr) {
        console.error('[ai-generate] failed to create chat:', createErr)
      } else {
        chatId = created.id
      }
    }

    if (chatId) {
      // For answer turns we don't snapshot the canvas — there's no canvas
      // change to restore. The thread bubble shows the reply text directly.
      const inserts = [
        {
          chat_id: chatId,
          role: 'user' as const,
          content: prompt,
          blocks_snapshot: null,
          subject_snapshot: null,
          preheader_snapshot: null,
        },
        {
          chat_id: chatId,
          role: 'assistant' as const,
          // Store the model's natural-language reply so resume rehydrates
          // the conversation faithfully (and not the old "Generated N
          // blocks" placeholder).
          content: reply,
          blocks_snapshot: aiIntent === 'answer' ? null : blocks,
          subject_snapshot: aiIntent === 'answer' ? null : subject,
          preheader_snapshot: aiIntent === 'answer' ? null : preheader,
        },
      ]
      const { error: msgErr } = await admin
        .from('template_ai_messages')
        .insert(inserts)
      if (msgErr) {
        console.error('[ai-generate] failed to log messages:', msgErr)
      }
    }

    return Response.json({
      intent: aiIntent,
      reply,
      name,
      subject,
      preheader,
      blocks,
      theme,
      chat_id: chatId,
    })
  } catch (e) {
    // Last-resort catcher. Anything that throws in the path above
    // (module-load failures, unexpected null deref, etc.) lands here and
    // gets a proper JSON body so the client toast shows the cause.
    console.error('[ai-generate] unhandled error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    const stack = e instanceof Error ? e.stack : undefined
    return Response.json(
      {
        error: `Unhandled server error: ${message}`,
        stack: process.env.NODE_ENV === 'development' ? stack : undefined,
      },
      { status: 500 },
    )
  }
}
