import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { VENDOR_EXCEPT_DOMAINS } from './classify-sender'
import { bulkHeaderReason, personalMarker, type DropReason } from './relevance-rules'
import { headersToRecord, type GraphMessage } from './types'

/**
 * Is this message IFG business, or the mailbox owner's private life?
 *
 * Asked BEFORE anything is stored and before any intent classification, so a
 * personal message never reaches email_replies, email_sends, email_threads or
 * OpenAI's intent prompt. Hiding it after storage was the old approach, and
 * it left recruiters' login codes one query away from anyone with database
 * access.
 *
 * Three stages, in an order that settles ties in favour of people:
 *
 *   1. KEEP  — anyone on the message is a contact, a parent, a connected
 *              address or a colleague; or the conversation is one the CRM is
 *              already in; or it is a business robot (Calendly bookings).
 *   2. DROP  — a personal marker: a one-time code, a sign-in alert, a consumer
 *              service, an automated address, a newsletter's headers.
 *   3. ASK   — a real-looking person nobody knows yet. Could be a new parent's
 *              first enquiry, could be the recruiter's landlord. A short AI
 *              check decides; if it cannot answer, the message is KEPT.
 *
 * Why fail open at stage 3 only: by then every machine-sent and every
 * account-security message has been dropped by rule, so what is left is a
 * human writing to a work address — and the mailbox it lands in is readable
 * by its owner alone (migration 265). Losing a new enquiry is the failure the
 * brief names first.
 */

export type KeepReason =
  | 'contact'
  | 'colleague'
  | 'crm_conversation'
  | 'business_service'
  | 'ai_business'
  | 'ai_unavailable'

export type Relevance =
  | { keep: true; reason: KeepReason }
  | { keep: false; reason: DropReason }

export interface RelevanceInput {
  mailboxUserId: string
  message: GraphMessage
  direction: 'inbound' | 'outbound'
  /** The sender inbound, the first recipient outbound. */
  counterparty: string | null
  /** Every address on the message except the mailbox's own. */
  participants: string[]
  /** Plain text with quoted history removed. */
  text: string
  /** Fetch internetMessageHeaders when the message arrived without them. */
  loadHeaders?: () => Promise<{ name: string; value: string }[] | null>
}

/** Enough addresses to cover a real conversation; a mass mail-out is not one. */
const MAX_PARTICIPANTS_CHECKED = 10

/** Categories a thread can hold that do NOT make its conversation business. */
const NON_BUSINESS_CATEGORIES = ['vendor', 'personal']

async function isKnownPerson(supabase: SupabaseClient, address: string): Promise<KeepReason | null> {
  const [{ data: staff }, { data: contact }] = await Promise.all([
    supabase.rpc('is_staff_email', { p_email: address }),
    supabase.rpc('resolve_contact_by_email', { p_email: address }),
  ])
  if ((contact as { contact_id: string }[] | null)?.[0]?.contact_id) return 'contact'
  if (staff === true) return 'colleague'
  return null
}

async function isCrmConversation(
  supabase: SupabaseClient,
  mailboxUserId: string,
  conversationId: string | null | undefined,
): Promise<boolean> {
  if (!conversationId) return false
  const [{ data: thread }, { data: send }] = await Promise.all([
    supabase
      .from('email_threads')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('mailbox_user_id', mailboxUserId)
      .not('category', 'in', `(${NON_BUSINESS_CATEGORIES.join(',')})`)
      .limit(1)
      .maybeSingle(),
    // A message the CRM itself sent from this mailbox (Compose, Reply, an
    // invoice with a pay link). The reply belongs with it whoever writes it.
    supabase
      .from('email_sends')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('mailbox_user_id', mailboxUserId)
      .limit(1)
      .maybeSingle(),
  ])
  return !!thread || !!send
}

function isBusinessService(address: string | null): boolean {
  const domain = (address ?? '').toLowerCase().split('@')[1] ?? ''
  return VENDOR_EXCEPT_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
}

