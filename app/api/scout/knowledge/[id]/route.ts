// Per-article update/delete. Super_admin only.

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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireSuperAdmin()
  if ('error' in ctx) return Response.json({ error: ctx.error }, { status: ctx.status })

  const { id } = await params
  let body: { slug?: string; title?: string; body_md?: string; tags?: string[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (typeof body.slug === 'string') {
    const slug = body.slug.trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
      return Response.json({ error: 'invalid slug format' }, { status: 400 })
    }
    updates.slug = slug
  }
  if (typeof body.title === 'string') updates.title = body.title.trim()
  if (typeof body.body_md === 'string') updates.body_md = body.body_md.trim()
  if (Array.isArray(body.tags)) {
    updates.tags = body.tags.map((t) => String(t).trim()).filter(Boolean)
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'no fields to update' }, { status: 400 })
  }

  const { data, error } = await ctx.supabase
    .from('scout_knowledge_articles')
    .update(updates)
    .eq('id', id)
    .select('id, slug, title, body_md, tags, created_at, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ article: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireSuperAdmin()
  if ('error' in ctx) return Response.json({ error: ctx.error }, { status: ctx.status })

  const { id } = await params
  const { error } = await ctx.supabase
    .from('scout_knowledge_articles')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
