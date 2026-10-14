import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Who should own a new deal?
 *
 * There is a database trigger — prevent_excluded_deal_owner — that refuses any
 * deal owned by superadmin@theinternationalfootballgroup.com. That account is
 * the one staff are told to use for admin work, so "assign the deal to whoever
 * pressed the button" fails with a constraint error the moment an admin uses
 * Smart Deal. The error reads "Could not create the deal", which says nothing
 * about why.
 *
 * So the owner is resolved rather than assumed:
 *   1. someone assigned to this pipeline (round-robin across them)
 *   2. otherwise the person acting, if they are allowed to own deals
 *   3. otherwise any active recruiter
 *   4. otherwise null — the deal is created unowned rather than not at all
 *
 * Returning null is deliberate. An unowned deal is visible and can be assigned
 * in one click; a deal that failed to save is lost along with the context the
 * person had when they pressed the button.
 */

export const EXCLUDED_OWNER_EMAIL = 'superadmin@theinternationalfootballgroup.com'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

export interface OwnerResolution {
  ownerId: string | null
  /** Why this owner, for the message shown after the deal is made. */
  reason: 'pipeline' | 'self' | 'fallback' | 'unassigned'
}

export async function resolveDealOwner(
  supabase: Client,
  pipelineId: string,
  actingUserId: string,
): Promise<OwnerResolution> {
  // 1. people assigned to this pipeline
  const { data: assigned } = await supabase
    .from('profiles')
    .select('id')
    .contains('pipeline_assignments', [pipelineId])
    .eq('is_active', true)
    .neq('email', EXCLUDED_OWNER_EMAIL)

  const candidates = (assigned ?? []).map((u) => (u as { id: string }).id)
  if (candidates.length) {
    // Spread the work rather than always picking the first name alphabetically.
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    return { ownerId: pick, reason: 'pipeline' }
  }

  // 2. the person acting, but only if the trigger will accept them
  const { data: me } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('id', actingUserId)
    .maybeSingle()

  const myEmail = (me as { email: string } | null)?.email?.toLowerCase()
  if (me && myEmail !== EXCLUDED_OWNER_EMAIL) {
    return { ownerId: actingUserId, reason: 'self' }
  }

  // 3. any active recruiter
  const { data: anyone } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'recruiter')
    .eq('is_active', true)
    .neq('email', EXCLUDED_OWNER_EMAIL)
    .limit(1)
    .maybeSingle()

  if (anyone) return { ownerId: (anyone as { id: string }).id, reason: 'fallback' }

  // 4. unowned beats unsaved
  return { ownerId: null, reason: 'unassigned' }
}
