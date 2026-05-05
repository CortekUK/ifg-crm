import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Create admin client lazily
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    // Check if request is from authenticated admin/super_admin
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Prevent self-deletion
    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get the user to be deleted
    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Block on owned active deals. deals.deal_owner_id is NOT NULL, so a
    // bare delete would fail with a foreign-key violation anyway — but the
    // bare error doesn't tell the admin who they need to reassign. Pull a
    // representative sample so the toast can name the deals.
    const { data: ownedDeals, count: ownedDealCount } = await supabaseAdmin
      .from('deals')
      .select('id, title, pipeline:pipelines(name), contact:contacts(first_name, last_name)', {
        count: 'exact',
      })
      .eq('deal_owner_id', userId)
      .eq('status', 'active')
      .limit(5)

    if (ownedDealCount && ownedDealCount > 0) {
      const sample = (ownedDeals ?? []).map((d) => {
        const p = d as unknown as {
          title: string | null
          pipeline?: { name?: string } | null
          contact?: { first_name?: string; last_name?: string } | null
        }
        const who = p.contact
          ? `${p.contact.first_name ?? ''} ${p.contact.last_name ?? ''}`.trim()
          : ''
        const label = who || p.title || 'Untitled deal'
        return p.pipeline?.name ? `${label} (${p.pipeline.name})` : label
      })
      const more = ownedDealCount - sample.length
      const list = sample.join(', ') + (more > 0 ? ` (and ${more} more)` : '')
      return NextResponse.json(
        {
          error: `This user is the deal owner on ${ownedDealCount} active deal${
            ownedDealCount === 1 ? '' : 's'
          }: ${list}. Reassign or close those deals before deleting the user.`,
          code: 'USER_HAS_OWNED_DEALS',
          deal_count: ownedDealCount,
        },
        { status: 400 },
      )
    }

    // Block on automation round-robin membership. round_robin_users lives
    // inside automations.config (JSONB) — we use the @> contains operator
    // so the DB does the array scan rather than us pulling every config
    // and filtering in JS.
    const { data: roundRobinAutomations } = await supabaseAdmin
      .from('automations')
      .select('id, name, is_active')
      .filter('config->round_robin_users', 'cs', JSON.stringify([userId]))

    if (roundRobinAutomations && roundRobinAutomations.length > 0) {
      const list = roundRobinAutomations.map((a) => `“${a.name}”`).join(', ')
      return NextResponse.json(
        {
          error: `This user is part of the round-robin assignment for ${roundRobinAutomations.length} automation${
            roundRobinAutomations.length === 1 ? '' : 's'
          }: ${list}. Remove them from those automations before deleting.`,
          code: 'USER_IN_AUTOMATION_ROUND_ROBIN',
          automation_count: roundRobinAutomations.length,
        },
        { status: 400 },
      )
    }

    // Deactivate the profile first (soft delete)
    const { error: deactivateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: false })
      .eq('id', userId)

    if (deactivateError) {
      console.error('Error deactivating profile:', deactivateError)
    }

    // Delete from Supabase Auth (profile FK columns are ON DELETE SET NULL)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Error deleting user from auth:', authError)
      return NextResponse.json({ error: `Failed to delete user: ${authError.message}` }, { status: 500 })
    }

    // Clean up: delete invite records and profile row since auth user is gone
    await supabaseAdmin.from('user_invites').delete().eq('email', targetUser.email)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    return NextResponse.json({
      success: true,
      message: `User ${targetUser.full_name || targetUser.email} has been deleted`,
    })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
