// Load all messages for a conversation, or truncate the conversation from a
// given message onwards.
//
// GET    /api/scout/messages?conversation_id=...
// DELETE /api/scout/messages?conversation_id=...&from_id=...
//   Removes the message with id=from_id and every later message in the
//   conversation. Used by the chat UI's edit/retry actions so the persisted
//   history stays in sync with the local state after a branch.

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'super_admin') {
    return Response.json({ error: 'Scout is for super_admin users only.' }, { status: 403 })
  }

  const conversationId = req.nextUrl.searchParams.get('conversation_id')
  if (!conversationId) {
    return Response.json({ error: 'conversation_id required' }, { status: 400 })
  }

  // RLS already restricts to the owner; the explicit user_id check on the
  // conversation row is a second guard against id-guessing.
  const { data: conv } = await supabase
    .from('scout_conversations')
    .select('id, user_id')
    .eq('id', conversationId)
    .single()
  if (!conv || conv.user_id !== profile.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: messages, error } = await supabase
    .from('scout_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ messages: messages ?? [] })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const conversationId = req.nextUrl.searchParams.get('conversation_id')
  const fromId = req.nextUrl.searchParams.get('from_id')
  if (!conversationId || !fromId) {
    return Response.json(
      { error: 'conversation_id and from_id required' },
      { status: 400 },
    )
  }

  // Confirm caller owns the conversation (RLS would block otherwise but the
  // 404 keeps existence-checks honest).
  const { data: conv } = await supabase
    .from('scout_conversations')
    .select('id, user_id')
    .eq('id', conversationId)
    .single()
  if (!conv || conv.user_id !== profile.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Find the pivot message to anchor the truncation by created_at — deleting
  // the pivot row itself plus everything created at-or-after it.
  const { data: pivot } = await supabase
    .from('scout_messages')
    .select('id, created_at, conversation_id')
    .eq('id', fromId)
    .single()
  if (!pivot || pivot.conversation_id !== conversationId) {
    return Response.json({ error: 'Pivot message not in conversation' }, { status: 400 })
  }

  const { error: delErr, count } = await supabase
    .from('scout_messages')
    .delete({ count: 'exact' })
    .eq('conversation_id', conversationId)
    .gte('created_at', pivot.created_at)
  if (delErr) return Response.json({ error: delErr.message }, { status: 500 })

  return Response.json({ ok: true, deleted: count ?? 0 })
}
