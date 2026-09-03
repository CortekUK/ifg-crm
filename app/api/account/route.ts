import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { deletionBlockers, deleteAccount } from '@/lib/users/deletion'

/**
 * Your own account.
 *
 * GET  — what deleting it would affect, and whether it is currently possible.
 * DELETE — actually delete it.
 *
 * The button behind this used to open a `confirm()` and then run an empty
 * function, so someone could believe their account had been deleted when
 * nothing at all had happened.
 *
 * Guards are shared with the admin path in `/api/users/[userId]`, plus one
 * extra: the last active super admin cannot delete themselves, because
 * nobody would be left who could administer the CRM.
 */

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Missing Supabase environment variables')

  return createAdminClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = adminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name, role')
      .eq('id', user.id)
      .maybeSingle()

    const [openDeals, allDeals, ownedContacts] = await Promise.all([
      admin
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('deal_owner_id', user.id)
        .eq('status', 'active'),
      admin.from('deals').select('*', { count: 'exact', head: true }).eq('deal_owner_id', user.id),
      admin.from('contacts').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
    ])

    const blocker = await deletionBlockers(admin, user.id, { selfService: true })

    return NextResponse.json({
      email: profile?.email ?? user.email ?? '',
      full_name: profile?.full_name ?? '',
      role: profile?.role ?? '',
      impact: {
        open_deals: openDeals.count ?? 0,
        total_deals: allDeals.count ?? 0,
        owned_contacts: ownedContacts.count ?? 0,
      },
      can_delete: blocker === null,
      blocker: blocker?.error ?? null,
      blocker_code: blocker?.code ?? null,
    })
  } catch (error) {
    console.error('Account summary failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = adminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .maybeSingle()

    const accountEmail = (profile?.email ?? user.email ?? '').toLowerCase()

    // Typing the address is the confirmation. A one-click destructive
    // action on an account that owns CRM records is too easy to hit by
    // accident, and this cannot be undone.
    const body = (await request.json().catch(() => ({}))) as { confirmEmail?: string }
    if ((body.confirmEmail ?? '').trim().toLowerCase() !== accountEmail) {
      return NextResponse.json(
        { error: 'Type your account email exactly to confirm deletion.' },
        { status: 400 },
      )
    }

    const blocker = await deletionBlockers(admin, user.id, { selfService: true })
    if (blocker) {
      return NextResponse.json({ error: blocker.error, code: blocker.code }, { status: 400 })
    }

    const failure = await deleteAccount(admin, user.id, accountEmail)
    if (failure) return NextResponse.json({ error: failure.error }, { status: 500 })

    return NextResponse.json({
      success: true,
      message: 'Your account has been deleted.',
    })
  } catch (error) {
    console.error('Account deletion failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
