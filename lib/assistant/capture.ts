import type { SupabaseClient } from '@supabase/supabase-js'
import { assignTag, findOrCreateList, addContactToLists, MASTER_LIST } from '@/lib/forms/lead-routing'

/**
 * Shared enquiry-capture used by the website assistant (capture_enquiry tool),
 * the chatbot lead gate, the university-course gate and the exit-intent popup.
 * "List only" routing: upsert the contact and add them to a source-specific
 * list PLUS the "Website Enquiries" master (everyone from the website flows
 * through the master) — no deal/pipeline — plus an audit row in form_submissions.
 */

// Re-exported for existing importers (e.g. the deposit route).
export { findOrCreateList }

// Programme key → clean label used for per-brochure lists/tags.
const BROCHURE_LABEL: Record<string, string> = {
  summer: 'Summer Residency',
  university: 'University',
  'gap-year': 'Gap Year',
}

export interface EnquiryArgs {
  email?: string
  name?: string
  phone?: string
  interest?: string
  message?: string
  /** Where it came from, e.g. 'chatbot' | 'exit_intent'. Stored on the submission. */
  source?: string
  /** The specific university course the visitor enquired about (its clean name). */
  course?: string
  /** For brochure captures: which programme's brochure ('summer'|'university'|'gap-year'). */
  program?: string
}

/** Land an enquiry as a contact + add to the "Website Enquiries" list (list-only). */
export async function captureEnquiry(supabase: SupabaseClient, args: EnquiryArgs): Promise<{ ok: boolean }> {
  const email = args.email?.toLowerCase().trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false }

  const parts = (args.name ?? '').trim().split(/\s+/).filter(Boolean)
  const hasName = parts.length > 0
  const firstName = parts[0] || 'Website'
  // Only synthesise a placeholder surname when NO name was given at all (e.g. a
  // bare exit-intent email). A real single-word name keeps an empty surname
  // rather than an odd "Enquiry" filler after it.
  const lastName: string | null = hasName ? parts.slice(1).join(' ') || null : 'Enquiry'

  const { data: existing } = await supabase.from('contacts').select('id').eq('email', email).maybeSingle()
  let contactId: string | null = existing?.id ?? null

  if (contactId) {
    const updates: Record<string, unknown> = {}
    if (hasName) {
      updates.first_name = firstName
      if (lastName) updates.last_name = lastName
    }
    if (args.phone) updates.phone = args.phone
    // Record the specific course they enquired about on the contact itself.
    if (args.course) updates.degree_choice = args.course
    if (Object.keys(updates).length) await supabase.from('contacts').update(updates).eq('id', contactId)
  } else {
    const sourceMap: Record<string, string> = {
      exit_intent: 'website_exit_intent',
      university_course: 'website_university',
      brochure: 'website_brochure',
    }
    const { data: created } = await supabase
      .from('contacts')
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        phone: args.phone ?? null,
        source: (args.source && sourceMap[args.source]) || 'website_chatbot',
        degree_choice: args.course ?? null,
      })
      .select('id')
      .single()
    contactId = created?.id ?? null
  }

  if (!contactId) return { ok: false }

  // Route leads to a source-specific list for easy follow-up. The chatbot gate
  // (name + email captured before the chat starts) lands every visitor in a
  // dedicated "Chatbot Leads" list so nobody is lost even if they never finish
  // the conversation.
  let listName = 'Website Enquiries'
  let listDescription = 'Leads captured from the website'
  if (args.source === 'university_course') {
    listName = 'University Course Enquiries'
    listDescription = 'Visitors who enquired about a specific university course before heading to the UCLan course page'
  } else if (args.source === 'chatbot') {
    listName = 'Chatbot Leads'
    listDescription = 'Visitors who started the website chat — name & email captured up-front'
  } else if (args.source === 'brochure') {
    const label = BROCHURE_LABEL[args.program ?? ''] ?? 'Brochure'
    listName = `${label} Brochure Leads`
    listDescription = `Visitors who opened the ${label} brochure on the website`
  }
  const listId = await findOrCreateList(supabase, listName, listDescription)
  if (listId) {
    await supabase
      .from('contact_lists')
      .upsert(
        { contact_id: contactId, list_id: listId, added_at: new Date().toISOString() },
        { onConflict: 'contact_id,list_id' },
      )
  }

  // Everyone who comes through the website also flows into the master catch-all
  // list (the "divvying up" then happens via the specific lists above/tags).
  if (listName !== MASTER_LIST) await addContactToLists(supabase, contactId, [MASTER_LIST])

  // Tag the enquired course so it's visible and filterable on the contact/list.
  // Tags accumulate, so a visitor who enquires about several courses in one
  // visit ends up tagged with each of them.
  if (args.course) await assignTag(supabase, contactId, args.course, 'interest')

  // Tag brochure leads with the programme brochure they opened — accumulates, so
  // one contact ends up tagged with each programme brochure they've viewed.
  if (args.source === 'brochure') {
    const label = BROCHURE_LABEL[args.program ?? ''] ?? 'Brochure'
    await assignTag(supabase, contactId, `${label} Brochure`, 'source')
  }

  // Audit log so these leads appear under Form Submissions like other captures.
  await supabase.from('form_submissions').insert({
    contact_id: contactId,
    form_id: 'enquiry',
    form_source: args.source || 'chatbot',
    payload: args as Record<string, unknown>,
    status: 'processed',
  })

  return { ok: true }
}
