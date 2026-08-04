import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/forms/process-submission'
import { captureEnquiry, type EnquiryArgs } from '@/lib/assistant/capture'

/**
 * Direct enquiry capture (no LLM) for the website's exit-intent popup and any
 * other lightweight "leave your details" form. Secret-guarded like the other
 * public endpoints. Same "list only" routing as the assistant's capture tool.
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
    return NextResponse.json({ error: 'Enquiries are temporarily unavailable.' }, { status: 500 })
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

  const email = str(body.email)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }

  const supabase = getServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Enquiries are temporarily unavailable.' }, { status: 503 })
  }

  const args: EnquiryArgs = {
    email,
    name: str(body.name),
    phone: str(body.phone),
    interest: str(body.interest),
    message: str(body.message),
    source: str(body.source) || 'exit_intent',
    course: str(body.course),
  }

  try {
    const result = await captureEnquiry(supabase, args)
    if (!result.ok) {
      return NextResponse.json({ error: 'Could not save your details.' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Enquiry capture error:', err)
    return NextResponse.json({ error: 'Could not save your details. Please try again.' }, { status: 500 })
  }
}
