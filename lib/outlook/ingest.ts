import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyIntent, detectAutoReply, stripHtml, truncateText } from '@/lib/email/classify'
import { trimQuotedContent } from '@/lib/utils/trimQuotedContent'
import { addressOf, headersToRecord, nameOf, type GraphMessage } from './types'
import { classifySender, threadCategory, type SenderKind } from './classify-sender'

/**
 * Turn a Microsoft Graph message into CRM rows.
 *
 * THE RULE THIS FILE EXISTS TO HONOUR: inbound Outlook mail lands in the SAME
 * `email_replies` table, with the same column shape, as mail arriving through
 * Resend. The spec names building a second, parallel path as the main way this
 * feature goes wrong, and in this codebase it would be worse than untidy —
 * everything that must keep working is implemented as DATABASE TRIGGERS on
 * email_replies:
 *
 *   - stop_enrollments_on_reply_match  (206/222) stops the follow-up sequence
 *   - the enrolment-exit trigger       (089/183) moves the deal, forward only
 *   - reply_carries_intent             (229) decides a real reply from an
 *                                      autoresponder or an unreadable one
 *   - the unsubscribe trigger          (230) takes the contact off email
 *
 * None of that lives in application code, so a correctly shaped INSERT from
 * here inherits all of it for free — and a differently shaped one silently
 * loses all of it. That is why the fields below mirror resend-inbound exactly,
 * including classifying intent BEFORE the insert rather than patching it in
 * afterwards (the ordering bug that moved deals for out-of-office replies).
 */

export interface IngestResult {
  status: 'inserted' | 'duplicate' | 'skipped'
  replyId?: string
  sendId?: string
  reason?: string
}

interface MailboxContext {
  userId: string
  mailboxEmail: string
}

/** Everything the thread row needs, derived once per message. */
interface Attribution {
  contactId: string | null
  contactName: string | null
  dealId: string | null
  pipelineId: string | null
  /** Player / parent / secondary / internal / external / unknown. */
  senderKind: SenderKind
}

async function attributeToContact(
  supabase: SupabaseClient,
  counterpartyEmail: string | null,
): Promise<Attribution> {
  const empty: Attribution = { contactId: null, contactName: null, dealId: null, pipelineId: null, senderKind: 'unknown' }
  if (!counterpartyEmail) return empty

  // Resolved through resolve_contact_by_email, which checks the contact's own
  // address, the parent/guardian address, AND any address connected by hand in
  // the mailbox. Matching on contacts.email alone meant a player writing from
  // a second account arrived Unmatched every single time, even after somebody
  // had already connected that address once.
  const identity = await classifySender(supabase, counterpartyEmail)
  if (!identity.contactId) return { ...empty, senderKind: identity.kind }

  const contactId = identity.contactId
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .eq('id', contactId)
    .maybeSingle()
  if (!contact) return { ...empty, senderKind: identity.kind }
  const first = (contact as { first_name: string | null }).first_name ?? ''
  const last = (contact as { last_name: string | null }).last_name ?? ''

  // The contact's live deal gives the reply a pipeline, which is what the
  // Replies screen filters on and what the stage-move trigger needs. Newest
  // active deal wins, matching the resend-inbound fallback.
  const { data: deal } = await supabase
    .from('deals')
    .select('id, pipeline_id')
    .eq('contact_id', contactId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    contactId,
    contactName: `${first} ${last}`.trim() || null,
    dealId: (deal as { id: string } | null)?.id ?? null,
    pipelineId: (deal as { pipeline_id: string } | null)?.pipeline_id ?? null,
    senderKind: identity.kind,
  }
}

/**
 * Link an Outlook reply back to the email it answers.
 *
 * Outlook mail carries no tracking id — that is a Resend construct — so the
 * join is by conversation. Without this an Outlook reply arrives with no
 * email_send_id, and anything keyed off the originating send (campaign and
 * pipeline attribution on the Replies screen) comes back blank.
 */
