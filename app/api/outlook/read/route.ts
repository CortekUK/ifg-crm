import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/outlook/credentials'
import { refreshThreadUnread } from '@/lib/outlook/ingest'
import { setMessageRead } from '@/lib/outlook/send'

export const runtime = 'nodejs'

/**
 * Mark a conversation read, or unread.
 *
 * Read state lived in three places that never spoke to each other: the thread
 * row's unread_count, the `read` column on each message, and the real Outlook
 * mailbox. Nothing wrote to any of them when a conversation was opened, so a
 * folder badge counted up forever and a message read here stayed bold there.
 *
 * All three are set together here. The two in our database are set before
 * answering, because the screen re-reads them immediately; Outlook is updated
 * afterwards, because it is slower and nothing on screen is waiting for it.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  let body: { threadId?: string; read?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!body.threadId) return NextResponse.json({ error: 'No conversation given.' }, { status: 400 })
  const read = body.read !== false

  const service = getServiceClient()
  if (!service) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const { data: thread } = await service
    .from('email_threads')
    .select('id, conversation_id, mailbox_user_id')
    .eq('id', body.threadId)
    .maybeSingle()

  if (!thread) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })

  const row = thread as { conversation_id: string; mailbox_user_id: string | null }

  // An admin may READ a colleague's CRM-related threads (migration 247), but
  // marking one read would reach into their real mailbox and clear the bold on
  // mail they have not seen. Their mailbox, their read state.
  if (row.mailbox_user_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the mailbox owner can change whether a conversation is read.' },
      { status: 403 },
    )
  }

  // Marking read touches every unread message; marking unread touches only the
  // newest, which is what makes the conversation bold again without claiming
  // the whole history is unread.
  const base = service
    .from('email_replies')
    .select('id, graph_message_id')
    .eq('conversation_id', row.conversation_id)
    .eq('mailbox_user_id', user.id)

  const { data: targets } = read
    ? await base.eq('read', false)
    : await base.order('received_at', { ascending: false }).limit(1)

  const ids = (targets ?? []).map((t) => (t as { id: string }).id)
  if (ids.length) {
    await service.from('email_replies').update({ read }).in('id', ids)
  }
  await refreshThreadUnread(service, user.id, row.conversation_id)

  const graphIds = (targets ?? [])
    .map((t) => (t as { graph_message_id: string | null }).graph_message_id)
    .filter(Boolean) as string[]

  if (graphIds.length) {
    after(async () => {
      for (const graphMessageId of graphIds) {
        try {
          await setMessageRead(service, user.id, graphMessageId, read)
        } catch (err) {
          // Outlook disagreeing for a while is survivable; failing the request
          // the user is waiting on is not. The next sweep brings the two back
          // into line either way.
          console.error('outlook: could not set read state in the mailbox', err)
        }
      }
    })
  }

  return NextResponse.json({ success: true, messages: ids.length })
}
