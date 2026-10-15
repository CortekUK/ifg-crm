import type { SupabaseClient } from '@supabase/supabase-js'
import { graphFetch } from './graph'
import { getCredentials } from './credentials'
import { ingestMessage } from './ingest'
import { addressOf, MESSAGE_SELECT, type GraphMessage } from './types'

/**
 * Sending from a connected mailbox.
 *
 * Mail goes out through Microsoft as the user, so it lands in their real Sent
 * Items with no extra work. We mirror it into email_sends afterwards so the
 * CRM can render a thread without calling Graph on every paint.
 */

export interface SendResult {
  graphMessageId: string | null
  internetMessageId: string | null
  conversationId: string | null
}

function htmlBody(content: string) {
  return { contentType: 'HTML', content }
}

/**
 * How to recognise the message we just sent, once it reaches Sent Items.
 *
 * Subject alone is not enough, which is what this used to use. A recruiter
 * emailing nine players about the same programme produces nine messages with
 * identical subjects, and the newest-five scan would mirror whichever landed
 * first — attaching one player's message to another player's thread.
 */
interface SentMatch {
  /** When we asked Graph to send. Anything older is a different message. */
  since: number
  subject?: string
  /** Exact, for replies: Graph puts the reply in the original conversation. */
  conversationId?: string
  /** Lowercased recipient address, for new messages. */
  recipient?: string
}

/**
 * Wait for a message to appear in Sent Items and return it.
 *
 * Graph's sendMail and reply actions answer 202 Accepted with NO body — they
 * tell us nothing about the message they just created. The ids we need for
 * threading only exist once it lands in Sent Items, which takes a moment, so
 * we poll briefly.
 *
 * Returning null is not a failure: the message HAS been sent. It only means
 * we could not capture the ids in time, and the delta sweep will pick the
 * message up and record it within the hour.
 */
async function findSentMessage(
  supabase: SupabaseClient,
  userId: string,
  match: SentMatch,
  attempts = 4,
): Promise<GraphMessage | null> {
  for (let i = 0; i < attempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)))
    try {
      const page = await graphFetch<{ value?: GraphMessage[] }>(
        supabase,
        userId,
        `/me/mailFolders('sentitems')/messages?$top=10&$orderby=sentDateTime desc&$select=${MESSAGE_SELECT}`,
      )
      const found = (page.value ?? []).find((m) => {
        // A minute of slack: Graph's clock is not ours, and a message stamped
        // a few seconds before our call is still ours.
        const sentAt = m.sentDateTime ? new Date(m.sentDateTime).getTime() : 0
        if (sentAt && sentAt < match.since - 60_000) return false
        if (match.conversationId && m.conversationId !== match.conversationId) return false
        if (
          match.recipient &&
          !(m.toRecipients ?? []).some((r) => addressOf(r) === match.recipient)
        ) {
          return false
        }
        if (match.subject && (m.subject ?? '') !== match.subject) return false
        return true
      })
      if (found) return found
    } catch {
      // Transient — keep trying until the attempts run out.
    }
  }
  return null
}

async function mirrorSentMessage(
  supabase: SupabaseClient,
  userId: string,
  mailboxEmail: string,
  match: SentMatch,
): Promise<SendResult> {
  const sent = await findSentMessage(supabase, userId, match)
  if (!sent) return { graphMessageId: null, internetMessageId: null, conversationId: null }

  // Reuse the ingest path rather than writing email_sends here, so a message
  // recorded at send time and the same message seen later by the sweep produce
  // an identical row — and the unique index on internet_message_id makes the
  // second one a no-op instead of a duplicate.
  await ingestMessage(supabase, { userId, mailboxEmail }, sent)

  return {
    graphMessageId: sent.id,
    internetMessageId: sent.internetMessageId ?? null,
    conversationId: sent.conversationId ?? null,
  }
}

/**
 * A file travelling with the message.
 *
 * `contentBytes` is base64. Graph accepts attachments inline on sendMail only
 * while the WHOLE message stays under about 4MB — see ATTACHMENT_LIMIT_BYTES
 * in the send route for where that is enforced and why. Anything larger needs
 * a draft and an upload session, which is a bigger build and has not been
 * needed: the thing people want to send that is genuinely large is a
 * brochure, and a brochure goes as a link.
 */
