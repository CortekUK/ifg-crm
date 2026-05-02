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
} from '@/lib/templates/ai-schema'
import type { EditorBlock } from '@/lib/templates/editor-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RequestBody {
  prompt?: string
  mode?: 'create' | 'enhance'
  category?: 'automation' | 'campaign' | 'transactional'
  existingBlocks?: EditorBlock[]
  existingSubject?: string
  // Optional. When omitted we lazily create a new chat. When supplied we
  // append turns to it. The response always returns a chat_id so the
  // client can pin to it for subsequent turns in the same conversation.
  chat_id?: string | null
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

const SYSTEM_PROMPT = `You are an email-template generator for the IFG CRM (International Football Group), a recruitment platform that places football players into university and academy programmes.

You generate templates as a structured JSON object containing a short internal name, a subject line, an optional preheader, and an ordered list of blocks. The exact JSON schema is enforced by the API — fill every required field.

The \`name\` is the file-name shown in the templates list; the \`subject\` is what the recipient sees in their inbox. They are NOT the same — the name should be 2-5 words, title-cased, descriptive of the template's purpose ("Summer Residency Welcome", "Interview Confirmation", "Deposit Reminder", "Onboarding Day 1"). Avoid emojis or punctuation in names.

# Available block types

Pick from these and only these:
- **text** — paragraph copy. \`html\` field accepts simple HTML: <p>, <br>, <strong>, <em>, <u>, <a href>, <ul>, <ol>, <li>, <span>. Use <strong> for emphasis. Use merge tags (see below) directly inside the html. For PARTIAL colouring (one word/phrase a different colour) use \`<span style="color:#ef4444">red word</span>\` inside the html. For a WHOLE-block colour use the top-level \`color\` field instead. The \`background\` field tints the block's background.
- **heading** — section heading (renders as a bold, larger text block). Levels 1-3, default 2. **Almost every email should open with a level-1 or level-2 heading** that summarises what the email is about (e.g. "Welcome to Summer Residency", "Your interview is confirmed", "Deposit due in 3 days"). Add additional headings to break the body into clear sections when the email has more than one topic. **Set the \`color\` field whenever the user asks for a coloured title** (e.g. "make the title red" → \`color: "#ef4444"\`); the field is required and the only way colour actually applies — leaving it null and trying to add colour through the text won't render.
- **button** — call-to-action. \`text\` is the label, \`url\` is the destination. Always prefer a merge tag URL when one fits the action (e.g. \`{{deal_owner_calendly}}\` for "book a call", \`{{invoice_payment_link}}\` for "pay invoice"). Default colour is brand blue (#3b82f6); only override when the user asks. Other knobs the AI controls: \`textColor\`, \`borderRadius\` (0-40 px; 0 = sharp, 24+ = pill), \`width\` (auto/50/75/full), \`paddingTop\`, \`paddingBottom\`.
- **divider** — horizontal line, used between sections. Knobs: \`style\` (solid/dashed/dotted), \`color\` (hex), \`thickness\` (1-8 px), \`width\` (25/50/75/100 %), \`paddingTop\`, \`paddingBottom\`.
- **spacer** — vertical whitespace. \`height\` 8-80, defaults to 20.
- **image** — only emit when the user explicitly provides an image URL or asks for one. Never invent placeholder image URLs. Knobs: \`alt\`, \`alignment\`, \`width\` (full/large/medium/small), \`linkUrl\` (makes the whole image clickable), \`paddingTop\`, \`paddingBottom\`.
- **recruiter_signature** — IFG's signature block. Renders the deal owner's photo, name, title, email, phone and Calendly link automatically. Place at the very end of the email instead of writing a manual sign-off. Toggles: \`showPhoto\`, \`showName\`, \`showTitle\`, \`showEmail\`, \`showPhone\`, \`showCalendly\` (all default true). Layout: \`layout\` (inline = photo + details side-by-side, stacked = vertical), \`alignment\`, \`photoSize\` (small/medium/large = 40/60/80 px). Honour requests like "hide the phone" → \`showPhone: false\`, "small avatar" → \`photoSize: "small"\`.

Padding fields are in pixels (0-80) and exist on text, heading, button, image, divider, recruiter_signature. Honour user requests like "more space below the title" → \`paddingBottom: 28\` or "tighter button" → \`paddingTop: 4, paddingBottom: 4\`.
- **html** — small custom HTML snippet. Use ONLY when no other block fits (e.g. a coloured callout box, a tiny inline-styled hero). Will be sanitised server-side; \`<script>/<iframe>/<style>/<form>/on*=/javascript:\` are stripped, so don't rely on them. Keep snippets short (< 1KB).
- **video** — embed a YouTube/Vimeo/Loom URL. Only emit if the user supplied a URL or explicitly asked for a video. If they didn't, leave \`url\` as an empty string and they'll fill it in.
- **social** — row of social-platform icons. Set \`enabled: true\` only on the platforms IFG actually uses (facebook, instagram, linkedin most commonly). Leave \`url\` empty — the user will plug those in. Use \`monochrome\` style for serious tones, \`coloured\` for playful.
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
- End with a recruiter_signature block (NOT a manual signature).
- Avoid spacers between every block — only use them where vertical breathing room actually helps. Dividers are stronger separators; use them between distinct sections.

# What NOT to do

- Don't emit images you invented URLs for.
- Don't write a manual signature ("Best, John") in a text block — use recruiter_signature.
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
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'super_admin') {
    return { error: 'AI template generation is restricted to super_admin users.', status: 403 as const }
  }
  return { profile }
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

    const prompt = body.prompt?.trim()
    const mode: 'create' | 'enhance' = body.mode === 'enhance' ? 'enhance' : 'create'
    if (!prompt) {
      return Response.json({ error: 'prompt is required' }, { status: 400 })
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

    const userMessage = (() => {
      const parts: string[] = []
      if (body.category) {
        parts.push(`Template category: ${body.category}.`)
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
        parts.push(`User instruction:\n${prompt}`)
      } else {
        parts.push(`Generate a new template. User description:\n${prompt}`)
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

    let response
    try {
      response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: openAiJsonSchema,
        },
        temperature: 0.5,
      })
    } catch (e) {
      console.error('[ai-generate] OpenAI request failed:', e)
      const message = e instanceof Error ? e.message : 'OpenAI request failed'
      return Response.json({ error: `OpenAI: ${message}` }, { status: 502 })
    }

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

    // For enhance mode, run the preservation-aware merge: any returned
    // block whose content is identical to the original at the same index
    // gets reused as-is (preserving custom paddings, colours, and the
    // existing block id). Only blocks the AI actually changed get freshly
    // expanded. Stops "change one word" from regenerating the whole email.
    const blocks =
      mode === 'enhance' && Array.isArray(body.existingBlocks)
        ? mergeAiBlocksWithExisting(validation.data.blocks, body.existingBlocks)
        : expandAiBlocks(validation.data.blocks)

    const subject = validation.data.subject
    const preheader = validation.data.preheader ?? ''
    const name = validation.data.name

    // Persist the turn so the user can resume later. Done with the service-
    // role client (bypasses RLS); the route already gated on super_admin
    // above so authorisation is settled.
    const admin = getAdmin()
    let chatId = body.chat_id ?? null

    // Lazily create the chat. Title comes from the first user message via
    // deriveChatTitle so the history list doesn't fill with "Untitled".
    if (!chatId) {
      const { data: created, error: createErr } = await admin
        .from('template_ai_chats')
        .insert({ user_id: auth.profile.id, title: deriveChatTitle(prompt) })
        .select('id')
        .single()
      if (createErr) {
        console.error('[ai-generate] failed to create chat:', createErr)
      } else {
        chatId = created.id
      }
    }

    if (chatId) {
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
          content:
            mode === 'create'
              ? `Generated ${blocks.length} block${blocks.length === 1 ? '' : 's'}.`
              : `Updated — ${blocks.length} block${blocks.length === 1 ? '' : 's'} now.`,
          // Snapshot the resulting state so resume can hydrate the canvas.
          blocks_snapshot: blocks,
          subject_snapshot: subject,
          preheader_snapshot: preheader,
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
      name,
      subject,
      preheader,
      blocks,
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
