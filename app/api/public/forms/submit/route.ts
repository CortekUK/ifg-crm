import { NextRequest, NextResponse } from 'next/server'
import { processFormSubmission, getServiceClient, type ContactInput } from '@/lib/forms/process-submission'
import { WEBSITE_FORM_MAP } from '@/lib/forms/forms-config'

/**
 * Native form-submission endpoint for the IFG public website.
 *
 * The website does NOT call this directly from the browser — its own
 * server-side proxy (/api/apply on the website) forwards here with a shared
 * secret, so the secret never reaches the client and the endpoint isn't
 * openly callable. Auth: `Authorization: Bearer <FORM_INGEST_SECRET>`.
 *
 * Body (JSON):
 *   {
 *     form: 'training' | 'university' | 'gap-year',
 *     firstName, lastName, email, phone,
 *     dob,                // ISO yyyy-mm-dd
 *     gender, country, position,
 *     lengthOfStay?,      // training only
 *     yearOfEntry?        // university / gap-year
 *   }
 *
 * On success this runs the exact same landing → automation → deal flow as the
 * ActiveCampaign webhook (via the shared processor).
 */

function str(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim()
    return t.length ? t : null
  }
  if (typeof v === 'number') return String(v)
  return null
}

export async function POST(request: NextRequest) {
  try {
    // --- auth ---
    const secret = process.env.FORM_INGEST_SECRET
    if (!secret) {
      console.error('FORM_INGEST_SECRET is not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const auth = request.headers.get('authorization') || ''
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // --- parse ---
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const formKey = str(body.form) || ''
    const mapping = WEBSITE_FORM_MAP[formKey]
    if (!mapping) {
      return NextResponse.json(
        { error: `Unknown form "${formKey}". Expected one of: ${Object.keys(WEBSITE_FORM_MAP).join(', ')}` },
        { status: 400 },
      )
    }

    const contact: ContactInput = {
      first_name: str(body.firstName) ?? str(body.first_name),
      last_name: str(body.lastName) ?? str(body.last_name),
      email: str(body.email),
      phone: str(body.phone),
      date_of_birth: str(body.dob) ?? str(body.date_of_birth),
      gender: str(body.gender),
      country: str(body.country),
      state: str(body.state),
      position: str(body.position),
      expected_year_of_entry: str(body.yearOfEntry) ?? str(body.expected_year_of_entry),
      length_of_stay: str(body.lengthOfStay) ?? str(body.length_of_stay),
    }

    if (!contact.email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = getServiceClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // A repeat submission for an email we already hold is NOT a duplicate to
    // reject — like the ActiveCampaign webhook, we update the existing contact
    // and let the form's automation create a deal in its own pipeline. This is
    // how one person can apply to several programmes (e.g. Summer then Gap Year)
    // and land in each pipeline while keeping a single contact record.
    const result = await processFormSubmission({
      formId: mapping.formId,
      formName: mapping.formName,
      formSource: 'website',
      contact,
      rawPayload: body,
      supabase,
    })

    if (!result.ok) {
      const status = result.error === 'Email is required' ? 400 : 500
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({
      success: true,
      contact_id: result.contactId,
      is_new: result.isNew,
      form: mapping.formName,
    })
  } catch (error) {
    console.error('Public form submit error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'public-forms-submit',
    description: 'IFG website form submission endpoint',
  })
}
