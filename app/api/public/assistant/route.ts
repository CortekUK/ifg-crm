import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getServiceClient } from '@/lib/forms/process-submission'
import { logOpenAIUsage } from '@/lib/ai/usage-logger'
import { ASSISTANT_SYSTEM_PROMPT } from '@/lib/assistant/knowledge'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Public website assistant (the floating chat widget on the marketing site).
 *
 * The website's own server proxy (web /api/assistant) forwards here with the
 * shared FORM_INGEST_SECRET, so this endpoint isn't openly callable and the
 * secret never reaches the browser — same trust model as /api/public/forms/submit.
 *
 * This assistant only knows PUBLIC marketing content (see lib/assistant/knowledge).
 * It has NO access to CRM data. Its one side effect is capture_enquiry, which
 * lands a contact + adds them to the "Website Enquiries" list (list-only routing).
 */

export const runtime = 'nodejs'

// Guardrails for a public endpoint.
const MAX_MESSAGES = 24
const MAX_CONTENT_CHARS = 2000

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const CAPTURE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'capture_enquiry',
    description:
      "Save a website visitor's enquiry so the IFG team can follow up. Call this when the visitor wants to be contacted or shares their details. Email is required; include anything else they've given.",
    parameters: {
      type: 'object',
      properties: {
        email: { type: 'string', description: "Visitor's email address (required)" },
        name: { type: 'string', description: 'Full name if given' },
        phone: { type: 'string', description: 'Phone number if given' },
        interest: {
          type: 'string',
          description: 'Which programme/route they are interested in, if known (e.g. Summer Residency, University, Gap Year)',
        },
        message: { type: 'string', description: 'A short summary of what they want / their question' },
      },
      required: ['email'],
      additionalProperties: false,
    },
  },
}

/** Find-or-create a marketing list by name, returning its id (or null). */
async function findOrCreateList(supabase: SupabaseClient, name: string): Promise<string | null> {
  const { data: existing } = await supabase.from('lists').select('id').eq('name', name).maybeSingle()
  if (existing?.id) return existing.id as string
  const { data: created } = await supabase
    .from('lists')
    .insert({ name, description: 'Leads captured by the website assistant', sport: 'football', is_dynamic: false })
    .select('id')
    .single()
  if (created?.id) return created.id as string
  // Lost a create race — re-read.
  const { data: refetched } = await supabase.from('lists').select('id').eq('name', name).maybeSingle()
  return (refetched?.id as string) ?? null
}

interface EnquiryArgs {
  email?: string
  name?: string
  phone?: string
  interest?: string
  message?: string
}

/** Land an enquiry as a contact + add to the "Website Enquiries" list (list-only). */
async function captureEnquiry(supabase: SupabaseClient, args: EnquiryArgs): Promise<{ ok: boolean }> {
  const email = args.email?.toLowerCase().trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false }

  const parts = (args.name ?? '').trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] || 'Website'
  const lastName = parts.slice(1).join(' ') || 'Enquiry'

  const { data: existing } = await supabase.from('contacts').select('id').eq('email', email).maybeSingle()
  let contactId: string | null = existing?.id ?? null

  if (contactId) {
    const updates: Record<string, unknown> = {}
    if (parts.length) {
      updates.first_name = firstName
      updates.last_name = lastName
    }
    if (args.phone) updates.phone = args.phone
    if (Object.keys(updates).length) await supabase.from('contacts').update(updates).eq('id', contactId)
  } else {
    const { data: created } = await supabase
      .from('contacts')
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        phone: args.phone ?? null,
        source: 'website_chatbot',
      })
      .select('id')
      .single()
    contactId = created?.id ?? null
  }

  if (!contactId) return { ok: false }

  const listId = await findOrCreateList(supabase, 'Website Enquiries')
  if (listId) {
    await supabase
      .from('contact_lists')
      .upsert(
        { contact_id: contactId, list_id: listId, added_at: new Date().toISOString() },
        { onConflict: 'contact_id,list_id' },
      )
  }

  // Audit log so chatbot leads appear under Form Submissions like other captures.
  await supabase.from('form_submissions').insert({
    contact_id: contactId,
    form_id: 'enquiry',
    form_source: 'chatbot',
    payload: args as Record<string, unknown>,
    status: 'processed',
  })

  return { ok: true }
}

export async function POST(request: NextRequest) {
  // --- auth: shared secret (same as the forms ingest) ---
  const secret = process.env.FORM_INGEST_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Assistant is not configured.' }, { status: 500 })
  }
  const auth = request.headers.get('authorization') || ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Assistant is temporarily unavailable.' }, { status: 503 })
  }

  // --- parse + validate ---
  let body: { messages?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : []
  const history: ChatMessage[] = rawMessages
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof (m as ChatMessage).content === 'string' &&
        ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant'),
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT_CHARS) }))

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'A user message is required.' }, { status: 400 })
  }

  const supabase = getServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Assistant is temporarily unavailable.' }, { status: 503 })
  }

  const openai = new OpenAI({ apiKey })
  const model = process.env.OPENAI_ASSISTANT_MODEL || 'gpt-4o-mini'

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
    ...history,
  ]

  let captured = false

  try {
    // Tool loop: at most 2 passes (one optional capture_enquiry, then the
    // final natural-language reply).
    for (let i = 0; i < 2; i++) {
      const startedAt = performance.now()
      const completion = await openai.chat.completions.create({
        model,
        messages,
        tools: [CAPTURE_TOOL],
        max_tokens: 600,
        temperature: 0.4,
      })
      await logOpenAIUsage({
        feature: 'website_assistant',
        model,
        usage: completion.usage,
        startedAt,
      })

      const choice = completion.choices[0]?.message
      if (!choice) break

      const toolCalls = choice.tool_calls ?? []
      if (toolCalls.length === 0) {
        return NextResponse.json({ reply: choice.content ?? '', captured })
      }

      // Execute tool calls, append results, loop for the final reply.
      messages.push(choice)
      for (const call of toolCalls) {
        if (call.type !== 'function') continue
        let result = { ok: false }
        if (call.function.name === 'capture_enquiry') {
          let parsed: EnquiryArgs = {}
          try {
            parsed = JSON.parse(call.function.arguments || '{}')
          } catch {
            parsed = {}
          }
          result = await captureEnquiry(supabase, parsed)
          if (result.ok) captured = true
        }
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        })
      }
    }

    // Fallback if the loop exhausted without a plain message.
    return NextResponse.json({
      reply:
        "Thanks! Our team will be in touch. In the meantime you can apply or book a call from the website.",
      captured,
    })
  } catch (err) {
    console.error('Assistant error:', err)
    await logOpenAIUsage({
      feature: 'website_assistant',
      model,
      error: err instanceof Error ? err.message : 'unknown',
    })
    return NextResponse.json({ error: 'The assistant hit a snag. Please try again.' }, { status: 502 })
  }
}
