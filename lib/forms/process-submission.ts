import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { assignTag, computeApplicationRouting, applyRouting } from './lead-routing'
import {
  staffAlertEnabled,
  sendStaffAlert,
  ownerEmail,
  adminEmails,
} from '@/lib/notifications/staff-email'

/**
 * Shared form-submission processor.
 *
 * This is the single source of truth for what happens when a form is
 * submitted, regardless of where it came from (the ActiveCampaign webhook,
 * or our own website's /api/public/forms/submit endpoint):
 *
 *   1. Land the contact   — upsert into `contacts`, deduped by email
 *   2. Record the event   — insert a row into `form_submissions`
 *   3. Trigger automations — match active form_submission automations by form_id,
 *                            assign lists, create a deal (round-robin owner),
 *                            and enrol the deal in the automation
 *
 * Callers are responsible only for parsing their own payload format into the
 * normalized `ContactInput` below. Everything after that is identical.
 */

export interface ContactInput {
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  country: string | null
  state: string | null
  position: string | null
  expected_year_of_entry: string | null
  length_of_stay: string | null
}

export interface ProcessArgs {
  formId: string
  formName: string
  /** Where the submission originated, e.g. 'activecampaign' | 'website'. */
  formSource: string
  contact: ContactInput
  /** The raw payload, stored verbatim on the submission for the audit log. */
  rawPayload: Record<string, unknown>
  /**
   * The `source` stamped on a NEWLY created contact. Defaults to 'website_form'.
   * The website chatbot passes 'website_chatbot' so its leads are distinguishable.
   */
  contactSource?: string
  /**
   * Extra tags to find-or-create and attach to the contact (beyond the automatic
   * location tag). Used to label chatbot-sourced leads.
   */
  tags?: { name: string; category?: string }[]
  /** Optional pre-built service-role client (defaults to one built from env). */
  supabase?: SupabaseClient
}

export interface ProcessResult {
  ok: boolean
  contactId?: string
  isNew?: boolean
  submissionId?: string
  error?: string
}

/** Builds a service-role Supabase client from env, or returns null if unconfigured. */
export function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

interface AutomationRow {
  id: string
  name: string
  automation_type: string | null
  pipeline_id: string | null
  trigger_stage_id: string | null
  config: AutomationConfig | null
  steps: { id: string; step_order: number }[] | null
}

interface AutomationConfig {
  form_ids?: string[]
  form_id?: string
  static_list_ids?: string[]
  dynamic_list_rules?: { field: string; value: string; list_id: string }[]
  round_robin_users?: string[]
  default_deal_value?: number
}

