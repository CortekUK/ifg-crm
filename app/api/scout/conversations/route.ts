// List + delete Scout conversations for the current super_admin user.
// GET    /api/scout/conversations         -> [{ id, title, updated_at }]
// DELETE /api/scout/conversations?id=...   -> { ok: true }

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', status: 401 as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'super_admin') {
    return { error: 'Scout is for super_admin users only.', status: 403 as const }
  }
  return { supabase, profile }
}

export async function GET() {
  const ctx = await getSuperAdmin()
  if ('error' in ctx) {
    return Response.json({ error: ctx.error }, { status: ctx.status })
  }
  const { supabase, profile } = ctx

  const { data, error } = await supabase
    .from('scout_conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', profile.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ conversations: data ?? [] })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getSuperAdmin()
  if ('error' in ctx) {
    return Response.json({ error: ctx.error }, { status: ctx.status })
  }
  const { supabase, profile } = ctx

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return Response.json({ error: 'id query param required' }, { status: 400 })

  const { error } = await supabase
    .from('scout_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', profile.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
