// CRUD endpoints for Scout knowledge-base articles. Super_admin only.
//
// GET    /api/scout/knowledge        -> list all articles, newest first
// POST   /api/scout/knowledge        -> create one { slug, title, body_md, tags? }
//
// Per-article PUT / DELETE live at /api/scout/knowledge/[id].

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

export async function GET() {
  const ctx = await requireSuperAdmin()
  if ('error' in ctx) return Response.json({ error: ctx.error }, { status: ctx.status })

  const { data, error } = await ctx.supabase
    .from('scout_knowledge_articles')
    .select('id, slug, title, body_md, tags, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ articles: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await requireSuperAdmin()
  if ('error' in ctx) return Response.json({ error: ctx.error }, { status: ctx.status })

  let body: { slug?: string; title?: string; body_md?: string; tags?: string[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const slug = (body.slug ?? '').trim().toLowerCase()
  const title = (body.title ?? '').trim()
  const body_md = (body.body_md ?? '').trim()
  const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : []

  if (!slug || !title || !body_md) {
    return Response.json(
      { error: 'slug, title and body_md are required' },
      { status: 400 },
    )
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
    return Response.json(
      { error: 'slug must be lowercase letters, numbers, hyphens or underscores' },
      { status: 400 },
    )
  }

  const { data, error } = await ctx.supabase
    .from('scout_knowledge_articles')
    .insert({ slug, title, body_md, tags, created_by_id: ctx.profile.id })
    .select('id, slug, title, body_md, tags, created_at, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ article: data })
}
