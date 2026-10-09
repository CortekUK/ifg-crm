import type { SupabaseClient } from '@supabase/supabase-js'
import { normalisePositions, normaliseState } from '@/lib/utils/import-normalise'

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
  /**
   * The two attributes the cohort naming is derived from, carried through so
   * applyRouting can also remove the cohort the contact has moved out of
   * without re-deriving them (and risking the two disagreeing).
   */
  cohort: {
    gender: 'male' | 'female' | null
    graduationYear: number | null
  }
}

/**
 * Compute the full set of lists + tags for a lead from their attributes.
 * Pure and deterministic — no DB access — so it's trivially testable.
 */
/**
 * The cohort lists a contact belongs in, from gender + graduation year alone:
 * ["ALL MENS", "2027 MENS"]. Grounded in IFG's real lists, where "ALL MENS"
 * holds 51,142 contacts and "2027 MENS" 8,769.
 *
 * Exported because the CSV importer derives the same membership from a
 * spreadsheet column that this derives from a form field. Two copies of the
 * naming would drift the first time someone renamed a list, and the drift
 * would be silent — contacts quietly landing in "2027 Mens" alongside
 * "2027 MENS". One function, one convention.
 */
export function cohortListNames(
  gender: 'male' | 'female' | null | undefined,
  graduationYear: number | null | undefined,
): string[] {
  if (gender !== 'male' && gender !== 'female') return []
  const word = gender === 'male' ? 'MENS' : 'WOMENS'
  const names = [`ALL ${word}`]
  if (graduationYear) names.push(`${graduationYear} ${word}`)
  return names
}

/** The gender tag label matching a gender value ("Mens" / "Womens"). */
export function genderTagName(gender: 'male' | 'female' | null | undefined): string | null {
  if (gender === 'male') return 'Mens'
  if (gender === 'female') return 'Womens'
  return null
}

