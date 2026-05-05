import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-form-id, x-form-source',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface FormPayload {
  // Common fields
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  // Gravity Forms format
  input_1?: string
  input_2?: string
  input_3?: string
  input_4?: string
  // WPForms format
  wpforms?: {
    fields?: Record<string, { value: string; name: string }>
  }
  // Generic fields
  [key: string]: unknown
}

interface FieldMappings {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  sport?: string
  graduation_year?: string
  position?: string
  gender?: string
  [key: string]: string | undefined
}

interface DynamicListRule {
  field: string
  value: string
  list_id: string
}

interface AutomationConfig {
  form_id?: string
  field_mappings?: FieldMappings
  round_robin_users?: string[]
  pipeline_id?: string
  initial_stage_id?: string
  static_list_ids?: string[]
  dynamic_list_rules?: DynamicListRule[]
  [key: string]: unknown
}

interface FormSubmissionLog {
  id?: string
  form_id: string
  form_source: string
  payload: Record<string, unknown>
  contact_id?: string | null
  deal_id?: string | null
  automation_id?: string | null
  assigned_user_id?: string | null
  status: 'pending' | 'processed' | 'failed' | 'skipped'
  error_message?: string | null
  processing_time_ms?: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Initialize Supabase client with service role
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  let submissionLog: FormSubmissionLog | null = null

