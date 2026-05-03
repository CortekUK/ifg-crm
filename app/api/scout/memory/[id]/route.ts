// PATCH /api/scout/memory/[id] → update content
// DELETE /api/scout/memory/[id] → remove a memory
//
// RLS guarantees the row belongs to the caller; the explicit user_id filter is
// belt-and-braces.

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
    return new Response(JSON.stringify({ error: guard.error }), { status: guard.status })
  }
  let body: { content?: string } = {}
  try { body = await req.json() } catch { /* empty body */ }
  const content = (body.content ?? '').trim()
  if (!content) {
    return new Response(JSON.stringify({ error: 'content required' }), { status: 400 })
  }
  if (content.length > 2000) {
    return new Response(JSON.stringify({ error: 'content too long (max 2000)' }), { status: 400 })
  }
  const { data, error } = await guard.supabase
    .from('scout_memories')
    .update({ content, source: 'manual' })
    .eq('id', id)
    .eq('user_id', guard.userId)
    .select('id, content, source, created_at, updated_at')
    .single()
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
  return Response.json({ memory: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guard = await requireSuperAdmin()
  if ('error' in guard) {
    return new Response(JSON.stringify({ error: guard.error }), { status: guard.status })
  }
  const { error } = await guard.supabase
    .from('scout_memories')
    .delete()
    .eq('id', id)
    .eq('user_id', guard.userId)
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
  return Response.json({ ok: true })
}
