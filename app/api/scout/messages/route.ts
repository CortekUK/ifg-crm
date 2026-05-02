// Load all messages for a conversation. The widget calls this when the user
// opens an existing thread from the history list.
// GET /api/scout/messages?conversation_id=...

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
