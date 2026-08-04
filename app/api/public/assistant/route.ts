import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getServiceClient, processFormSubmission, type ContactInput } from '@/lib/forms/process-submission'
import { WEBSITE_FORM_MAP } from '@/lib/forms/forms-config'
import { logOpenAIUsage } from '@/lib/ai/usage-logger'
import { ASSISTANT_SYSTEM_PROMPT } from '@/lib/assistant/knowledge'
import { captureEnquiry, type EnquiryArgs } from '@/lib/assistant/capture'

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

// A FULL application, collected conversationally. Runs the identical landing →
// automation → deal pipeline as the website apply form, so a chatbot application
// lands in the CRM exactly like a form one (just tagged as chatbot-sourced).
const SUBMIT_APPLICATION_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'submit_application',
    description:
      "Submit a visitor's completed programme application to the CRM (same as filling in the website form). Only call this once the visitor has chosen a programme AND given every required detail and confirmed. Creates a real application — never guess or invent a field.",
    parameters: {
      type: 'object',
      properties: {
        programme: {
          type: 'string',
          enum: ['training', 'university', 'gap-year'],
          description: "'training' = Summer Residency, 'university' = University, 'gap-year' = Gap Year.",
        },
        firstName: { type: 'string', description: 'First name' },
        lastName: { type: 'string', description: 'Last name / surname' },
        email: { type: 'string', description: 'Email address (required)' },
        phone: { type: 'string', description: 'Phone number including country code if given' },
        dob: { type: 'string', description: 'Date of birth in YYYY-MM-DD format' },
        gender: { type: 'string', description: "Gender, e.g. 'male' or 'female'" },
        country: { type: 'string', description: 'Country of residence' },
        region: { type: 'string', description: 'State / region / county' },
        position: { type: 'string', description: 'Preferred football position' },
        yearOfEntry: { type: 'string', description: 'Expected year of entry, e.g. 2026 (University / Gap Year)' },
        lengthOfStay: { type: 'string', description: 'Length of stay for Summer Residency, e.g. 2, 4 or 6 weeks' },
      },
      required: ['programme', 'firstName', 'lastName', 'email'],
      additionalProperties: false,
    },
  },
}

interface ApplicationArgs {
  programme?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  dob?: string
  gender?: string
  country?: string
  region?: string
  position?: string
  yearOfEntry?: string
  lengthOfStay?: string
}

// Renders an inline application form INSIDE the chat, prefilled with whatever
// the visitor has already given. Preferred over asking every field one by one:
// the visitor completes a compact structured form (date picker, dropdowns) in
// one go, which is faster and far more accurate than free-text collection.
const OPEN_FORM_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'open_application_form',
    description:
      "Show the visitor an inline application form to complete inside the chat. Call this AS SOON AS the visitor wants to apply/enrol and a specific programme is known — do NOT ask for each field one by one in the chat. Put a short warm one-line lead-in in `message`, and include every detail the visitor has already mentioned so it's prefilled and they don't retype it.",
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'A short, friendly one-line lead-in shown above the form.' },
        programme: {
          type: 'string',
          enum: ['training', 'university', 'gap-year'],
          description: "'training' = Summer Residency, 'university' = University, 'gap-year' = Gap Year.",
        },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        dob: { type: 'string', description: 'Date of birth in YYYY-MM-DD format' },
        gender: { type: 'string' },
        country: { type: 'string' },
        region: { type: 'string', description: 'State / region / county' },
        position: { type: 'string' },
        yearOfEntry: { type: 'string' },
        lengthOfStay: { type: 'string' },
      },
      required: ['programme'],
      additionalProperties: false,
    },
  },
}

/** Run a chatbot-collected application through the shared form pipeline. */
async function submitApplication(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  args: ApplicationArgs,
): Promise<{ ok: boolean; error?: string }> {
  const mapping = args.programme ? WEBSITE_FORM_MAP[args.programme] : undefined
  if (!mapping) return { ok: false, error: 'unknown_programme' }
  const email = args.email?.trim()
  if (!email) return { ok: false, error: 'email_required' }

  const contact: ContactInput = {
    first_name: args.firstName?.trim() || null,
    last_name: args.lastName?.trim() || null,
    email,
    phone: args.phone?.trim() || null,
    date_of_birth: args.dob?.trim() || null,
    gender: args.gender?.trim() || null,
    country: args.country?.trim() || null,
    state: args.region?.trim() || null,
    position: args.position?.trim() || null,
    expected_year_of_entry: args.yearOfEntry?.trim() || null,
    length_of_stay: args.lengthOfStay?.trim() || null,
  }

  const result = await processFormSubmission({
    formId: mapping.formId,
    formName: mapping.formName,
    formSource: 'chatbot',
    contact,
    rawPayload: { ...args, via: 'chatbot' },
    contactSource: 'website_chatbot',
    tags: [{ name: 'Chatbot', category: 'source' }],
    supabase,
  })
  return { ok: result.ok, error: result.error }
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
    // Tool loop: a few passes to allow an optional capture_enquiry /
    // submit_application call, then the final natural-language reply.
    for (let i = 0; i < 3; i++) {
      const startedAt = performance.now()
      const completion = await openai.chat.completions.create({
        model,
        messages,
        tools: [CAPTURE_TOOL, SUBMIT_APPLICATION_TOOL, OPEN_FORM_TOOL],
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

      // open_application_form short-circuits the loop: we hand a form directive
      // back to the widget, which renders the inline application form. No CRM
      // write happens here — submission runs through the normal /apply pipeline.
      const formCall = toolCalls.find(
        (c) => c.type === 'function' && c.function.name === 'open_application_form',
      )
      if (formCall && formCall.type === 'function') {
        let parsed: ApplicationArgs & { message?: string } = {}
        try {
          parsed = JSON.parse(formCall.function.arguments || '{}')
        } catch {
          parsed = {}
        }
        const { message, programme, ...prefill } = parsed
        return NextResponse.json({
          reply:
            (typeof message === 'string' && message.trim()) ||
            "Great — let's get your application started. Fill in the details below and I'll submit it for you.",
          form: { programme, prefill },
          captured,
        })
      }

      // Execute tool calls, append results, loop for the final reply.
      messages.push(choice)
      for (const call of toolCalls) {
        if (call.type !== 'function') continue
        let result: { ok: boolean; error?: string } = { ok: false }
        if (call.function.name === 'capture_enquiry') {
          let parsed: EnquiryArgs = {}
          try {
            parsed = JSON.parse(call.function.arguments || '{}')
          } catch {
            parsed = {}
          }
          result = await captureEnquiry(supabase, parsed)
          if (result.ok) captured = true
        } else if (call.function.name === 'submit_application') {
          let parsed: ApplicationArgs = {}
          try {
            parsed = JSON.parse(call.function.arguments || '{}')
          } catch {
            parsed = {}
          }
          result = await submitApplication(supabase, parsed)
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