export function computeApplicationRouting(input: RoutingInput): Routing {
  const lists: string[] = [EVERYONE_LIST]
  if (input.includeMaster) lists.unshift(MASTER_LIST)
  const tags: { name: string; category: string }[] = []

  // Gender → ALL MENS/WOMENS, {year} MENS/WOMENS cohort, gender tag.
  const genderTag = genderTagName(input.gender)
  if (genderTag) {
    lists.push(...cohortListNames(input.gender, input.graduationYear))
    tags.push({ name: genderTag, category: 'gender' })
  }

  // Graduation year tag.
  if (input.graduationYear) tags.push({ name: String(input.graduationYear), category: 'year' })

  // Programme tag (the programme/season LIST is handled by the pipeline trigger).
  const progLabel = PROGRAMME_TAG_LABEL[input.formId]
  if (progLabel) tags.push({ name: progLabel, category: 'programme' })

  // Football position tag (very useful for filtering / squad planning).
  //
  // Normalised through the same folding the historic import uses, so a lead who
  // types "CAM", "Attacking Midfielder" or "AttackingMidfielder" lands on one
  // tag rather than three. A form that offers several positions yields one tag
  // each. Anything unrecognised falls back to the raw value so a position we
  // haven't seen before is still recorded rather than dropped.
  const rawPosition = input.position?.trim()
  if (rawPosition) {
    const normalised = normalisePositions(rawPosition)
    if (normalised.length > 0) {
      for (const position of normalised) tags.push({ name: position, category: 'position' })
    } else {
      tags.push({ name: rawPosition, category: 'position' })
    }
  }

  // Location tag (state). A US state or Canadian province folds to the same
  // two-letter code the CSV import tags with, so "California" and "CA" never
  // both appear. Anything else (non-US regions) keeps its raw value.
  const rawState = input.state?.trim()
  if (rawState) tags.push({ name: normaliseState(rawState) ?? rawState, category: 'location' })

  return {
    lists: Array.from(new Set(lists)),
    tags,
    cohort: { gender: input.gender, graduationYear: input.graduationYear },
  }
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

/**
 * Take a contact out of the cohort they are no longer in.
 *
 * Routing was add-only, so a player who resubmitted with a different
 * graduation year was filed into the new year group and left in the old one.
 * Submitting Gap Year as 2026 and again as 2027 put the same player in both
 * "2026 MENS" and "2027 MENS", with both year tags — so a campaign aimed at
 * the 2026 cohort still emailed someone who had told us they were 2027. The
 * duplicate is invisible: both memberships look perfectly normal on the
 * contact.
 *
 * Only the cohort naming convention is touched — the `{year} MENS/WOMENS` and
 * `ALL MENS/WOMENS` lists this module generates, and tags in the `year`
 * category. Hand-made lists, programme lists (owned by the
 * deal_sync_to_pipeline_list trigger) and every other tag are left alone: this
 * removes what WE put there under a value that has since changed, nothing else.
 *
 * Does nothing without a gender and a graduation year, because without both
 * there is no new cohort to be sure about and removing the old one would just
 * lose information.
 */
async function pruneSupersededCohort(
  supabase: SupabaseClient,
  contactId: string,
  gender: 'male' | 'female' | null | undefined,
  graduationYear: number | null | undefined,
) {
  if ((gender !== 'male' && gender !== 'female') || !graduationYear) return

  const keepLists = new Set(cohortListNames(gender, graduationYear))

  try {
    // Cohort lists the contact is currently on, by the naming convention.
    const { data: memberships } = await supabase
      .from('contact_lists')
      .select('list_id, list:lists!inner(id, name)')
      .eq('contact_id', contactId)

    const COHORT_NAME = /^(ALL|\d{4}) (MENS|WOMENS)$/
    const staleListIds: string[] = []
    for (const row of memberships ?? []) {
      const embedded = (row as { list?: unknown }).list
      const one = Array.isArray(embedded) ? embedded[0] : embedded
      const name = (one as { name?: string } | null)?.name?.trim().toUpperCase()
      if (!name || !COHORT_NAME.test(name)) continue
      if (!keepLists.has(name)) staleListIds.push(row.list_id as string)
    }

    if (staleListIds.length > 0) {
      await supabase
        .from('contact_lists')
        .delete()
        .eq('contact_id', contactId)
        .in('list_id', staleListIds)
    }

    // Year tags other than the current one.
    const { data: yearTags } = await supabase
      .from('tags')
      .select('id, name')
      .eq('category', 'year')

    const staleTagIds = (yearTags ?? [])
      .filter((t) => String(t.name).trim() !== String(graduationYear))
      .map((t) => t.id as string)

    if (staleTagIds.length > 0) {
      await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .in('tag_id', staleTagIds)
    }
  } catch (err) {
    // Best-effort, exactly like assignTag: a failed clean-up must never fail
    // the submission that triggered it.
    console.error('Failed to prune superseded cohort:', err)
  }
}

/** Apply a computed routing (lists + tags) to a contact. Best-effort. */
export async function applyRouting(supabase: SupabaseClient, contactId: string, routing: Routing) {
  await addContactToLists(supabase, contactId, routing.lists)
  for (const t of routing.tags) await assignTag(supabase, contactId, t.name, t.category)
  // After adding, remove the cohort they have moved OUT of. Add first so a
  // failure here never leaves the contact in no cohort at all.
  await pruneSupersededCohort(supabase, contactId, routing.cohort.gender, routing.cohort.graduationYear)
}

/**
 * The stage a brand-new lead should land on in a pipeline.
 *
 * "First stage by display_order" is the obvious guess and the wrong one: on all
 * three IFG pipelines that is `Dormant`, a dead end nobody works. A player who
 * has just written back, filed as dormant, is worse than not filed at all.
 *
 * Resolved the same way the public deposit route does it, so the two cannot
 * disagree about where a lead belongs:
 *
 *   1. the pipeline's active form-submission automation — whatever stage it
 *      drops real website leads on is by definition the new-lead stage
 *   2. failing that, the first stage typed `lead` (Initial Lead everywhere today)
 *   3. failing that, the first stage by order that is not a dead end
 *
 * Returns null only for a pipeline with no usable stage at all.
 */
export async function resolveNewLeadStageId(
  supabase: SupabaseClient,
  pipelineId: string,
): Promise<string | null> {
  const { data: automations } = await supabase
    .from('automations')
    .select('trigger_stage_id, config')
    .eq('trigger_type', 'form_submission')
    .eq('is_active', true)
    .eq('pipeline_id', pipelineId)

  for (const a of (automations ?? []) as { trigger_stage_id: string | null; config: { initial_stage_id?: string } | null }[]) {
    const stageId = a.config?.initial_stage_id || a.trigger_stage_id
    if (stageId) return stageId
  }

  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, stage_type')
    .eq('pipeline_id', pipelineId)
    .order('display_order', { ascending: true })

  const rows = (stages ?? []) as { id: string; stage_type: string | null }[]
  const lead = rows.find((s) => s.stage_type === 'lead')
  if (lead) return lead.id

  const DEAD_ENDS = new Set(['dormant', 'dead', 'lost'])
  const workable = rows.find((s) => !DEAD_ENDS.has(s.stage_type ?? ''))
  return workable?.id ?? rows[0]?.id ?? null
}

/**
 * Where a deal created FROM A REPLY belongs.
 *
 * QA-32 new issue 1: Smart Deal (correctly) stopped filing these in Dormant
 * and started using the new-lead stage instead — which put them in Initial
 * Lead, where the Initial Contact automation lives. So a player who had just
 * written in ("what does it cost?") was enrolled in the cold 3-email outreach
 * and sent the first-touch email six seconds later.
 *
 * Contact Response is where the board already puts anyone who replies, so a
 * reply-born deal starts there: nothing enrols it in the chase, and the
 * recruiter sees it in the column they work. Resolved by stage TYPE first,
 * then by name, because renaming a stage in the UI does not change its type
 * (the edit that broke the reply-move in QA-30). Falls back to the ordinary
 * new-lead stage when a pipeline has no contact stage at all — a deal in the
 * wrong column beats no deal.
 */
export async function resolveReplyLeadStageId(
  supabase: SupabaseClient,
  pipelineId: string,
): Promise<string | null> {
  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, name, stage_type')
    .eq('pipeline_id', pipelineId)
    .order('display_order', { ascending: true })

  const rows = (stages ?? []) as { id: string; name: string | null; stage_type: string | null }[]

  const byName = rows.find((s) => s.name?.trim().toLowerCase() === 'contact response')
  if (byName) return byName.id

  const byType = rows.find((s) => s.stage_type === 'contact')
  if (byType) return byType.id

  return resolveNewLeadStageId(supabase, pipelineId)
}
