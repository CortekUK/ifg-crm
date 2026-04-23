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
    first_name: data['contact.first_name'] || data['first_name'] || null,
    last_name: data['contact.last_name'] || data['last_name'] || null,
    email: data['contact.email'] || data['email'] || null,
    phone: data['contact.phone'] || data['phone'] || null,
    date_of_birth:
      data['contact.fields.date_of_birth.val'] ||
      data['contact.fields.Date of Birth.val'] ||
      data['contact.fields.date_of_birth'] ||
      data['date_of_birth'] ||
      null,
    gender:
      data['contact.fields.gender.val'] ||
      data['contact.fields.Gender.val'] ||
      data['contact.fields.gender'] ||
      data['gender'] ||
      null,
    country:
      data['contact.fields.country.val'] ||
      data['contact.fields.Country.val'] ||
      data['contact.fields.country'] ||
      data['country'] ||
      null,
    position:
      data['contact.fields.football_position.val'] ||
      data['contact.fields.Football Position.val'] ||
      data['contact.fields.position.val'] ||
      data['contact.fields.football_position'] ||
      data['position'] ||
      null,
    expected_year_of_entry:
      data['contact.fields.expected_year_of_entry.val'] ||
      data['contact.fields.Expected Year Of Entry.val'] ||
      data['contact.fields.expected_year_of_entry'] ||
      null,
    length_of_stay:
      data['contact.fields.length_of_stay.val'] ||
      data['contact.fields.Length Of Stay.val'] ||
      data['contact.fields.length_of_stay'] ||
      null,
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

    if (existingContact) {
      contactId = existingContact.id

      // Update existing contact with new info (don't overwrite existing data with nulls)
      const updates: Record<string, unknown> = {}
      if (contact.first_name) updates.first_name = contact.first_name
      if (contact.last_name) updates.last_name = contact.last_name
      if (contact.phone) updates.phone = contact.phone
      if (contact.gender) {
        const g = contact.gender.toLowerCase()
        if (g === 'male' || g === 'female') updates.gender = g
      }
      if (contact.country) updates.country = contact.country
      if (contact.position) updates.position = contact.position
      if (contact.date_of_birth) updates.date_of_birth = contact.date_of_birth

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('contacts')
          .update(updates)
          .eq('id', contactId)
      }

      console.log(`Updated existing contact: ${contactId}`)
    } else {
      // Create new contact
      const normalizedGender = contact.gender?.toLowerCase() === 'male' ? 'male'
        : contact.gender?.toLowerCase() === 'female' ? 'female'
        : null
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
