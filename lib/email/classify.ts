/**
 * Inbound-reply classification, shared by every ingest path.
 *
 * MIRROR: classifyIntent() / detectAutoReply() in
 * supabase/functions/resend-inbound/index.ts. That copy handles mail arriving
 * through Resend; this one handles mail arriving through Outlook. They must
 * agree, or the same reply is labelled one way through one pipe and another
 * way through the other — and the intent is what decides whether a deal moves
 * and whether a follow-up sequence stops.
 *
 * The prompt below is copied verbatim from the edge function. If you change
 * one, change both.
 */

const CLASSIFICATION_PROMPT = `You are classifying the intent of a reply to a business outreach/recruitment email.

Classify as exactly one of:
- positive: Interested, wants to learn more, agrees to meeting/call, asks about opportunity details
- negative: Not interested, not a fit, cannot afford it, already committed elsewhere — but WITHOUT asking to be removed from the list
- unsubscribe: Explicitly asks to stop being contacted — "stop emailing me", "remove me from your list", "unsubscribe", "do not contact me again". Prefer this over negative whenever a request to stop is present, because it takes the contact off email.
- question: Asking a question that needs a human response (cost, dates, requirements, timeline) without clear positive/negative signal
- neutral: Acknowledgment without clear intent, or forwarded without comment
- unknown: Cannot determine intent, or too short/ambiguous to tell

The reply may be in any language, including romanised Urdu/Hindi. Classify on
MEANING, not on language — "mujhy chahyie" ("I want it") is positive, and
"mujhy zarorat nahi" ("I don't need it") is negative. Only answer unknown when
the meaning genuinely cannot be made out; a short reply that clearly expresses
interest or refusal is not unknown. "My mom won't let me" is negative.

Respond with ONLY the classification word, nothing else.`

const MAX_CLASSIFICATION_CHARS = 2000

const VALID_INTENTS = ['positive', 'negative', 'neutral', 'question', 'unknown', 'unsubscribe']

export async function classifyIntent(text: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !text) return null

  // Cost guardrail, same as the edge function: the intent of a long message is
  // in its first paragraph, and the rest is usually a quoted thread.
  if (text.length > MAX_CLASSIFICATION_CHARS) return null

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 5,
        temperature: 0,
        messages: [
          { role: 'system', content: CLASSIFICATION_PROMPT },
          { role: 'user', content: text },
        ],
      }),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const result = await response.json()
    const intent = result?.choices?.[0]?.message?.content?.trim().toLowerCase()
    return VALID_INTENTS.includes(intent) ? intent : null
  } catch {
    return null
  }
}

const AUTO_REPLY_SUBJECT_PATTERNS: RegExp[] = [
  /^\s*(re\s*:\s*)?(automatic reply|auto(matic)?[- ]?response|autoreply)\b/i,
  /^\s*(re\s*:\s*)?out of (the )?office\b/i,
  /^\s*(re\s*:\s*)?(i am|i'm) (currently )?(out of|away)\b/i,
  /^\s*(re\s*:\s*)?(abwesenheitsnotiz|respuesta autom|r.ponse automatique|risposta automatica)/i,
]

/**
 * Is this an autoresponder rather than the player writing back?
 *
 * QA-28 Bug 3: a holiday autoresponder was classified neutral, counted as a
 * real reply, stopped the follow-up sequence for good and moved the card to
 * Contact Response — so the board claimed a player had responded when they
 * had not. The flag goes on the INSERT so the stop trigger sees it at the
 * moment it decides (migration 229).
 */
export function detectAutoReply(
  headers: Record<string, string> | null | undefined,
  subject: string | null | undefined,
): boolean {
  const h: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers ?? {})) {
    if (typeof v === 'string') h[k.toLowerCase()] = v.toLowerCase()
  }

  const autoSubmitted = h['auto-submitted'] ?? ''
  if (autoSubmitted && autoSubmitted.trim() !== 'no') return true
  if (h['x-autoreply'] === 'yes' || h['x-autorespond'] || h['x-autoreply-domain']) return true
  if (h['x-auto-response-suppress']) return true

  const precedence = h['precedence'] ?? ''
  if (['auto_reply', 'bulk', 'junk'].includes(precedence.trim())) return true

  return AUTO_REPLY_SUBJECT_PATTERNS.some((re) => re.test(subject ?? ''))
}

/**
 * Escape LIKE/ILIKE wildcards so a value matches literally.
 * An email address can legitimately contain both `%` and `_`, and PostgREST
 * passes the pattern to ILIKE verbatim — QA-28 Minor 2.
 */
export function escapeLikeWildcards(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`)
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function truncateText(text: string, maxLength: number): string {
  if (!text) return ''
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`
}
