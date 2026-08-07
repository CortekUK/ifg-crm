import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/forms/process-submission'

/**
 * Brochure download tracking. Secret-guarded like the other public endpoints.
 * Bumps the download counter for a published brochure via a service-role RPC.
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
    await supabase.rpc('increment_brochure_download', { p_slug: slug })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Brochure download tracking error:', err)
    return NextResponse.json({ error: 'Could not record the download.' }, { status: 500 })
  }
}
