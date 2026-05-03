// PATCH /api/scout/conversations/[id]  → { title?, starred? }
//
// Lets the user rename or pin/unpin a chat. RLS already scopes to the caller;
// the explicit user_id filter is belt-and-braces.

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', status: 401 as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'super_admin') {
    return { error: 'Forbidden', status: 403 as const }
  }
  return { supabase, userId: profile.id }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guard = await requireSuperAdmin()
  if ('error' in guard) {
    return Response.json({ error: guard.error }, { status: guard.status })
  }

  let body: { title?: string; starred?: boolean } = {}
  try { body = await req.json() } catch { /* empty body */ }

  const update: Record<string, unknown> = {}
  if (typeof body.title === 'string') {
    const t = body.title.trim()
    if (!t) return Response.json({ error: 'title cannot be empty' }, { status: 400 })
    if (t.length > 200) return Response.json({ error: 'title too long' }, { status: 400 })
    update.title = t
  }
  if (typeof body.starred === 'boolean') {
    update.starred = body.starred
  }
  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'nothing to update' }, { status: 400 })
  }

  const { data, error } = await guard.supabase
    .from('scout_conversations')
    .update(update)
    .eq('id', id)
    .eq('user_id', guard.userId)
    .select('id, title, starred, created_at, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ conversation: data })
}