  try {
    // Parse the request body
    const payload: FormPayload = await req.json()

    // Get form ID from header or payload
    const formId = req.headers.get('x-form-id') ||
                   payload.form_id as string ||
                   payload.gform_unique_id as string ||
                   'unknown'

    // Detect form source
    const formSource = detectFormSource(req, payload)

    // Create initial submission log
    submissionLog = {
      form_id: formId,
      form_source: formSource,
      payload: payload as Record<string, unknown>,
      status: 'pending',
    }

    // Insert initial log entry
    const { data: logEntry, error: logError } = await supabase
      .from('form_submissions')
      .insert(submissionLog)
      .select()
      .single()

    if (logError) {
      console.error('Failed to create submission log:', logError)
    } else {
      submissionLog.id = logEntry.id
    }

    // Find automation by form_id - support both deal_creation and list_assignment types
    const { data: automation, error: automationError } = await supabase
      .from('automations')
      .select('*')
      .in('automation_type', ['deal_creation', 'list_assignment'])
      .eq('is_active', true)
      .filter('config->form_id', 'eq', formId)
      .single()

    if (automationError || !automation) {
      // Try to find by pipeline match if no form_id match
      const { data: automations } = await supabase
        .from('automations')
        .select('*')
        .in('automation_type', ['deal_creation', 'list_assignment'])
        .eq('is_active', true)

      if (!automations || automations.length === 0) {
        throw new Error(`No active automation found for form_id: ${formId}`)
      }

      // Use the first active automation as fallback
      console.log('Using fallback automation:', automations[0].id)
    }

    const activeAutomation = automation || null
    if (!activeAutomation) {
      throw new Error(`No active automation found for form_id: ${formId}`)
    }

    submissionLog.automation_id = activeAutomation.id

    const config = activeAutomation.config as AutomationConfig
    const automationType = activeAutomation.automation_type as string

    // Extract contact fields using field mappings
    const contactData = extractContactData(payload, config.field_mappings, formSource)

    if (!contactData.email) {
      throw new Error('Email is required but was not found in form submission')
    }

    // Find or create contact
    const contact = await findOrCreateContact(supabase, contactData)
    submissionLog.contact_id = contact.id

    // ── List Assignment (applies to both deal_creation and list_assignment types) ──

    // Static lists - always add contact to these
    if (config.static_list_ids && config.static_list_ids.length > 0) {
      const listInserts = config.static_list_ids.map(listId => ({
        contact_id: contact.id,
        list_id: listId,
        added_at: new Date().toISOString(),
      }))

      await supabase
        .from('contact_lists')
        .upsert(listInserts, { onConflict: 'contact_id,list_id' })
    }

    // Dynamic list rules - add contact based on field values
    if (config.dynamic_list_rules && config.dynamic_list_rules.length > 0) {
      const matchingListIds: string[] = []

      for (const rule of config.dynamic_list_rules) {
        const contactValue = getContactFieldValue(contactData, rule.field)
        if (contactValue !== null && contactValue.toLowerCase() === rule.value.toLowerCase()) {
          matchingListIds.push(rule.list_id)
        }
      }

      if (matchingListIds.length > 0) {
        const dynamicInserts = matchingListIds.map(listId => ({
          contact_id: contact.id,
          list_id: listId,
          added_at: new Date().toISOString(),
        }))

        await supabase
          .from('contact_lists')
          .upsert(dynamicInserts, { onConflict: 'contact_id,list_id' })
      }
    }

    // ── Deal Creation (only for deal_creation type) ──

    let deal: { id: string } | null = null
    let assignedUserId: string | null = null

    if (automationType === 'deal_creation') {
      // Get pipeline and initial stage
      const pipelineId = config.pipeline_id || activeAutomation.pipeline_id
      if (!pipelineId) {
        throw new Error('No pipeline configured for this automation')
      }

      // Get the initial stage (first stage in pipeline)
      let stageId = config.initial_stage_id
      if (!stageId) {
        const { data: stages } = await supabase
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', pipelineId)
          .order('display_order', { ascending: true })
          .limit(1)

        if (stages && stages.length > 0) {
          stageId = stages[0].id
        } else {
          throw new Error('No stages found for pipeline')
        }
      }

      // Get round-robin user assignment. When the configurer left every
      // recruiter unchecked, fall back to "all active recruiters" so the
      // deal still gets an owner — landing ownerless was the most common
      // form-webhook failure mode before this fallback existed. Admins
      // and super_admins are intentionally excluded; only role='recruiter'
      // is eligible to own a lead.
      let roundRobinUsers = config.round_robin_users || []

      if (roundRobinUsers.length === 0) {
        const { data: fallbackUsers } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'recruiter')
          .eq('is_active', true)
        roundRobinUsers = (fallbackUsers ?? []).map((u: { id: string }) => u.id)
      }

      if (roundRobinUsers.length > 0) {
        const { data: nextUserId, error: rrError } = await supabase
          .rpc('round_robin_next', {
            p_context_type: 'automation',
            p_context_id: activeAutomation.id,
            p_user_ids: roundRobinUsers,
          })

        if (rrError) {
          console.error('Round-robin error:', rrError)
          assignedUserId = roundRobinUsers[0]
        } else {
          assignedUserId = nextUserId
        }
      }

      submissionLog.assigned_user_id = assignedUserId

      // Create the deal
      const dealTitle = `${contactData.first_name || ''} ${contactData.last_name || ''}`.trim() ||
                        contactData.email.split('@')[0]

      const { data: dealData, error: dealError } = await supabase
        .from('deals')
        .insert({
          title: dealTitle,
          pipeline_id: pipelineId,
          stage_id: stageId,
          contact_id: contact.id,
          owner_id: assignedUserId,
          value: 0,
          status: 'active',
          stage_changed_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (dealError) {
        throw new Error(`Failed to create deal: ${dealError.message}`)
      }

      deal = dealData
      submissionLog.deal_id = deal.id

      // Create enrollment in the automation if it has steps
      const { data: steps } = await supabase
        .from('automation_steps')
        .select('id')
        .eq('automation_id', activeAutomation.id)
        .order('step_order', { ascending: true })
        .limit(1)

      if (steps && steps.length > 0) {
        const nextStepAt = new Date()

        await supabase
          .from('automation_enrollments')
          .insert({
            automation_id: activeAutomation.id,
            deal_id: deal.id,
            status: 'active',
            current_step_id: steps[0].id,
            next_step_at: nextStepAt.toISOString(),
            enrolled_at: new Date().toISOString(),
          })
      }

      // Log activity
      await supabase
        .from('deal_activities')
        .insert({
          deal_id: deal.id,
          user_id: assignedUserId,
          type: 'deal_created',
          description: `Deal created from ${formSource} form submission`,
          metadata: {
            form_id: formId,
            form_source: formSource,
            submission_id: submissionLog.id,
          },
        })
    }

    // Update submission log with success
    const processingTime = Date.now() - startTime
    if (submissionLog.id) {
      await supabase
        .from('form_submissions')
        .update({
          contact_id: contact.id,
          deal_id: deal?.id || null,
          assigned_user_id: assignedUserId,
          status: 'processed',
          processing_time_ms: processingTime,
          processed_at: new Date().toISOString(),
        })
        .eq('id', submissionLog.id)
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Form submission processed successfully',
        data: {
          contact_id: contact.id,
          deal_id: deal?.id || null,
          assigned_user_id: assignedUserId,
          automation_id: activeAutomation.id,
          automation_type: automationType,
          processing_time_ms: processingTime,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Form webhook error:', error)

    // Update submission log with error
    const processingTime = Date.now() - startTime
    if (submissionLog?.id) {
      await supabase
        .from('form_submissions')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          processing_time_ms: processingTime,
          processed_at: new Date().toISOString(),
        })
        .eq('id', submissionLog.id)
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Get a contact field value by field name for dynamic rule matching
 */
function getContactFieldValue(
  contactData: {
    first_name: string
    last_name: string
    email: string
    phone: string | null
    sport: string | null
    graduation_year: string | null
    position: string | null
    gender: string | null
    country: string | null
    state: string | null
    custom_fields: Record<string, unknown>
  },
  field: string
): string | null {
  switch (field) {
    case 'gender': return contactData.gender
    case 'graduation_year': return contactData.graduation_year
    case 'sport': return contactData.sport
    case 'position': return contactData.position
    case 'country': return contactData.country
    case 'state': return contactData.state
    default: {
      const customVal = contactData.custom_fields?.[field]
      return customVal !== null && customVal !== undefined ? String(customVal) : null
    }
  }
}

/**
 * Detect the source/type of form submission
 */
function detectFormSource(req: Request, payload: FormPayload): string {
  const headerSource = req.headers.get('x-form-source')
  if (headerSource) return headerSource

  // Check for Gravity Forms indicators
  if (payload.gform_unique_id || payload.is_submit) {
    return 'gravity_forms'
  }

  // Check for WPForms indicators
  if (payload.wpforms || payload.wpforms_id) {
    return 'wpforms'
  }

  // Check for Contact Form 7
  if (payload._wpcf7) {
    return 'contact_form_7'
  }

  // Check for Elementor Forms
  if (payload.form_id && payload.form_fields) {
    return 'elementor_forms'
  }

  return 'generic'
}

/**
 * Extract contact data from form payload using field mappings
 */
function extractContactData(
  payload: FormPayload,
  mappings: FieldMappings | undefined,
  formSource: string
): {
  first_name: string
  last_name: string
  email: string
  phone: string | null
  sport: string | null
  graduation_year: string | null
  position: string | null
  gender: string | null
  country: string | null
  state: string | null
  custom_fields: Record<string, unknown>
} {
  const result = {
    first_name: '',
    last_name: '',
    email: '',
    phone: null as string | null,
    sport: null as string | null,
    graduation_year: null as string | null,
    position: null as string | null,
    gender: null as string | null,
    country: null as string | null,
    state: null as string | null,
    custom_fields: {} as Record<string, unknown>,
  }

  // Try direct field names first
  if (payload.first_name) result.first_name = String(payload.first_name)
  if (payload.last_name) result.last_name = String(payload.last_name)
  if (payload.email) result.email = String(payload.email)
  if (payload.phone) result.phone = String(payload.phone)
  if (payload.gender) result.gender = String(payload.gender)
  if (payload.country) result.country = String(payload.country)
  if (payload.state) result.state = String(payload.state)

  // Apply field mappings if provided
  if (mappings) {
    for (const [targetField, sourceField] of Object.entries(mappings)) {
      if (!sourceField) continue

      let value: unknown = null

      // Handle nested field paths (e.g., "wpforms.fields.1.value")
      if (sourceField.includes('.')) {
        value = getNestedValue(payload, sourceField)
      } else {
        value = payload[sourceField]
      }

      if (value !== null && value !== undefined) {
        switch (targetField) {
          case 'first_name':
            result.first_name = String(value)
            break
          case 'last_name':
            result.last_name = String(value)
            break
          case 'email':
            result.email = String(value)
            break
          case 'phone':
            result.phone = String(value)
            break
          case 'sport':
            result.sport = String(value)
            break
          case 'graduation_year':
            result.graduation_year = String(value)
            break
          case 'position':
            result.position = String(value)
            break
          case 'gender':
            result.gender = String(value)
            break
          case 'country':
            result.country = String(value)
            break
          case 'state':
            result.state = String(value)
            break
          default:
            result.custom_fields[targetField] = value
        }
      }
    }
  }

  // Source-specific extraction
  if (formSource === 'gravity_forms') {
    // Gravity Forms uses input_X format
    if (!result.first_name && payload.input_1) result.first_name = String(payload.input_1)
    if (!result.last_name && payload.input_2) result.last_name = String(payload.input_2)
    if (!result.email && payload.input_3) result.email = String(payload.input_3)
    if (!result.phone && payload.input_4) result.phone = String(payload.input_4)
  }

  if (formSource === 'wpforms' && payload.wpforms?.fields) {
    // WPForms nests fields
    const fields = payload.wpforms.fields
    for (const [, field] of Object.entries(fields)) {
      const name = field.name?.toLowerCase()
      const value = field.value
      if (name?.includes('first') && name?.includes('name')) {
        result.first_name = value
      } else if (name?.includes('last') && name?.includes('name')) {
        result.last_name = value
      } else if (name?.includes('email')) {
        result.email = value
      } else if (name?.includes('phone')) {
        result.phone = value
      } else if (name?.includes('gender')) {
        result.gender = value
      }
    }
  }

  // Handle combined name field
  if (!result.first_name && !result.last_name && payload.name) {
    const nameParts = String(payload.name).trim().split(/\s+/)
    result.first_name = nameParts[0] || ''
    result.last_name = nameParts.slice(1).join(' ') || ''
  }

  // Handle full_name field
  if (!result.first_name && !result.last_name && payload.full_name) {
    const nameParts = String(payload.full_name).trim().split(/\s+/)
    result.first_name = nameParts[0] || ''
    result.last_name = nameParts.slice(1).join(' ') || ''
  }

  return result
}

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return null
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return null
    }
  }

  return current
}

/**
 * Find existing contact by email or create a new one
 */
async function findOrCreateContact(
  supabase: ReturnType<typeof createClient>,
  contactData: {
    first_name: string
    last_name: string
    email: string
    phone: string | null
    sport: string | null
    graduation_year: string | null
    position: string | null
    gender: string | null
    country: string | null
    state: string | null
    custom_fields: Record<string, unknown>
  }
): Promise<{ id: string; email: string }> {
  // Try to find existing contact by email
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, email')
    .eq('email', contactData.email.toLowerCase())
    .single()

  if (existingContact) {
    // Update contact with new information if provided
    const updates: Record<string, unknown> = {}
    if (contactData.first_name && !existingContact.first_name) {
      updates.first_name = contactData.first_name
    }
    if (contactData.last_name && !existingContact.last_name) {
      updates.last_name = contactData.last_name
    }
    if (contactData.phone) {
      updates.phone = contactData.phone
    }
    if (contactData.gender) {
      updates.gender = contactData.gender
    }
    if (contactData.country) {
      updates.country = contactData.country
    }
    if (contactData.state) {
      updates.state = contactData.state
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('contacts')
        .update(updates)
        .eq('id', existingContact.id)
    }

    return existingContact
  }

  // Create new contact
  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      first_name: contactData.first_name,
      last_name: contactData.last_name,
      email: contactData.email.toLowerCase(),
      phone: contactData.phone,
      sport: contactData.sport || 'football',
      graduation_year: contactData.graduation_year ? parseInt(contactData.graduation_year) : null,
      position: contactData.position,
      gender: contactData.gender,
      country: contactData.country,
      state: contactData.state,
      subscription_status: 'subscribed',
      source: 'form_submission',
    })
    .select('id, email')
    .single()

  if (error) {
    throw new Error(`Failed to create contact: ${error.message}`)
  }

  return newContact
}
