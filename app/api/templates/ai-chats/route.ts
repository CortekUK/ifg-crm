// List the current super_admin's AI template chats.
//
// GET /api/templates/ai-chats -> { chats: [{ id, title, updated_at, ... }] }
// GET /api/templates/ai-chats?template_id=<uuid> -> filtered to that template

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireSuperAdmin() {
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
    return { error: 'Super_admin only.', status: 403 as const }
  }
  return { supabase, profile }
}

export async function GET(req: NextRequest) {
  const ctx = await requireSuperAdmin()
  if ('error' in ctx) return Response.json({ error: ctx.error }, { status: ctx.status })

  // Optional template_id filter — used by AiPromptPanel on mount to
  // auto-resume the most recent chat for the active template, so the
  // user doesn't have to click History → find the chat → load every
  // time they refresh.
  const templateId = req.nextUrl.searchParams.get('template_id')

  let query = ctx.supabase
    .from('template_ai_chats')
    .select('id, title, template_id, created_at, updated_at')
    .eq('user_id', ctx.profile.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (templateId) {
    query = query.eq('template_id', templateId)
  }

  const { data, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ chats: data ?? [] })
}
