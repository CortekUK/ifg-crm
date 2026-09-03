import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Deleting a CRM account, and the reasons not to.
 *
 * Shared between an admin deleting a colleague (`/api/users/[userId]`) and
 * someone deleting their own account (`/api/account`). Both need the same
 * answers, and a self-deletion that skipped these checks could orphan live
 * deals or leave the organisation with nobody who can administer it.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>

export interface DeletionBlocker {
  error: string
  code: string
  /** Extra detail for the caller, e.g. deal_count. */
  meta?: Record<string, unknown>
}

/**
 * Why this account cannot be deleted yet, or null if it can.
 *
 * `selfService` tightens one rule: an admin removing a colleague may be
 * the last super_admin standing, but somebody deleting themselves must
 * not be — otherwise nobody is left who can manage the CRM.
 */
export async function deletionBlockers(
  admin: Admin,
  userId: string,
  { selfService = false }: { selfService?: boolean } = {},
): Promise<DeletionBlocker | null> {
  if (selfService) {
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (profile?.role === 'super_admin') {
      const { count } = await admin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin')
        .eq('is_active', true)

      if ((count ?? 0) <= 1) {
        return {
          error:
            'You are the only active super admin. Promote someone else to super admin first, otherwise nobody would be able to administer the CRM.',
          code: 'LAST_SUPER_ADMIN',
        }
      }
    }
  }

  // Owned active deals. `deals.deal_owner_id` is NOT NULL, so a bare
  // delete would fail on the foreign key anyway — but the raw error does
  // not say which deals need reassigning.
  const { data: ownedDeals, count: ownedDealCount } = await admin
    .from('deals')
    .select('id, title, pipeline:pipelines(name), contact:contacts(first_name, last_name)', {
      count: 'exact',
    })
    .eq('deal_owner_id', userId)
    .eq('status', 'active')
    .limit(5)

  if (ownedDealCount && ownedDealCount > 0) {
    const sample = (ownedDeals ?? []).map((d) => {
      const deal = d as unknown as {
        title: string | null
        pipeline?: { name?: string } | null
        contact?: { first_name?: string; last_name?: string } | null
      }
      const who = deal.contact
        ? `${deal.contact.first_name ?? ''} ${deal.contact.last_name ?? ''}`.trim()
        : ''
      const label = who || deal.title || 'Untitled deal'
      return deal.pipeline?.name ? `${label} (${deal.pipeline.name})` : label
    })
    const more = ownedDealCount - sample.length
    const list = sample.join(', ') + (more > 0 ? ` (and ${more} more)` : '')

    return {
      error: `${selfService ? 'You are' : 'This user is'} the deal owner on ${ownedDealCount} active deal${
        ownedDealCount === 1 ? '' : 's'
      }: ${list}. ${selfService ? 'Ask an admin to reassign' : 'Reassign'} or close those deals first.`,
      code: 'USER_HAS_OWNED_DEALS',
      meta: { deal_count: ownedDealCount },
    }
  }

  // Round-robin membership. `round_robin_users` lives inside
  // automations.config (JSONB), so `@>` lets the database do the scan.
  const { data: roundRobin } = await admin
    .from('automations')
    .select('id, name, is_active')
    .filter('config->round_robin_users', 'cs', JSON.stringify([userId]))

  if (roundRobin && roundRobin.length > 0) {
    const list = roundRobin.map((a) => `“${a.name}”`).join(', ')
    return {
      error: `${selfService ? 'You are' : 'This user is'} part of the round-robin assignment for ${
        roundRobin.length
      } automation${roundRobin.length === 1 ? '' : 's'}: ${list}. ${
        selfService ? 'Ask an admin to remove you' : 'Remove them'
      } from those automations first.`,
      code: 'USER_IN_AUTOMATION_ROUND_ROBIN',
      meta: { automation_count: roundRobin.length },
    }
  }

  return null
}

/**
 * Remove the account.
 *
 * Order matters: deactivate, then delete the auth user (the profile FK
 * columns are ON DELETE SET NULL, so historic records keep their shape and
 * simply lose the owner), then clear the invite and profile rows the auth
 * user leaves behind.
 */
export async function deleteAccount(
  admin: Admin,
  userId: string,
  email: string,
): Promise<{ error: string } | null> {
  const { error: deactivateError } = await admin
    .from('profiles')
    .update({ is_active: false })
    .eq('id', userId)

  if (deactivateError) {
    console.error('Error deactivating profile:', deactivateError)
  }

  const { error: authError } = await admin.auth.admin.deleteUser(userId)
  if (authError) {
    console.error('Error deleting user from auth:', authError)
    return { error: `Failed to delete account: ${authError.message}` }
  }

  if (email) await admin.from('user_invites').delete().eq('email', email)
  await admin.from('profiles').delete().eq('id', userId)

  return null
}
