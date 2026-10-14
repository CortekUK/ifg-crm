import type { SupabaseClient } from '@supabase/supabase-js'
import { graphFetch } from './graph'
import { getCredentials } from './credentials'
import { ingestMessage } from './ingest'
import { MESSAGE_SELECT, type GraphMessage } from './types'

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
  subject: string,
  attempts = 4,
): Promise<GraphMessage | null> {
  for (let i = 0; i < attempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)))
    try {
      const page = await graphFetch<{ value?: GraphMessage[] }>(
        supabase,
        userId,
        `/me/mailFolders('sentitems')/messages?$top=5&$orderby=sentDateTime desc&$select=${MESSAGE_SELECT}`,
      )
      const match = (page.value ?? []).find((m) => (m.subject ?? '') === subject)
      if (match) return match
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
  subject: string,
): Promise<SendResult> {
  const sent = await findSentMessage(supabase, userId, subject)
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

/** A brand-new message (Compose). */
export async function sendNewMessage(
  supabase: SupabaseClient,
  userId: string,
  input: { to: string; subject: string; body: string; cc?: string[] },
): Promise<SendResult> {
  const credentials = await getCredentials(supabase, userId)
  if (!credentials?.mailbox_email) throw new Error('No Outlook mailbox is connected.')

  await graphFetch(supabase, userId, '/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: htmlBody(input.body),
        toRecipients: [{ emailAddress: { address: input.to } }],
        ccRecipients: (input.cc ?? []).map((address) => ({ emailAddress: { address } })),
      },
      // Microsoft files it in Sent Items for us. The spec notes this needs no
      // extra work, and turning it off would leave the recruiter's own Outlook
      // with no record of what the CRM sent on their behalf.
      saveToSentItems: true,
    }),
  })

  return mirrorSentMessage(supabase, userId, credentials.mailbox_email, input.subject)
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

  // Read the original first: we need its subject to find our reply in Sent
  // Items afterwards, and failing here (message deleted, wrong mailbox) gives
  // a clear error instead of a silent no-op.
  const original = await graphFetch<GraphMessage>(
    supabase,
    userId,
    `/me/messages/${input.graphMessageId}?$select=id,subject,conversationId`,
  )

  const action = input.replyAll ? 'replyAll' : 'reply'
  await graphFetch(supabase, userId, `/me/messages/${input.graphMessageId}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ comment: input.body }),
  })

  const subject = original.subject ?? ''
  const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `RE: ${subject}`

  // Graph may title the reply either way depending on the original, so try the
  // prefixed form and fall back to the original subject.
  const result = await mirrorSentMessage(supabase, userId, credentials.mailbox_email, replySubject)
  if (result.graphMessageId) return result
  return mirrorSentMessage(supabase, userId, credentials.mailbox_email, subject)
}

/** Mark a message read in the real mailbox, so the two stay in step. */
export async function markMessageRead(
  supabase: SupabaseClient,
  userId: string,
  graphMessageId: string,
): Promise<void> {
  await graphFetch(supabase, userId, `/me/messages/${graphMessageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isRead: true }),
  })
}
