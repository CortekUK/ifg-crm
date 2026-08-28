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
  /** For brochure-library captures: the brochure's slug (public link identity). */
  brochureSlug?: string
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

  // For brochure-library captures, resolve the specific brochure by slug so we
  // can record the lead against it, honour its attached lists, and tag by title.
  let brochureId: string | null = null
  let brochureTitle: string | null = null
  let attachedListIds: string[] = []
  if (args.source === 'brochure' && args.brochureSlug) {
    const { data: b } = await supabase
      .from('website_brochures')
      .select('id, title')
      .eq('slug', args.brochureSlug)
      .maybeSingle()
    if (b) {
      brochureId = b.id as string
      brochureTitle = b.title as string
      const { data: bl } = await supabase.from('brochure_lists').select('list_id').eq('brochure_id', brochureId)
      attachedListIds = (bl ?? []).map((r) => r.list_id as string)
    }
  }

  // Route leads to the right list(s). Brochure captures use the brochure's
  // attached lists (or a "<title> Leads" list if none are attached); other
  // sources use their dedicated list. The chatbot gate lands every visitor in a
  // "Chatbot Leads" list up-front so nobody is lost mid-conversation.
  const targetListIds: string[] = []
  if (args.source === 'brochure' && brochureId) {
    if (attachedListIds.length) {
      targetListIds.push(...attachedListIds)
    } else {
      const lid = await findOrCreateList(
        supabase,
        `${brochureTitle} Leads`,
        `Leads captured from the "${brochureTitle}" brochure`,
      )
      if (lid) {
        targetListIds.push(lid)
        // Attach it to the brochure as well. Without this the list was created
        // and filled, but brochure_lists stayed empty — so the brochure's
        // "Attached lists" panel showed nothing, and every later capture went
        // back down this same "no attached lists" branch instead of reading
        // the list that already existed.
        await supabase
          .from('brochure_lists')
          .upsert({ brochure_id: brochureId, list_id: lid }, { onConflict: 'brochure_id,list_id' })
      }
    }
  } else {
    let listName = 'Website Enquiries'
    let listDescription = 'Leads captured from the website'
    if (args.source === 'university_course') {
      listName = 'University Course Enquiries'
      listDescription = 'Visitors who enquired about a specific university course before heading to the UCLan course page'
    } else if (args.source === 'chatbot') {
      listName = 'Chatbot Leads'
      listDescription = 'Visitors who started the website chat — name & email captured up-front'
    } else if (args.source === 'brochure') {
      // Legacy programme-page brochure link (posts `program`, no slug).
      const label = BROCHURE_LABEL[args.program ?? ''] ?? 'Brochure'
      listName = `${label} Brochure Leads`
      listDescription = `Visitors who opened the ${label} brochure on the website`
    }
    const listId = await findOrCreateList(supabase, listName, listDescription)
    if (listId) targetListIds.push(listId)
  }

  const nowIso = new Date().toISOString()
  for (const lid of targetListIds) {
    await supabase
      .from('contact_lists')
      .upsert({ contact_id: contactId, list_id: lid, added_at: nowIso }, { onConflict: 'contact_id,list_id' })
  }

  // Everyone who comes through the website also flows into the master catch-all
  // list (the "divvying up" then happens via the specific lists above/tags).
  await addContactToLists(supabase, contactId, [MASTER_LIST])

  // Record the lead against the specific brochure (powers per-brochure stats).
  if (brochureId) {
    await supabase
      .from('brochure_leads')
      .upsert({ brochure_id: brochureId, contact_id: contactId }, { onConflict: 'brochure_id,contact_id' })
  }

  // Tag the enquired course so it's visible and filterable on the contact/list.
  // Tags accumulate, so a visitor who enquires about several courses in one
  // visit ends up tagged with each of them.
  if (args.course) await assignTag(supabase, contactId, args.course, 'interest')

  // Tag brochure leads with the brochure they opened — accumulates, so one
  // contact ends up tagged with each brochure they've viewed.
  if (args.source === 'brochure') {
    const tag = brochureTitle ?? `${BROCHURE_LABEL[args.program ?? ''] ?? 'Brochure'} Brochure`
    await assignTag(supabase, contactId, tag, 'source')
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