async function resolveLinkedSend(
  supabase: SupabaseClient,
  conversationId: string | null,
  mailboxUserId: string,
): Promise<{ sendId: string | null; campaignId: string | null; pipelineId: string | null }> {
  if (!conversationId) return { sendId: null, campaignId: null, pipelineId: null }

  const { data } = await supabase
    .from('email_sends')
    .select('id, campaign_id')
    .eq('conversation_id', conversationId)
    .eq('mailbox_user_id', mailboxUserId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return { sendId: null, campaignId: null, pipelineId: null }
  return {
    sendId: (data as { id: string }).id,
    campaignId: (data as { campaign_id: string | null }).campaign_id,
    pipelineId: null,
  }
}

function bodyOf(message: GraphMessage): { text: string; html: string | null } {
  const content = message.body?.content ?? ''
  const isHtml = (message.body?.contentType ?? '').toLowerCase() === 'html'
  if (isHtml) {
    const text = stripHtml(content)
    // QA-28 "watch for": an HTML-only message must not arrive with an empty
    // body. bodyPreview is Graph's own plain-text summary and is the backstop.
    return { text: text || (message.bodyPreview ?? ''), html: content || null }
  }
  return { text: content || (message.bodyPreview ?? ''), html: null }
}

/**
 * Ingest one message.
 *
 * Idempotent by internetMessageId (unique partial index, migration 245).
 * It has to be: Graph redelivers change notifications, and the catch-up sweep
 * deliberately re-reads an overlapping window, so without this every missed
 * notification would become a duplicate in the inbox.
 */
export async function ingestMessage(
  supabase: SupabaseClient,
  mailbox: MailboxContext,
  message: GraphMessage,
): Promise<IngestResult> {
  // Drafts are not mail. Ingesting them shows half-typed messages in the CRM.
  if (message.isDraft) return { status: 'skipped', reason: 'draft' }

  const internetMessageId = message.internetMessageId ?? null
  const fromEmail = addressOf(message.from) ?? addressOf(message.sender)
  const fromName = nameOf(message.from) ?? nameOf(message.sender)
  const conversationId = message.conversationId ?? null

  // Direction is decided by the sender, not by which folder the message was
  // found in. A message can appear in both (Graph puts a sent message in Sent
  // Items, and conversation threading can surface it elsewhere), and getting
  // this wrong would file the recruiter's own words as a player's reply —
  // which would stop their sequence and move their deal.
  const isOutbound = !!fromEmail && fromEmail === mailbox.mailboxEmail.toLowerCase()

  const recipients = (message.toRecipients ?? []).map(addressOf).filter(Boolean) as string[]
  const counterpartyEmail = isOutbound ? recipients[0] ?? null : fromEmail
  const counterpartyName = isOutbound ? nameOf(message.toRecipients?.[0]) : fromName

  const attribution = await attributeToContact(supabase, counterpartyEmail)
  const { text, html } = bodyOf(message)
  const occurredAt =
    message.receivedDateTime || message.sentDateTime || new Date().toISOString()

  if (isOutbound) {
    const result = await recordOutbound(supabase, mailbox, message, {
      internetMessageId,
      conversationId,
      recipientEmail: counterpartyEmail,
      attribution,
      text,
      html,
      sentAt: occurredAt,
    })
    await upsertThread(supabase, mailbox, {
      conversationId,
      subject: message.subject ?? null,
      lastAt: occurredAt,
      preview: truncateText(trimQuotedContent(text), 300),
      from: fromEmail,
      direction: 'outbound',
      attribution,
      counterpartyEmail,
      counterpartyName,
      unread: false,
      senderKind: attribution.senderKind,
      participantEmail: counterpartyEmail,
      participantName: counterpartyName,
    })
    return result
  }

  return ingestInbound(supabase, mailbox, message, {
    internetMessageId,
    conversationId,
    fromEmail,
    fromName,
    counterpartyName,
    attribution,
    text,
    html,
    receivedAt: occurredAt,
  })
}

async function ingestInbound(
  supabase: SupabaseClient,
  mailbox: MailboxContext,
  message: GraphMessage,
  ctx: {
    internetMessageId: string | null
    conversationId: string | null
    fromEmail: string | null
    fromName: string | null
    counterpartyName: string | null
    attribution: Attribution
    text: string
    html: string | null
    receivedAt: string
  },
): Promise<IngestResult> {
  if (!ctx.fromEmail) return { status: 'skipped', reason: 'no sender address' }

  // Cheap dedupe before any OpenAI call, so a redelivered notification costs
  // nothing. The unique index is still the real guarantee against a race.
  if (ctx.internetMessageId) {
    const { data: existing } = await supabase
      .from('email_replies')
      .select('id, read')
      .eq('internet_message_id', ctx.internetMessageId)
      .maybeSingle()
    if (existing) {
      const row = existing as { id: string; read: boolean | null }
      // Seen before, but Graph may be telling us it has since been opened — or
      // marked unread — in Outlook itself. Read state was written once at
      // insert and never revisited, so a message read on someone's phone stayed
      // bold in the CRM for good.
      const isRead = message.isRead ?? false
      if (isRead !== (row.read ?? false)) {
        await supabase.from('email_replies').update({ read: isRead }).eq('id', row.id)
        await refreshThreadUnread(supabase, mailbox.userId, ctx.conversationId)
      }
      return { status: 'duplicate', replyId: row.id }
    }
  }

  const linked = await resolveLinkedSend(supabase, ctx.conversationId, mailbox.userId)

  // Classify BEFORE the insert. The insert fires the stop trigger, which reads
  // ai_intent and is_auto_reply to decide whether to stop the sequence and
  // move the deal. Patching intent in afterwards (the original resend-inbound
  // bug) meant that decision always saw NULL, so every reply moved the deal —
  // including out-of-office replies. Quoted history is stripped first, or a
  // one-word reply is buried under our own outreach and classifies as unknown.
  const aiIntent = await classifyIntent(trimQuotedContent(ctx.text))
  const isAutoReply = detectAutoReply(headersToRecord(message.internetMessageHeaders), message.subject)

  const matchStatus = ctx.attribution.contactId ? 'auto_matched' : 'unmatched'

  const { data: inserted, error } = await supabase
    .from('email_replies')
    .insert({
      contact_id: ctx.attribution.contactId,
      deal_id: ctx.attribution.dealId,
      email_send_id: linked.sendId,
      campaign_id: linked.campaignId,
      pipeline_id: ctx.attribution.pipelineId,
      from_email: ctx.fromEmail,
      from_name: ctx.fromName,
      subject: message.subject ?? null,
      body_preview: truncateText(ctx.text, 500),
      body: ctx.text || null,
      html_body: ctx.html,
      message_id: ctx.internetMessageId,
      internet_message_id: ctx.internetMessageId,
      graph_message_id: message.id,
      conversation_id: ctx.conversationId,
      mailbox_user_id: mailbox.userId,
      source: 'outlook',
      received_at: ctx.receivedAt,
      match_status: matchStatus,
      sender_kind: ctx.attribution.senderKind,
      ai_intent: aiIntent || null,
      is_auto_reply: isAutoReply,
      read: message.isRead ?? false,
      processed: false,
    })
    .select('id')
    .single()

  if (error) {
    // 23505 = unique violation: a concurrent delivery won the race. That is a
    // successful dedupe, not a failure.
    if ((error as { code?: string }).code === '23505') return { status: 'duplicate' }
    console.error('outlook: failed to insert reply', error.message)
    return { status: 'skipped', reason: error.message }
  }

  await upsertThread(supabase, mailbox, {
    conversationId: ctx.conversationId,
    subject: message.subject ?? null,
    lastAt: ctx.receivedAt,
    preview: truncateText(trimQuotedContent(ctx.text), 300),
    from: ctx.fromEmail,
    direction: 'inbound',
    attribution: ctx.attribution,
    counterpartyEmail: ctx.fromEmail,
    counterpartyName: ctx.counterpartyName,
    unread: !(message.isRead ?? false),
    senderKind: ctx.attribution.senderKind,
    intent: aiIntent || null,
    participantEmail: ctx.fromEmail,
    participantName: ctx.counterpartyName,
  })

  return { status: 'inserted', replyId: (inserted as { id: string }).id }
}

async function recordOutbound(
  supabase: SupabaseClient,
  mailbox: MailboxContext,
  message: GraphMessage,
  ctx: {
    internetMessageId: string | null
    conversationId: string | null
    recipientEmail: string | null
    attribution: Attribution
    text: string
    html: string | null
    sentAt: string
  },
): Promise<IngestResult> {
  if (!ctx.recipientEmail) return { status: 'skipped', reason: 'no recipient' }

  if (ctx.internetMessageId) {
    const { data: existing } = await supabase
      .from('email_sends')
      .select('id')
      .eq('internet_message_id', ctx.internetMessageId)
      .maybeSingle()
    if (existing) return { status: 'duplicate', sendId: (existing as { id: string }).id }
  }

  const { data: inserted, error } = await supabase
    .from('email_sends')
    .insert({
      recipient_email: ctx.recipientEmail,
      recipient_contact_id: ctx.attribution.contactId,
      subject: message.subject ?? '(no subject)',
      body_html: ctx.html,
      body_text: ctx.text || null,
      status: 'sent',
      sent_at: ctx.sentAt,
      mailbox_user_id: mailbox.userId,
      conversation_id: ctx.conversationId,
      internet_message_id: ctx.internetMessageId,
      graph_message_id: message.id,
      from_email: mailbox.mailboxEmail,
      source: 'outlook',
    })
    .select('id')
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') return { status: 'duplicate' }
    console.error('outlook: failed to record sent message', error.message)
    return { status: 'skipped', reason: error.message }
  }

  return { status: 'inserted', sendId: (inserted as { id: string }).id }
}

