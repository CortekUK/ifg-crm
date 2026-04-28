import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if contact already exists
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', contact.email.toLowerCase().trim())
      .single()

    let contactId: string

    // Only male/female pass through — anything else (Other/Prefer not to say
    // etc.) gets set to null because the contacts.gender enum only allows
    // those two. Length-of-stay and expected-year-of-entry have no dedicated
    // column on contacts, so they go into custom_fields JSONB instead.
    const normalizedGender = contact.gender?.toLowerCase() === 'male'
      ? 'male'
      : contact.gender?.toLowerCase() === 'female'
        ? 'female'
        : null

    const customFields: Record<string, string> = {}
    if (contact.length_of_stay) customFields.length_of_stay = contact.length_of_stay
    if (contact.expected_year_of_entry) {
      customFields.expected_year_of_entry = contact.expected_year_of_entry
    }

    // graduation_year is a real column — try to coerce expected_year_of_entry
    // when it parses cleanly as a 4-digit year (otherwise leave null and let
    // the raw value live in custom_fields above).
    const yearCandidate = contact.expected_year_of_entry
      ? parseInt(contact.expected_year_of_entry.replace(/\D/g, ''), 10)
      : NaN
    const graduationYear = yearCandidate >= 1900 && yearCandidate <= 2100 ? yearCandidate : null

    if (existingContact) {
      contactId = existingContact.id

      // Update existing contact with new info (don't overwrite existing data with nulls)
      const updates: Record<string, unknown> = {}
      if (contact.first_name) updates.first_name = contact.first_name
      if (contact.last_name) updates.last_name = contact.last_name
      if (contact.phone) updates.phone = contact.phone
      if (normalizedGender) updates.gender = normalizedGender
      if (contact.country) updates.country = contact.country
      if (contact.position) updates.position = contact.position
      if (contact.date_of_birth) updates.date_of_birth = contact.date_of_birth
      if (graduationYear) updates.graduation_year = graduationYear
      if (Object.keys(customFields).length > 0) {
        // Merge instead of overwrite — preserves any custom fields set by
        // other paths (manual edit, other webhook).
        const { data: existingFields } = await supabase
          .from('contacts')
          .select('custom_fields')
          .eq('id', contactId)
          .single()
        const existing = (existingFields?.custom_fields ?? {}) as Record<string, unknown>
        updates.custom_fields = { ...existing, ...customFields }
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('contacts')
          .update(updates)
          .eq('id', contactId)
      }

      console.log(`Updated existing contact: ${contactId}`)
    } else {
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          email: contact.email.toLowerCase().trim(),
          first_name: contact.first_name || 'Unknown',
          last_name: contact.last_name || 'Contact',
          phone: contact.phone,
          gender: normalizedGender,
          country: contact.country,
          position: contact.position,
          // Previously these were extracted but never written. Now wired so
          // the contact carries everything the form actually collected.
          date_of_birth: contact.date_of_birth,
          graduation_year: graduationYear,
          custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
          source: 'website_form',
        })
        .select('id')
        .single()

      if (createError) {
        console.error('Error creating contact:', createError)
        return NextResponse.json(
          { error: 'Failed to create contact' },
          { status: 500 }
        )
      }

      contactId = newContact.id
      console.log(`Created new contact: ${contactId}`)
    }

    // Store form submission for record keeping
    try {
      await supabase.from('form_submissions').insert({
        contact_id: contactId,
        form_id: formId,
        form_source: 'activecampaign',
        payload: rawPayload,
        status: 'processed',
      })
    } catch (err) {
      console.error('Failed to log form submission:', err)
    }

    // Check for form-triggered automations in our CRM
    const { data: automations } = await supabase
      .from('automations')
      .select(`
        id,
        name,
        automation_type,
        pipeline_id,
        trigger_stage_id,
        config,
        steps:automation_steps(id, step_order)
      `)
      .eq('is_active', true)
      .eq('trigger_type', 'form_submission')

    if (automations && automations.length > 0) {
      for (const automation of automations) {
        const config = automation.config as {
          form_ids?: string[]
          form_id?: string
          static_list_ids?: string[]
          dynamic_list_rules?: { field: string; value: string; list_id: string }[]
          round_robin_users?: string[]
        } | null

        // Match by form_id
        if (config?.form_ids && !config.form_ids.includes(formId)) {
          if (!config.form_id || config.form_id !== formId) {
            continue
          }
        }

        // Static list assignment
        if (config?.static_list_ids && config.static_list_ids.length > 0) {
          const listInserts = config.static_list_ids.map(listId => ({
            contact_id: contactId,
            list_id: listId,
            added_at: new Date().toISOString(),
          }))
          await supabase
            .from('contact_lists')
            .upsert(listInserts, { onConflict: 'contact_id,list_id' })
        }

        // Dynamic list rules
        if (config?.dynamic_list_rules && config.dynamic_list_rules.length > 0) {
          const matchingListIds: string[] = []
          for (const rule of config.dynamic_list_rules) {
            let contactValue: string | null = null
            switch (rule.field) {
              case 'gender': contactValue = contact.gender; break
              case 'position': contactValue = contact.position; break
              case 'country': contactValue = contact.country; break
            }
            if (contactValue && contactValue.toLowerCase() === rule.value.toLowerCase()) {
              matchingListIds.push(rule.list_id)
            }
          }
          if (matchingListIds.length > 0) {
            const dynamicInserts = matchingListIds.map(listId => ({
              contact_id: contactId,
              list_id: listId,
              added_at: new Date().toISOString(),
            }))
            await supabase
              .from('contact_lists')
              .upsert(dynamicInserts, { onConflict: 'contact_id,list_id' })
          }
        }

        // Deal creation (skip for list_assignment type)
        if (automation.automation_type === 'list_assignment') {
          console.log(`List assignment automation ${automation.name} processed for contact ${contactId}`)
          continue
        }

        // Create a deal for this contact
        if (automation.pipeline_id && automation.trigger_stage_id) {
          const { data: existingDeal } = await supabase
            .from('deals')
            .select('id')
            .eq('contact_id', contactId)
            .eq('pipeline_id', automation.pipeline_id)
            .single()

          if (!existingDeal) {
            // Round-robin owner assignment. Mirrors the form-webhook edge
            // function path so deals created from AC forms get the same
            // rotation as deals created from native WordPress forms.
            let assignedOwnerId: string | null = null
            const roundRobinUsers = config?.round_robin_users || []
            if (roundRobinUsers.length > 0) {
              const { data: nextUserId, error: rrError } = await supabase.rpc('round_robin_next', {
                p_context_type: 'automation',
                p_context_id: automation.id,
                p_user_ids: roundRobinUsers,
              })
              if (rrError) {
                console.error('Round-robin error:', rrError)
                assignedOwnerId = roundRobinUsers[0]
              } else {
                assignedOwnerId = nextUserId as string | null
              }
            }

            const { data: newDeal, error: dealError } = await supabase
              .from('deals')
              .insert({
                contact_id: contactId,
                pipeline_id: automation.pipeline_id,
                current_stage_id: automation.trigger_stage_id,
                // UI and every existing query read deal_owner_id (original
                // schema column). owner_id was added later in migration 013
                // as a separate column; writing there does not surface in
                // the UI. Always write the rotation winner to deal_owner_id.
                deal_owner_id: assignedOwnerId,
                title: `${contact.first_name || 'New'} ${contact.last_name || 'Lead'}`,
                deal_value: 0,
                source: `activecampaign:${formName}`,
              })
              .select('id')
              .single()

            if (dealError) {
              console.error('Error creating deal:', dealError)
            } else {
              console.log(`Created deal ${newDeal.id} for automation ${automation.name}`)

              const firstStep = (automation.steps as { id: string; step_order: number }[])
                ?.sort((a, b) => a.step_order - b.step_order)?.[0]

              if (firstStep) {
                await supabase.from('automation_enrollments').insert({
                  automation_id: automation.id,
                  deal_id: newDeal.id,
                  current_step_id: firstStep.id,
                  status: 'active',
                  enrolled_at: new Date().toISOString(),
                  next_step_at: new Date().toISOString(),
                })
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      contact_id: contactId,
      is_new: !existingContact,
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