export async function decideRelevance(
  supabase: SupabaseClient,
  input: RelevanceInput,
): Promise<Relevance> {
  const { message } = input

  // ── 1. keep ────────────────────────────────────────────────────────────
  const addresses = [...new Set(input.participants)].slice(0, MAX_PARTICIPANTS_CHECKED)
  const known = await Promise.all(addresses.map((a) => isKnownPerson(supabase, a)))
  if (known.includes('contact')) return { keep: true, reason: 'contact' }
  // A colleague counts only as the person the mail is WITH. Copied in among
  // other recipients — an all-staff promotion, say — they prove nothing.
  const counterpartyIndex = input.counterparty ? addresses.indexOf(input.counterparty) : -1
  if (counterpartyIndex >= 0 && known[counterpartyIndex] === 'colleague') {
    return { keep: true, reason: 'colleague' }
  }

  if (await isCrmConversation(supabase, input.mailboxUserId, message.conversationId)) {
    return { keep: true, reason: 'crm_conversation' }
  }
  if (isBusinessService(input.counterparty)) return { keep: true, reason: 'business_service' }

  // ── 2. drop by rule ────────────────────────────────────────────────────
  const marker = personalMarker({
    counterparty: input.counterparty,
    subject: message.subject ?? null,
    text: input.text,
  })
  if (marker) return { keep: false, reason: marker }

  // Headers are not part of a delta page, so they are fetched here — only for
  // the few messages that got this far, not for every message in the sweep.
  // Written back onto the message so the auto-reply check in ingest sees them.
  if (input.direction === 'inbound') {
    if (!message.internetMessageHeaders && input.loadHeaders) {
      message.internetMessageHeaders = (await input.loadHeaders().catch(() => null)) ?? []
    }
    const bulk = bulkHeaderReason(headersToRecord(message.internetMessageHeaders))
    if (bulk) return { keep: false, reason: bulk }
  }

  // ── 3. ask ─────────────────────────────────────────────────────────────
  const verdict = await classifyBusinessRelevance({
    direction: input.direction,
    counterparty: input.counterparty,
    counterpartyName:
      (input.direction === 'inbound'
        ? message.from?.emailAddress?.name
        : message.toRecipients?.[0]?.emailAddress?.name) ?? null,
    subject: message.subject ?? null,
    text: input.text,
  })
  if (verdict === 'personal') return { keep: false, reason: 'ai_personal' }
  return { keep: true, reason: verdict === 'business' ? 'ai_business' : 'ai_unavailable' }
}

const RELEVANCE_PROMPT = `You screen email for the CRM of The International Football Group (IFG).

IFG runs football (soccer) education and development programmes for players aged roughly 15-23: US college soccer scholarships, university and masters pathways, gap year, residency and summer residency programmes, spring camps, the Juventus Experience, ID clinics, and Macclesfield FC programmes. Staff are recruiters and administrators who talk to players, parents, schools, universities, coaches, clubs, agents, partners and suppliers.

An employee's work mailbox is connected to the CRM. Decide whether this email is IFG BUSINESS (it belongs in the CRM) or PERSONAL (the employee's private life, which must never be shown in the CRM).

BUSINESS: a player, parent, coach, school, university, club, agent, partner or supplier writing about football, education, a programme, an application, trials, fees, payments, invoices, travel or accommodation for a programme, scheduling a call, or IFG operations. A first enquiry from a stranger about any of this is BUSINESS.

PERSONAL: the employee's own family and friends about non-work matters, personal shopping, banking, bills, subscriptions, social media, dating, personal travel, medical matters, newsletters, marketing and promotions, verification codes and account alerts.

If a real person is writing about work and you are unsure, answer BUSINESS. If it is a promotion or anything about the employee's private life, answer PERSONAL.

Respond with ONLY one word: BUSINESS or PERSONAL.`

/** Enough to tell a parent's enquiry from a landlord's; no more leaves the CRM. */
const MAX_RELEVANCE_CHARS = 600

export async function classifyBusinessRelevance(input: {
  direction: 'inbound' | 'outbound'
  counterparty: string | null
  counterpartyName: string | null
  subject: string | null
  text: string
}): Promise<'business' | 'personal' | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const who = [input.counterpartyName, input.counterparty && `<${input.counterparty}>`]
    .filter(Boolean)
    .join(' ')
  const content = [
    input.direction === 'inbound' ? `From: ${who}` : `Sent by the employee to: ${who}`,
    `Subject: ${input.subject ?? ''}`,
    '',
    input.text.slice(0, MAX_RELEVANCE_CHARS),
  ].join('\n')

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 3,
        temperature: 0,
        messages: [
          { role: 'system', content: RELEVANCE_PROMPT },
          { role: 'user', content },
        ],
      }),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const result = await response.json()
    const answer = String(result?.choices?.[0]?.message?.content ?? '').trim().toLowerCase()
    if (answer.startsWith('business')) return 'business'
    if (answer.startsWith('personal')) return 'personal'
    return null
  } catch {
    return null
  }
}

// ── the filter log ───────────────────────────────────────────────────────
// A dropped message has to be remembered, or every webhook redelivery and
// every overlapping sweep would pay for the AI check again. What is remembered
// is a hash of the message id and the rule that dropped it — never a subject,
// sender or body. See migration 267.

export function messageKey(message: GraphMessage): string {
  const id = message.internetMessageId || message.id
  return createHash('sha256').update(id).digest('hex')
}

export async function wasFiltered(
  supabase: SupabaseClient,
  mailboxUserId: string,
  key: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('outlook_filtered_messages')
    .select('id')
    .eq('mailbox_user_id', mailboxUserId)
    .eq('message_key', key)
    .maybeSingle()
  return !!data
}

export async function recordFiltered(
  supabase: SupabaseClient,
  mailboxUserId: string,
  key: string,
  direction: 'inbound' | 'outbound',
  reason: DropReason,
): Promise<void> {
  const { error } = await supabase
    .from('outlook_filtered_messages')
    .upsert(
      { mailbox_user_id: mailboxUserId, message_key: key, direction, reason },
      { onConflict: 'mailbox_user_id,message_key', ignoreDuplicates: true },
    )
  if (error) console.error('outlook: failed to record filtered message', error.message)
}
