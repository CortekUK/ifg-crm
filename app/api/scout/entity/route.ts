// GET /api/scout/entity?type=contact&id=<uuid>
//
// Lightweight entity-detail lookup used by Scout's hover cards. The chat
// markdown renderer encounters a [Label](scout-entity:type:uuid) link and on
// hover fetches a small preview from here.
//
// Reads from the same v_scout_* views the chat tools use, so we don't expose
// any new surface area. super_admin gate up front.

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type EntityType =
  | 'contact'
  | 'deal'
  | 'invoice'
  | 'automation'
  | 'list'
  | 'pipeline'
  | 'user'

const VALID: EntityType[] = ['contact', 'deal', 'invoice', 'automation', 'list', 'pipeline', 'user']

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const type = req.nextUrl.searchParams.get('type') as EntityType | null
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!type || !VALID.includes(type)) {
    return Response.json({ error: 'invalid type' }, { status: 400 })
  }
  if (!isUuid(id)) {
    return Response.json({ error: 'invalid id' }, { status: 400 })
  }

  const a = admin()

  if (type === 'contact') {
    const { data } = await a
      .from('v_scout_contacts')
      .select('id, first_name, last_name, email, phone, country, position, club_name, owner_name, programme_names')
      .eq('id', id)
      .single()
    if (!data) return Response.json({ error: 'not found' }, { status: 404 })
    const d = data as Record<string, unknown>
    return Response.json({
      type,
      id,
      title: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || 'Contact',
      subtitle: [d.position, d.club_name, d.country].filter(Boolean).join(' · ') || null,
      facts: [
        ['Email', (d.email as string) ?? '—'],
        ['Phone', (d.phone as string) ?? '—'],
        ['Owner', (d.owner_name as string) ?? '—'],
        ['Programmes', Array.isArray(d.programme_names) ? (d.programme_names as string[]).join(', ') : '—'],
      ],
      href: '/contacts',
    })
  }

  if (type === 'deal') {
    const { data } = await a
      .from('v_scout_deals')
      .select('id, title, contact_name, pipeline_name, stage_name, owner_name, value, intent, days_in_stage')
      .eq('id', id)
      .single()
    if (!data) return Response.json({ error: 'not found' }, { status: 404 })
    const d = data as Record<string, unknown>
    return Response.json({
      type,
      id,
      title: (d.title as string) || (d.contact_name as string) || 'Deal',
      subtitle: [d.pipeline_name, d.stage_name].filter(Boolean).join(' · ') || null,
      facts: [
        ['Contact', (d.contact_name as string) ?? '—'],
        ['Owner', (d.owner_name as string) ?? '—'],
        ['Value', d.value ? `£${Number(d.value).toLocaleString()}` : '—'],
        ['Intent', (d.intent as string) ?? '—'],
        ['In stage', d.days_in_stage != null ? `${d.days_in_stage}d` : '—'],
      ],
      href: '/pipelines',
    })
  }

  if (type === 'invoice') {
    const { data } = await a
      .from('v_scout_invoices')
      .select('id, invoice_number, contact_name, amount, status, due_date, paid_at')
      .eq('id', id)
      .single()
    if (!data) return Response.json({ error: 'not found' }, { status: 404 })
    const d = data as Record<string, unknown>
    return Response.json({
      type,
      id,
      title: (d.invoice_number as string) || 'Invoice',
      subtitle: (d.contact_name as string) ?? null,
      facts: [
        ['Amount', d.amount ? `£${Number(d.amount).toLocaleString()}` : '—'],
        ['Status', (d.status as string) ?? '—'],
        ['Due', (d.due_date as string) ?? '—'],
        ['Paid at', (d.paid_at as string) ?? '—'],
      ],
      href: '/invoices',
    })
  }

  if (type === 'automation') {
    const { data } = await a
      .from('v_scout_automations')
      .select('id, name, type, pipeline_name, trigger_type, is_active, active_enrollments')
      .eq('id', id)
      .single()
    if (!data) return Response.json({ error: 'not found' }, { status: 404 })
    const d = data as Record<string, unknown>
    return Response.json({
      type,
      id,
      title: (d.name as string) || 'Automation',
      subtitle: [d.type, d.pipeline_name].filter(Boolean).join(' · ') || null,
      facts: [
        ['Trigger', (d.trigger_type as string) ?? '—'],
        ['Active', d.is_active ? 'Yes' : 'No'],
        ['Enrollments', d.active_enrollments != null ? String(d.active_enrollments) : '—'],
      ],
      href: '/automations',
    })
  }

  if (type === 'list') {
    const { data } = await a
      .from('v_scout_lists')
      .select('id, name, list_type, member_count')
      .eq('id', id)
      .single()
    if (!data) return Response.json({ error: 'not found' }, { status: 404 })
    const d = data as Record<string, unknown>
    return Response.json({
      type,
      id,
      title: (d.name as string) || 'List',
      subtitle: (d.list_type as string) ?? null,
      facts: [['Members', d.member_count != null ? String(d.member_count) : '—']],
      href: '/lists',
    })
  }

  if (type === 'pipeline') {
    const { data } = await a
      .from('v_scout_pipeline_state')
      .select('pipeline_id, pipeline_name, stage_name, deal_count')
      .eq('pipeline_id', id)
    if (!data || data.length === 0) {
      return Response.json({ error: 'not found' }, { status: 404 })
    }
    const rows = data as Record<string, unknown>[]
    const total = rows.reduce((n, r) => n + Number(r.deal_count ?? 0), 0)
    return Response.json({
      type,
      id,
      title: (rows[0].pipeline_name as string) || 'Pipeline',
      subtitle: `${rows.length} stages · ${total} deals`,
      facts: rows.slice(0, 5).map((r) => [
        (r.stage_name as string) ?? '—',
        String(r.deal_count ?? 0),
      ]),
      href: '/pipelines',
    })
  }

  // type === 'user'
  const { data } = await a
    .from('v_scout_users')
    .select('id, full_name, email, role')
    .eq('id', id)
    .single()
  if (!data) return Response.json({ error: 'not found' }, { status: 404 })
  const d = data as Record<string, unknown>
  return Response.json({
    type,
    id,
    title: (d.full_name as string) || 'User',
    subtitle: (d.role as string) ?? null,
    facts: [['Email', (d.email as string) ?? '—']],
    href: '/users',
  })
}
