import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/forms/process-submission'
import { syncBrochureAutomations } from '@/lib/brochures/sync-automations'

/**
 * Reconciles the "send this brochure when a deal enters a stage" automations for
 * one brochure to match its brochure_pipelines rows. Called by the Brochures
 * management page after saving pipeline attachments. Staff-only; the actual work
 * runs with the service client so it isn't limited by the caller's RLS.
 */
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role ?? null
  if (!role || role === 'player') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { brochureId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const brochureId = typeof body.brochureId === 'string' ? body.brochureId : ''
  if (!brochureId) return NextResponse.json({ error: 'brochureId is required' }, { status: 400 })

  const service = getServiceClient()
  if (!service) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

  try {
    await syncBrochureAutomations(service, brochureId)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Brochure automation sync error:', err)
    return NextResponse.json({ error: 'Could not sync brochure automations.' }, { status: 500 })
  }
}