export async function processFormSubmission(args: ProcessArgs): Promise<ProcessResult> {
  const { formId, formName, formSource, contact, rawPayload } = args
  const startedAt = Date.now()

  const supabase = args.supabase ?? getServiceClient()
  if (!supabase) {
    return { ok: false, error: 'Server configuration error: missing Supabase credentials' }
  }

  if (!contact.email) {
    // Log the failed attempt so it surfaces in the admin section, then bail.
    await safeLogFailure(supabase, formId, formSource, rawPayload, 'Email is required')
    return { ok: false, error: 'Email is required' }
  }

  const email = contact.email.toLowerCase().trim()

  // Only male/female pass through — the contacts.gender enum allows only those
  // two. Length-of-stay and expected-year-of-entry have no dedicated columns,
  // so they go into custom_fields JSONB.
  const normalizedGender =
    contact.gender?.toLowerCase() === 'male'
      ? 'male'
      : contact.gender?.toLowerCase() === 'female'
        ? 'female'
        : null

  const customFields: Record<string, string> = {}
  if (contact.length_of_stay) customFields.length_of_stay = contact.length_of_stay
  if (contact.expected_year_of_entry) customFields.expected_year_of_entry = contact.expected_year_of_entry
  // gender column is a male/female enum — preserve any other selection verbatim.
  if (contact.gender && !normalizedGender) customFields.gender = contact.gender

  // graduation_year is a real column — coerce expected_year_of_entry when it
  // parses cleanly as a 4-digit year; otherwise leave null (raw value still
  // lives in custom_fields above).
  const yearCandidate = contact.expected_year_of_entry
    ? parseInt(contact.expected_year_of_entry.replace(/\D/g, ''), 10)
    : NaN
  const graduationYear = yearCandidate >= 1900 && yearCandidate <= 2100 ? yearCandidate : null

  try {
    // 1. Upsert contact (dedup by email) ------------------------------------
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .single()

    let contactId: string
    const isNew = !existingContact

    if (existingContact) {
      contactId = existingContact.id
      const updates: Record<string, unknown> = {}
      if (contact.first_name) updates.first_name = contact.first_name
      if (contact.last_name) updates.last_name = contact.last_name
      if (contact.phone) updates.phone = contact.phone
      if (normalizedGender) updates.gender = normalizedGender
      if (contact.country) updates.country = contact.country
      if (contact.state) updates.state = contact.state
      if (contact.position) updates.position = contact.position
      if (contact.date_of_birth) updates.date_of_birth = contact.date_of_birth
      if (graduationYear) updates.graduation_year = graduationYear
      if (Object.keys(customFields).length > 0) {
        // Merge instead of overwrite — preserves custom fields set elsewhere.
        const { data: existingFields } = await supabase
          .from('contacts')
          .select('custom_fields')
          .eq('id', contactId)
          .single()
        const existing = (existingFields?.custom_fields ?? {}) as Record<string, unknown>
        updates.custom_fields = { ...existing, ...customFields }
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('contacts').update(updates).eq('id', contactId)
      }
    } else {
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          email,
          first_name: contact.first_name || 'Unknown',
          last_name: contact.last_name || 'Contact',
          phone: contact.phone,
          gender: normalizedGender,
          country: contact.country,
          state: contact.state,
          position: contact.position,
          date_of_birth: contact.date_of_birth,
          graduation_year: graduationYear,
          custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
          source: args.contactSource || 'website_form',
        })
        .select('id')
        .single()

      if (createError || !newContact) {
        await safeLogFailure(supabase, formId, formSource, rawPayload, 'Failed to create contact', email)
        return { ok: false, error: 'Failed to create contact' }
      }
      contactId = newContact.id
    }

    // 1b. Automatic lead routing --------------------------------------------
    // Deterministically sort the lead into the right lists + tags from their
    // attributes (gender → ALL/{year} MENS/WOMENS, programme → season list,
    // plus gender/year/programme/position/location tags). Find-or-create, so
    // existing lists/tags are reused and missing ones are made — no manual
    // per-value automation rules needed. The "Website Enquiries" master list is
    // added only for website/chatbot-origin submissions.
    const fromWebsite = formSource === 'website' || formSource === 'chatbot'
    const routing = computeApplicationRouting({
      formId,
      gender: normalizedGender,
      graduationYear,
      state: contact.state,
      position: contact.position,
      includeMaster: fromWebsite,
    })
    await applyRouting(supabase, contactId, routing)

    // 1c. Caller-supplied tags (e.g. a "Chatbot" source tag) -----------------
    for (const t of args.tags ?? []) {
      if (t?.name?.trim()) await assignTag(supabase, contactId, t.name, t.category ?? 'source')
    }

    // 2. Record the submission (status processed) ---------------------------
    let submissionId: string | undefined
    try {
      const { data: sub } = await supabase
        .from('form_submissions')
        .insert({
          contact_id: contactId,
          form_id: formId,
          form_source: formSource,
          payload: rawPayload,
          status: 'processed',
        })
        .select('id')
        .single()
      submissionId = sub?.id
    } catch (err) {
      console.error('Failed to log form submission:', err)
    }

    // 3. Trigger automations ------------------------------------------------
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

    // Track the first deal created so we can enrich the submission row with
    // the resolved automation / deal / owner for the admin view.
    let firstDeal: { dealId: string; automationId: string; ownerId: string | null } | null = null

    for (const automation of (automations as AutomationRow[] | null) ?? []) {
      const config = automation.config

      // If any form-id filter is set, the incoming formId MUST be in it.
      // If no filter is set, treat as "any form submission".
      const filterFormIds = config?.form_ids?.length
        ? config.form_ids
        : config?.form_id
          ? [config.form_id]
          : null
      if (filterFormIds && !filterFormIds.includes(formId)) continue

      // Static list assignment
      if (config?.static_list_ids && config.static_list_ids.length > 0) {
        const listInserts = config.static_list_ids.map((listId) => ({
          contact_id: contactId,
          list_id: listId,
          added_at: new Date().toISOString(),
        }))
        await supabase.from('contact_lists').upsert(listInserts, { onConflict: 'contact_id,list_id' })
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
          if (contactValue && contactValue.trim().toLowerCase() === rule.value.trim().toLowerCase()) {
            matchingListIds.push(rule.list_id)
          }
        }
        if (matchingListIds.length > 0) {
          const dynamicInserts = matchingListIds.map((listId) => ({
            contact_id: contactId,
            list_id: listId,
            added_at: new Date().toISOString(),
          }))
          await supabase.from('contact_lists').upsert(dynamicInserts, { onConflict: 'contact_id,list_id' })
        }
      }

      // Deal creation (skip for list_assignment type)
      if (automation.automation_type === 'list_assignment') continue

      if (automation.pipeline_id && automation.trigger_stage_id) {
        const { data: existingDeal } = await supabase
          .from('deals')
          .select('id, deal_owner_id')
          .eq('contact_id', contactId)
          .eq('pipeline_id', automation.pipeline_id)
          .single()

        if (existingDeal) {
          // Repeat submission into a pipeline this contact already has a deal
          // in: don't create a duplicate, but still link THIS submission to the
          // existing deal/automation/owner so the Form Submissions table shows
          // what it relates to instead of blank Deal/Automation/Assigned cells.
          if (!firstDeal) {
            firstDeal = {
              dealId: existingDeal.id,
              automationId: automation.id,
              ownerId: (existingDeal.deal_owner_id as string | null) ?? null,
            }
          }
        } else {
          // Round-robin owner assignment.
          let assignedOwnerId: string | null = null
          let roundRobinUsers = config?.round_robin_users || []
          // Empty selection means "round-robin across all staff" — that's what
          // the automation builder's UI promises. Resolve it to every active
          // recruiter, admin and super_admin here so deals always get an owner.
          // An unowned deal silently falls back to the Nathan Bibby catch-all
          // for the email from-name, from-address, AND signature, which looks
          // like a bug to the operator. Ordered by created_at so the rotation
          // array is stable across submissions (round_robin_next walks it by
          // position).
          if (roundRobinUsers.length === 0) {
            const { data: staff } = await supabase
              .from('profiles')
              .select('id')
              .in('role', ['recruiter', 'admin', 'super_admin'])
              .eq('is_active', true)
              .neq('email', 'superadmin@theinternationalfootballgroup.com')
              .order('created_at', { ascending: true })
            roundRobinUsers = (staff ?? []).map((r) => r.id as string)
          }
          if (roundRobinUsers.length > 0) {
            const { data: nextUserId, error: rrError } = await supabase.rpc('round_robin_next', {
              p_context_type: 'automation',
              p_context_id: automation.id,
              p_user_ids: roundRobinUsers,
            })
            assignedOwnerId = rrError ? roundRobinUsers[0] : (nextUserId as string | null)
          }

          const { data: newDeal, error: dealError } = await supabase
            .from('deals')
            .insert({
              contact_id: contactId,
              pipeline_id: automation.pipeline_id,
              current_stage_id: automation.trigger_stage_id,
              deal_owner_id: assignedOwnerId,
              title: `${contact.first_name || 'New'} ${contact.last_name || 'Lead'}`,
              deal_value: config?.default_deal_value ?? 0,
              source: `${formSource}:${formName}`,
            })
            .select('id')
            .single()

          if (dealError || !newDeal) {
            console.error('Error creating deal:', dealError)
          } else {
            if (!firstDeal) {
              firstDeal = { dealId: newDeal.id, automationId: automation.id, ownerId: assignedOwnerId }

              // Alert the recruiter this lead was just assigned to. Only for
              // the first deal of a submission: one enquiry can fan out into
              // several pipelines, and the person who has to act on it does
              // not need the same lead three times.
              //
              // Sits here rather than on the contacts insert trigger because
              // this is where a lead genuinely arrives — the CSV import of
              // 105k historic contacts never reaches this path, so it cannot
              // turn into 105k emails.
              void notifyNewLead(supabase, {
                dealId: newDeal.id,
                ownerId: assignedOwnerId,
                firstName: contact.first_name,
                lastName: contact.last_name,
                email: contact.email,
                phone: contact.phone,
                programme: automation.name ?? null,
                source: `${formSource}:${formName}`,
              })
            }
            const firstStep = automation.steps?.slice().sort((a, b) => a.step_order - b.step_order)?.[0]
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

    // Enrich the submission row with the resolved deal/automation/owner so the
    // admin section can show what each submission produced.
    if (submissionId) {
      const patch: Record<string, unknown> = {
        processed_at: new Date().toISOString(),
        processing_time_ms: Date.now() - startedAt,
      }
      if (firstDeal) {
        patch.deal_id = firstDeal.dealId
        patch.automation_id = firstDeal.automationId
        patch.assigned_user_id = firstDeal.ownerId
      }
      await supabase.from('form_submissions').update(patch).eq('id', submissionId)
    }

    return { ok: true, contactId, isNew, submissionId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await safeLogFailure(supabase, formId, formSource, rawPayload, message, email)
    return { ok: false, error: message }
  }
}

/** Best-effort failed-submission log so problems are visible in the admin UI. */
async function safeLogFailure(
  supabase: SupabaseClient,
  formId: string,
  formSource: string,
  rawPayload: Record<string, unknown>,
  errorMessage: string,
  email?: string,
) {
  try {
    let contactId: string | null = null
    if (email) {
      const { data } = await supabase.from('contacts').select('id').eq('email', email).single()
      contactId = data?.id ?? null
    }
    await supabase.from('form_submissions').insert({
      contact_id: contactId,
      form_id: formId,
      form_source: formSource,
      payload: rawPayload,
      status: 'failed',
      error_message: errorMessage,
    })
  } catch (err) {
    console.error('Failed to log failed form submission:', err)
  }
}

/**
 * Email the recruiter a lead has just been assigned to.
 *
 * Fire-and-forget: awaited nowhere, and swallows its own errors, so a slow
 * or failing mail provider can never delay or fail a form submission. The
 * lead is already saved by the time this runs.
 */
async function notifyNewLead(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  lead: {
    dealId: string
    ownerId: string | null
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    phone?: string | null
    programme?: string | null
    source?: string | null
  },
): Promise<void> {
  try {
    if (!(await staffAlertEnabled(supabase, 'newLead'))) return

    // The assigned recruiter is the person who has to act. With no owner
    // nobody is on the hook, so it goes to the admins instead of nowhere.
    const owner = await ownerEmail(supabase, lead.ownerId)
    const to = owner ? [owner] : await adminEmails(supabase)
    if (to.length === 0) return

    const name = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'A new lead'

    await sendStaffAlert({
      to,
      subject: `New lead: ${name}`,
      heading: `New lead — ${name}`,
      details: [
        { label: 'Email', value: lead.email },
        { label: 'Phone', value: lead.phone },
        { label: 'Programme', value: lead.programme },
        { label: 'Source', value: lead.source },
      ],
      ctaLabel: 'Open the deal',
      ctaPath: '/pipelines',
    })
  } catch (err) {
    console.error('New-lead alert failed (submission unaffected):', err)
  }
}
