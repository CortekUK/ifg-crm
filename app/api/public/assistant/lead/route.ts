import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/forms/process-submission'
import { captureEnquiry } from '@/lib/assistant/capture'

/**
 * Chatbot lead-capture endpoint.
 *
 * The website chat is gated behind a short name + email form. The MOMENT the
 * visitor submits it — before any conversation happens — the widget's server
 * proxy (web /api/assistant/lead) forwards here with the shared secret. We
 * upsert the contact and drop them into the "Chatbot Leads" list straight away,
 * so a lead is never lost even if they abandon the chat.
 *
 * This is intentionally separate from the message endpoint (/api/public/assistant)
 * and does NOT touch the LLM. Auth: `Authorization: Bearer <FORM_INGEST_SECRET>`.
 */

export const runtime = 'nodejs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  const secret = process.env.FORM_INGEST_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }
  const auth = request.headers.get('authorization') || ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: unknown; email?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  const supabase = getServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Temporarily unavailable' }, { status: 503 })
  }

  const result = await captureEnquiry(supabase, { name, email, source: 'chatbot' })
  if (!result.ok) {
    return NextResponse.json({ error: 'Could not save your details' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