/**
 * Recount a thread's unread messages from the messages themselves.
 *
 * upsertThread keeps a running total as mail arrives, which is right for the
 * common path and wrong the moment anything else changes a message's read
 * state — opening the conversation in the CRM, or reading it in Outlook. A
 * derived counter that is only ever incremented is a counter that only ever
 * goes up, which is exactly how every folder badge came to be permanently lit.
 *
 * Counting is cheap (one indexed count per conversation) and self-correcting:
 * whatever the running total has drifted to, this puts it back.
 */
export async function refreshThreadUnread(
  supabase: SupabaseClient,
  mailboxUserId: string,
  conversationId: string | null,
): Promise<void> {
  if (!conversationId) return
  const { count } = await supabase
    .from('email_replies')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('mailbox_user_id', mailboxUserId)
    .eq('read', false)
  await supabase
    .from('email_threads')
    .update({ unread_count: count ?? 0 })
    .eq('conversation_id', conversationId)
    .eq('mailbox_user_id', mailboxUserId)
}

/**
 * Keep the conversation row current.
 *
 * The thread table is what the mailbox screen pages over — see migration 247
 * for why aggregating messages instead would walk straight into the 1,000-row
 * ceiling.
 */
async function upsertThread(
  supabase: SupabaseClient,
  mailbox: MailboxContext,
  ctx: {
    conversationId: string | null
    subject: string | null
    lastAt: string
    preview: string
    from: string | null
    direction: 'inbound' | 'outbound'
    attribution: Attribution
    counterpartyEmail: string | null
    counterpartyName: string | null
    unread: boolean
    senderKind: SenderKind
    intent?: string | null
    participantEmail?: string | null
    participantName?: string | null
  },
): Promise<void> {
  // No conversation id means nothing stable to group on. The message is still
  // stored and still searchable; it just does not get a thread row.
  if (!ctx.conversationId) return

  const { data: existing } = await supabase
    .from('email_threads')
    .select('id, last_message_at, unread_count, message_count')
    .eq('conversation_id', ctx.conversationId)
    .eq('mailbox_user_id', mailbox.userId)
    .maybeSingle()

  const isCrmRelated = !!ctx.attribution.contactId

  if (!existing) {
    await supabase.from('email_threads').insert({
      conversation_id: ctx.conversationId,
      mailbox_user_id: mailbox.userId,
      subject: ctx.subject,
      last_message_at: ctx.lastAt,
      last_message_preview: ctx.preview,
      last_message_from: ctx.from,
      last_message_direction: ctx.direction,
      unread_count: ctx.unread ? 1 : 0,
      message_count: 1,
      contact_id: ctx.attribution.contactId,
      deal_id: ctx.attribution.dealId,
      pipeline_id: ctx.attribution.pipelineId,
      counterparty_email: ctx.counterpartyEmail,
      counterparty_name: ctx.counterpartyName,
      is_crm_related: isCrmRelated,
      category: threadCategory([ctx.senderKind]),
      latest_intent: ctx.intent ?? null,
      participants: ctx.participantEmail
        ? [{ email: ctx.participantEmail, name: ctx.participantName ?? null }]
        : [],
      source: 'outlook',
    })
    return
  }

  const row = existing as {
    id: string
    last_message_at: string | null
    unread_count: number
    message_count: number
  }

  // Only let a NEWER message overwrite the thread summary. The catch-up sweep
  // replays history out of order, and without this an old message would
  // rewrite the preview and timestamp, jumbling the inbox ordering.
  const isNewer = !row.last_message_at || new Date(ctx.lastAt) >= new Date(row.last_message_at)

  await supabase
    .from('email_threads')
    .update({
      ...(isNewer
        ? {
            subject: ctx.subject,
            last_message_at: ctx.lastAt,
            last_message_preview: ctx.preview,
            last_message_from: ctx.from,
            last_message_direction: ctx.direction,
          }
        : {}),
      unread_count: row.unread_count + (ctx.unread ? 1 : 0),
      message_count: row.message_count + 1,
      // Only ever widen attribution. A thread that has been matched to a
      // contact must not fall back to unmatched because a later message in it
      // came from an address we do not hold.
      ...(ctx.attribution.contactId ? { contact_id: ctx.attribution.contactId } : {}),
      ...(ctx.attribution.dealId ? { deal_id: ctx.attribution.dealId } : {}),
      ...(ctx.attribution.pipelineId ? { pipeline_id: ctx.attribution.pipelineId } : {}),
      ...(isCrmRelated ? { is_crm_related: true } : {}),
      // Only ever widen the category, for the same reason attribution only
      // widens: a thread that has been matched must not fall back to Unmatched
      // because a later message in it came from an address we do not hold.
      ...(ctx.senderKind !== 'unknown' ? { category: threadCategory([ctx.senderKind]) } : {}),
      ...(isNewer && ctx.intent ? { latest_intent: ctx.intent } : {}),
    })
    .eq('id', row.id)
}
