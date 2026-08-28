import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/forms/process-submission'

/**
 * Brochure view tracking. Secret-guarded like the other public endpoints.
 *
 * Takes the viewer's email when the site knows it — the gate stores the
 * visitor's details locally and skips itself on return visits, so without this
 * a repeat viewer produced an anonymous counter bump and nothing else. The RPC
 * records the view, resolves the contact, and promotes a known viewer to a
 * lead on that brochure.
 */

export const runtime = 'nodejs'

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t.length ? t : undefined
}

export async function POST(request: NextRequest) {
  const secret = process.env.FORM_INGEST_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Tracking is temporarily unavailable.' }, { status: 500 })
  }
  const auth = request.headers.get('authorization') || ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const slug = str(body.slug)
  if (!slug) {
    return NextResponse.json({ error: 'A brochure slug is required.' }, { status: 400 })
  }

  const supabase = getServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Tracking is temporarily unavailable.' }, { status: 503 })
  }

  try {
    await supabase.rpc('record_brochure_view', {
      p_slug: slug,
      p_email: str(body.email) ?? null,
      p_referrer: str(body.referrer) ?? null,
      // Truncated: this is only ever read by a human scanning the view list.
      p_user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Brochure view tracking error:', err)
    return NextResponse.json({ error: 'Could not record the view.' }, { status: 500 })
  }
}