export interface OutgoingAttachment {
  name: string
  contentType: string
  contentBytes: string
}

function graphAttachments(attachments: OutgoingAttachment[] | undefined) {
  return (attachments ?? []).map((a) => ({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: a.name,
    contentType: a.contentType,
    contentBytes: a.contentBytes,
  }))
}

/** A brand-new message (Compose). */
export async function sendNewMessage(
  supabase: SupabaseClient,
  userId: string,
  input: {
    to: string
    subject: string
    body: string
    cc?: string[]
    attachments?: OutgoingAttachment[]
  },
): Promise<SendResult> {
  const credentials = await getCredentials(supabase, userId)
  if (!credentials?.mailbox_email) throw new Error('No Outlook mailbox is connected.')

  const since = Date.now()
  await graphFetch(supabase, userId, '/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: htmlBody(input.body),
        toRecipients: [{ emailAddress: { address: input.to } }],
        ccRecipients: (input.cc ?? []).map((address) => ({ emailAddress: { address } })),
        ...(input.attachments?.length && { attachments: graphAttachments(input.attachments) }),
      },
      // Microsoft files it in Sent Items for us. The spec notes this needs no
      // extra work, and turning it off would leave the recruiter's own Outlook
      // with no record of what the CRM sent on their behalf.
      saveToSentItems: true,
    }),
  })

  return mirrorSentMessage(supabase, userId, credentials.mailbox_email, {
    since,
    subject: input.subject,
    recipient: input.to.trim().toLowerCase(),
  })
}

/**
 * Reply within an existing thread.
 *
 * THIS USES GRAPH'S REPLY ACTION, NOT A NEW MESSAGE, and that distinction is
 * the whole point. The spec calls getting it wrong "the most common mistake in
 * this kind of feature": a fresh message does not carry the In-Reply-To and
 * References headers, so the recipient's mail client shows it as an unrelated
 * message rather than part of the conversation. It looks broken to the person
 * receiving it, and it is invisible from our side.
 *
 * /me/messages/{id}/reply has Microsoft build the reply from the original, so
 * the threading headers, subject prefix and quoted history are all correct.
 */
export async function replyToMessage(
  supabase: SupabaseClient,
  userId: string,
  input: { graphMessageId: string; body: string; replyAll?: boolean },
): Promise<SendResult> {
  const credentials = await getCredentials(supabase, userId)
  if (!credentials?.mailbox_email) throw new Error('No Outlook mailbox is connected.')

  // Read the original first: we need its conversation to find our own reply in
  // Sent Items afterwards, and failing here (message deleted, wrong mailbox)
  // gives a clear error instead of a silent no-op.
  const original = await graphFetch<GraphMessage>(
    supabase,
    userId,
    `/me/messages/${input.graphMessageId}?$select=id,subject,conversationId`,
  )

  const since = Date.now()
  const action = input.replyAll ? 'replyAll' : 'reply'
  await graphFetch(supabase, userId, `/me/messages/${input.graphMessageId}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ comment: input.body }),
  })

  // Matched on the conversation, not the subject. Graph decides for itself
  // whether to prefix "RE:", so this used to guess the subject twice — and the
  // second guess, the bare original subject, could match the message being
  // replied TO rather than the reply.
  return mirrorSentMessage(supabase, userId, credentials.mailbox_email, {
    since,
    conversationId: original.conversationId ?? undefined,
  })
}

/**
 * Set a message's read state in the real mailbox, so the two stay in step.
 *
 * Both directions, because the CRM offers both: reading a conversation here
 * should clear the bold in Outlook, and marking it unread here should put it
 * back. Pushing only one way leaves the two mailboxes disagreeing, and the one
 * people trust is Outlook.
 */
export async function setMessageRead(
  supabase: SupabaseClient,
  userId: string,
  graphMessageId: string,
  isRead: boolean,
): Promise<void> {
  await graphFetch(supabase, userId, `/me/messages/${graphMessageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isRead }),
  })
}
