import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/outlook/credentials'
import { replyToMessage } from '@/lib/outlook/send'
import { OutlookReconnectRequired } from '@/lib/outlook/graph'
import { getBrandingSlots } from '@/lib/templates/branding-server'
import { brandedReplyFragment, composeMergeData, textToParagraphs } from '@/lib/outlook/compose-html'

export const runtime = 'nodejs'

/**
 * Reply inside an existing thread.
 *
 * The caller passes the email_replies row id, not a Graph id — the Graph id is
 * looked up server-side so a client cannot reply to an arbitrary message in
 * someone else's mailbox by guessing an id.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  let body: { replyId?: string; body?: string; replyAll?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!body.replyId) return NextResponse.json({ error: 'No message selected.' }, { status: 400 })
  if (!body.body?.trim()) return NextResponse.json({ error: 'The reply is empty.' }, { status: 400 })

  const service = getServiceClient()
  if (!service) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const { data: reply } = await service
    .from('email_replies')
    .select('id, graph_message_id, mailbox_user_id, source, contact_id')
    .eq('id', body.replyId)
    .maybeSingle()

  if (!reply) return NextResponse.json({ error: 'Message not found.' }, { status: 404 })

  const row = reply as {
    graph_message_id: string | null
    mailbox_user_id: string | null
    source: string
    contact_id: string | null
  }

  // Ownership is checked here, server-side, and not inferred from RLS: this
  // route runs under the service role precisely so it can read the Graph id,
  // and the service role bypasses RLS. Without this check an admin — or anyone
  // who guessed a reply id — could send mail from a colleague's mailbox.
  if (row.mailbox_user_id !== user.id) {
    return NextResponse.json(
      { error: 'You can only reply from your own mailbox.' },
      { status: 403 },
    )
  }

  if (row.source !== 'outlook' || !row.graph_message_id) {
    return NextResponse.json(
      { error: 'This message did not arrive through Outlook, so it cannot be replied to here.' },
      { status: 400 },
    )
  }

  try {
    // A fragment, not a document: Graph builds the reply itself and puts the
    // quoted history underneath, so a full <html> document would nest one
    // inside another. Signature and legal strip, no masthead — a masthead
    // repeated on every message of a back-and-forth is what makes a real
    // conversation look automated.
    const [slots, mergeData] = await Promise.all([
      getBrandingSlots(),
      composeMergeData(service, user.id, row.contact_id, request.nextUrl.origin),
    ])
    const html = brandedReplyFragment(textToParagraphs(body.body), slots, mergeData)

    const result = await replyToMessage(service, user.id, {
      graphMessageId: row.graph_message_id,
      body: html,
      replyAll: body.replyAll,
    })

    // Mark the original replied so the inbox reflects it immediately.
    await service.from('email_replies').update({ replied: true }).eq('id', body.replyId)

    return NextResponse.json({ success: true, conversationId: result.conversationId })
  } catch (err) {
    if (err instanceof OutlookReconnectRequired) {
      return NextResponse.json(
        { error: 'Your Outlook connection needs reconnecting.', reconnect: true },
        { status: 409 },
      )
    }
    console.error('outlook reply failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not send the reply.' },
      { status: 502 },
    )
  }
}
