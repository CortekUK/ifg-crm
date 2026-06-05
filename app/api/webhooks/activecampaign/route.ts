import { NextRequest, NextResponse } from 'next/server'
import { processFormSubmission } from '@/lib/forms/process-submission'

/**
 * Active Campaign webhook handler
 *
 * AC automation webhooks send contact data as application/x-www-form-urlencoded
 * with fields like: contact[email], contact[first_name], contact[last_name], etc.
 *
 * The form_id is passed as a query parameter: ?form_id=gap|uclan|masters
 */

// Map of form identifiers to human-readable names
const FORM_NAMES: Record<string, string> = {
  gap: 'Gap Year Programme',
  uclan: 'University Programme (UCLan)',
  masters: 'Training Experience (Masters)',
}

function parseActiveCampaignPayload(body: string): Record<string, string> {
  const params = new URLSearchParams(body)
  const result: Record<string, string> = {}

  for (const [key, value] of params.entries()) {
    // Flatten nested keys like contact[email] -> contact.email
    const flatKey = key.replace(/\[/g, '.').replace(/\]/g, '')
    result[flatKey] = value
  }

  return result
}

// Fuzzy lookup. Tries every key that loosely matches any of the given names
// (case-insensitive, space/underscore-tolerant). AC sends fields under names
// like "contact.fields.date_of_birth.val" but client setups vary — they
// sometimes use the field's display label ("Date of Birth"), sometimes a
// custom slug, sometimes a numeric field id. This iterates over the whole
// payload once and matches against all reasonable spellings, instead of
// depending on hard-coded combinations that miss when AC's wording shifts.
function pickField(data: Record<string, string>, names: string[]): string | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '')
  const wanted = names.map(normalize)
  for (const [rawKey, value] of Object.entries(data)) {
    if (!value) continue
    const cleaned = value.trim()
    if (!cleaned) continue
    const tail = rawKey.split('.').pop() ?? rawKey   // strip "contact.fields." prefix etc.
    const tailNorm = normalize(tail)
    const fullNorm = normalize(rawKey)
    if (wanted.includes(tailNorm) || wanted.some((w) => fullNorm.endsWith(w))) {
      return cleaned
    }
  }
  return null
}

function extractContactFromAC(data: Record<string, string>): {
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  country: string | null
  position: string | null
  expected_year_of_entry: string | null
  length_of_stay: string | null
} {
  return {
    first_name: pickField(data, ['first_name', 'firstname', 'fname', 'first']),
    last_name: pickField(data, ['last_name', 'lastname', 'lname', 'surname', 'last']),
    email: pickField(data, ['email', 'email_address', 'emailaddress']),
    phone: pickField(data, ['phone', 'phone_number', 'phonenumber', 'mobile', 'tel', 'telephone']),
    date_of_birth: pickField(data, [
      'date_of_birth', 'dateofbirth', 'dob', 'birthdate', 'birth_date',
    ]),
    gender: pickField(data, ['gender', 'sex']),
    country: pickField(data, ['country', 'nationality']),
    position: pickField(data, [
      'football_position', 'position', 'playing_position', 'role',
    ]),
    expected_year_of_entry: pickField(data, [
      'expected_year_of_entry', 'year_of_entry', 'entry_year', 'expectedyear',
    ]),
    length_of_stay: pickField(data, ['length_of_stay', 'duration', 'stay_length']),
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let rawData: Record<string, string>
    let rawPayload: Record<string, unknown>

    // AC can send as form-urlencoded or JSON depending on configuration
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const body = await request.text()
      rawData = parseActiveCampaignPayload(body)
      rawPayload = rawData as Record<string, unknown>
    } else {
      // JSON format
      const json = await request.json()
      rawPayload = json
      // Flatten JSON to same format
      rawData = {}
      if (json.contact) {
        for (const [key, value] of Object.entries(json.contact)) {
          if (typeof value === 'string' || typeof value === 'number') {
            rawData[`contact.${key}`] = String(value)
          } else if (typeof value === 'object' && value !== null) {
            for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
              rawData[`contact.${key}.${subKey}`] = String(subValue)
            }
          }
        }
      }
      // Also include top-level fields
      for (const [key, value] of Object.entries(json)) {
        if (key !== 'contact' && (typeof value === 'string' || typeof value === 'number')) {
          rawData[key] = String(value)
        }
      }
    }

    console.log('Received Active Campaign webhook:', JSON.stringify(rawData, null, 2))

    // Get form identifier from query params
    const formId = request.nextUrl.searchParams.get('form_id') || 'unknown'
    const formName = FORM_NAMES[formId] || formId

    // Extract contact data
    const contact = extractContactFromAC(rawData)

    // Validate required fields
    if (!contact.email) {
      console.error('Active Campaign webhook: No email provided')
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Land the contact, record the submission, and run automations/deals via
    // the shared processor (same code path used by our own website forms).
    const result = await processFormSubmission({
      formId,
      formName,
      formSource: 'activecampaign',
      contact,
      rawPayload,
    })

    if (!result.ok) {
      const status = result.error === 'Email is required' ? 400 : 500
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({
      success: true,
      contact_id: result.contactId,
      is_new: result.isNew,
      form: formName,
    })

  } catch (error) {
    console.error('Active Campaign webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Handle GET for endpoint verification
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'activecampaign-webhook',
    description: 'Active Campaign form submission webhook for IFG CRM',
  })
}
