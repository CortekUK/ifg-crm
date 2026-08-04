import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Automatic lead routing — the single source of truth for which lists and tags
 * a website lead should land in, derived purely from their attributes.
 *
 * This replaces the old, error-prone approach of hand-wiring per-value
 * `dynamic_list_rules` on each deal-creation automation (which, among other
 * things, silently ignored graduation-year rules). Everything here is
 * find-or-create: existing lists/tags are matched by exact name and reused,
 * missing ones are created — so a new applicant automatically lands in every
 * list and tag they should, with zero manual setup.
 *
 * The naming conventions below are grounded in IFG's real lists
 * (e.g. "ALL MENS", "2027 MENS", "SUMMER RESIDENCY 2027"). Adjust them here and
 * every submission path (website forms, chatbot, enquiries) follows suit.
 */

// ---- Convention config -----------------------------------------------------

/** Top-level catch-all every website lead flows into first. */
export const MASTER_LIST = 'Website Enquiries'
/** The everyone list, used alongside the master for full applications. */
export const EVERYONE_LIST = 'ALL CONTACTS EVERYONE'

// NOTE: the per-programme/season lists (e.g. "UK GAP 2027") are NOT handled
// here. They are linked to a pipeline (lists.source_pipeline_id) and populated
// automatically by the `deal_sync_to_pipeline_list` trigger when the
// deal-creation automation makes the deal — so they always track the current
// campaign pipeline. Generating them here would duplicate that and use the
// wrong year (the applicant's entry year vs. the campaign season). We keep only
// the programme TAG below.

/** form_id → clean programme tag label. */
const PROGRAMME_TAG_LABEL: Record<string, string> = {
  summer: 'Summer Residency',
  gapyear: 'Gap Year',
  university: 'University',
}

export interface RoutingInput {
  /** CRM form_id: 'summer' | 'university' | 'gapyear' (others get no programme list/tag). */
  formId: string
  gender: 'male' | 'female' | null
  graduationYear: number | null
  state?: string | null
  position?: string | null
  /** Include the "Website Enquiries" master list (website / chatbot origins only). */
  includeMaster?: boolean
}

export interface Routing {
  lists: string[]
  tags: { name: string; category: string }[]
}

/**
 * Compute the full set of lists + tags for a lead from their attributes.
 * Pure and deterministic — no DB access — so it's trivially testable.
 */
export function computeApplicationRouting(input: RoutingInput): Routing {
  const lists: string[] = [EVERYONE_LIST]
  if (input.includeMaster) lists.unshift(MASTER_LIST)
  const tags: { name: string; category: string }[] = []

  // Gender → ALL MENS/WOMENS, {year} MENS/WOMENS cohort, gender tag.
  if (input.gender === 'male' || input.gender === 'female') {
    const word = input.gender === 'male' ? 'MENS' : 'WOMENS'
    lists.push(`ALL ${word}`)
    if (input.graduationYear) lists.push(`${input.graduationYear} ${word}`)
    tags.push({ name: input.gender === 'male' ? 'Mens' : 'Womens', category: 'gender' })
  }

  // Graduation year tag.
  if (input.graduationYear) tags.push({ name: String(input.graduationYear), category: 'year' })

  // Programme tag (the programme/season LIST is handled by the pipeline trigger).
  const progLabel = PROGRAMME_TAG_LABEL[input.formId]
  if (progLabel) tags.push({ name: progLabel, category: 'programme' })

  // Football position tag (very useful for filtering / squad planning).
  if (input.position?.trim()) tags.push({ name: input.position.trim(), category: 'position' })

  // Location tag (state), preserving prior behaviour.
  if (input.state?.trim()) tags.push({ name: input.state.trim(), category: 'location' })

  return { lists: Array.from(new Set(lists)), tags }
}

// ---- Low-level helpers (single source of truth, no cyclic imports) ---------

/** Find-or-create a marketing list by name, returning its id (or null). */
export async function findOrCreateList(
  supabase: SupabaseClient,
  name: string,
  description = 'Leads captured from the website',
): Promise<string | null> {
  const { data: existing } = await supabase.from('lists').select('id').eq('name', name).maybeSingle()
  if (existing?.id) return existing.id as string
  const { data: created } = await supabase
    .from('lists')
    .insert({ name, description, sport: 'football', is_dynamic: false })
    .select('id')
    .single()
  if (created?.id) return created.id as string
  // Lost a create race — re-read.
  const { data: refetched } = await supabase.from('lists').select('id').eq('name', name).maybeSingle()
  return (refetched?.id as string) ?? null
}

/**
 * Find-or-create a tag by name and attach it to the contact.
 * Best-effort: a failure here must never fail the whole submission.
 */
export async function assignTag(supabase: SupabaseClient, contactId: string, rawName: string, category: string) {
  const name = rawName.trim()
  if (!name) return
  try {
    let { data: tag } = await supabase.from('tags').select('id').eq('name', name).maybeSingle()
    if (!tag) {
      const { data: created } = await supabase.from('tags').insert({ name, category }).select('id').single()
      tag = created ?? null
      // Lost a create race against a concurrent submission — re-read by name.
      if (!tag) {
        const { data: refetched } = await supabase.from('tags').select('id').eq('name', name).maybeSingle()
        tag = refetched ?? null
      }
    }
    if (tag) {
      await supabase
        .from('contact_tags')
        .upsert({ contact_id: contactId, tag_id: tag.id }, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true })
    }
  } catch (err) {
    console.error('Failed to assign tag:', err)
  }
}

/** Add a contact to each named list (find-or-create, dedup membership). */
export async function addContactToLists(supabase: SupabaseClient, contactId: string, names: string[]) {
  for (const name of names) {
    const listId = await findOrCreateList(supabase, name)
    if (!listId) continue
    await supabase
      .from('contact_lists')
      .upsert(
        { contact_id: contactId, list_id: listId, added_at: new Date().toISOString() },
        { onConflict: 'contact_id,list_id' },
      )
  }
}

/** Apply a computed routing (lists + tags) to a contact. Best-effort. */
export async function applyRouting(supabase: SupabaseClient, contactId: string, routing: Routing) {
  await addContactToLists(supabase, contactId, routing.lists)
  for (const t of routing.tags) await assignTag(supabase, contactId, t.name, t.category)
}
