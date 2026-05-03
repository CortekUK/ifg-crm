// Scout memory list / create / wipe.
//
// GET    /api/scout/memory          → list this super_admin's memories (newest first)
// POST   /api/scout/memory          → create a manual entry  { content }
// DELETE /api/scout/memory          → wipe ALL of this super_admin's memories
//
// Per-user isolation: every query is `user_id = auth.uid()` (RLS enforces this
// even via the user-scoped client). super_admin gate up front.

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

export async function GET() {
  const guard = await requireSuperAdmin()
  if ('error' in guard) {
    return new Response(JSON.stringify({ error: guard.error }), { status: guard.status })
  }
  const { data, error } = await guard.supabase
    .from('scout_memories')
    .select('id, content, source, created_at, updated_at')
    .eq('user_id', guard.userId)
    .order('created_at', { ascending: false })
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
  return Response.json({ memories: data ?? [] })
}

export async function POST(req: NextRequest) {
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
    .insert({ user_id: guard.userId, content, source: 'manual' })
    .select('id, content, source, created_at, updated_at')
    .single()
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
  return Response.json({ memory: data })
}

// Wipe every memory belonging to the caller. Returns the row count for
// optimistic UI feedback. RLS + the explicit user_id filter keep this
// strictly scoped — no risk of nuking another super_admin's memory pool.
export async function DELETE() {
  const guard = await requireSuperAdmin()
  if ('error' in guard) {
    return new Response(JSON.stringify({ error: guard.error }), { status: guard.status })
  }
  const { error, count } = await guard.supabase
    .from('scout_memories')
    .delete({ count: 'exact' })
    .eq('user_id', guard.userId)
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
  return Response.json({ ok: true, deleted: count ?? 0 })
}
