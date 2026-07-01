import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared enquiry-capture used by BOTH the website assistant (capture_enquiry
 * tool) and the exit-intent popup (direct submit). "List only" routing: upsert
 * the contact and add them to the "Website Enquiries" list — no deal/pipeline —
 * plus an audit row in form_submissions.
 */

export interface EnquiryArgs {
  email?: string
  name?: string
  phone?: string
  interest?: string
  message?: string
  /** Where it came from, e.g. 'chatbot' | 'exit_intent'. Stored on the submission. */
  source?: string
}

/** Find-or-create a marketing list by name, returning its id (or null). */
export async function findOrCreateList(supabase: SupabaseClient, name: string): Promise<string | null> {
  const { data: existing } = await supabase.from('lists').select('id').eq('name', name).maybeSingle()
  if (existing?.id) return existing.id as string
  const { data: created } = await supabase
    .from('lists')
    .insert({ name, description: 'Leads captured from the website', sport: 'football', is_dynamic: false })
    .select('id')
    .single()
  if (created?.id) return created.id as string
  // Lost a create race — re-read.
  const { data: refetched } = await supabase.from('lists').select('id').eq('name', name).maybeSingle()
  return (refetched?.id as string) ?? null
}

/** Land an enquiry as a contact + add to the "Website Enquiries" list (list-only). */
export async function captureEnquiry(supabase: SupabaseClient, args: EnquiryArgs): Promise<{ ok: boolean }> {
  const email = args.email?.toLowerCase().trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false }

  const parts = (args.name ?? '').trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] || 'Website'
  const lastName = parts.slice(1).join(' ') || 'Enquiry'

  const { data: existing } = await supabase.from('contacts').select('id').eq('email', email).maybeSingle()
  let contactId: string | null = existing?.id ?? null

  if (contactId) {
    const updates: Record<string, unknown> = {}
    if (parts.length) {
      updates.first_name = firstName
      updates.last_name = lastName
    }
    if (args.phone) updates.phone = args.phone
    if (Object.keys(updates).length) await supabase.from('contacts').update(updates).eq('id', contactId)
  } else {
    const sourceMap: Record<string, string> = {
      exit_intent: 'website_exit_intent',
      university_course: 'website_university',
    }
    const { data: created } = await supabase
      .from('contacts')
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        phone: args.phone ?? null,
        source: (args.source && sourceMap[args.source]) || 'website_chatbot',
      })
      .select('id')
      .single()
    contactId = created?.id ?? null
  }

  if (!contactId) return { ok: false }

  // University course enquiries go to their own list for easy follow-up.
  const listName = args.source === 'university_course' ? 'University Enquiries' : 'Website Enquiries'
  const listId = await findOrCreateList(supabase, listName)
  if (listId) {
    await supabase
      .from('contact_lists')
      .upsert(
        { contact_id: contactId, list_id: listId, added_at: new Date().toISOString() },
        { onConflict: 'contact_id,list_id' },
      )
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
