import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type PortalState = 'none' | 'invited' | 'active'

export type GuardianStatus = {
  state: PortalState
  email: string | null
  invited_at: string | null
  last_sign_in_at: string | null
}

export type PortalStatusResponse = {
  state: PortalState
  invited_at: string | null
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  guardian: GuardianStatus
}

// Portal state changes the moment staff invite, resend or remove access, and
// the caller polls the same URL — so it must never be served from a cache.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contactId = request.nextUrl.searchParams.get('contact_id')
    if (!contactId) {
      return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // Player profile (their own contact_id, no guardian link). password_set_at
    // is our bullet-proof activation signal — stamped only after the user has
    // genuinely saved a password (see /api/auth/mark-password-set).
    const { data: playerProfile } = await supabase
      .from('profiles')
      .select('id, created_at, password_set_at')
      .eq('contact_id', contactId)
      .eq('role', 'player')
      .is('guardian_for_contact_id', null)
      .maybeSingle()

    let playerState: PortalState = 'none'
    let invitedAt: string | null = null
    let lastSignInAt: string | null = null
    let emailConfirmedAt: string | null = null

    if (playerProfile) {
      invitedAt = playerProfile.created_at
      const { data: authResult } = await admin.auth.admin.getUserById(playerProfile.id)
      const authUser = authResult?.user
      if (authUser) {
        emailConfirmedAt = authUser.email_confirmed_at || null
        lastSignInAt = authUser.last_sign_in_at || null
      }
      playerState = playerProfile.password_set_at ? 'active' : 'invited'
    }

    // The address the player's parent is reachable at RIGHT NOW. The guardian
    // login is reported against this, not against whatever it was invited
    // under — see below.
    const { data: contactRow } = await supabase
      .from('contacts')
      .select('parent_email')
      .eq('id', contactId)
      .maybeSingle()
    const currentParentEmail = (contactRow?.parent_email as string | null) ?? null

    // Guardian profile linked to this player contact.
    const { data: guardianProfile } = await supabase
      .from('profiles')
      .select('id, email, created_at, password_set_at, is_active')
      .eq('guardian_for_contact_id', contactId)
      .eq('role', 'player')
      .maybeSingle()

    let guardian: GuardianStatus = {
      state: 'none',
      email: null,
      invited_at: null,
      last_sign_in_at: null,
    }

    // A guardian row only describes the CURRENT parent. Once the parent email
    // is changed on the contact, the old row is a revoked login (migration 223
    // deactivates it) and tells us nothing about the new address.
    //
    // Reporting it anyway is what produced "PENDING · <new address> ·
    // Invited": the panel showed the newly typed address beside the previous
    // invite's status, so staff believed an invite had gone to a parent who
    // had never been contacted. 'none' is the truth — nobody has been invited
    // at this address yet.
    const guardianMatchesCurrentParent =
      !!guardianProfile &&
      !!currentParentEmail &&
      String(guardianProfile.email ?? '').trim().toLowerCase() ===
        currentParentEmail.trim().toLowerCase()

    if (guardianProfile && guardianMatchesCurrentParent && guardianProfile.is_active !== false) {
      const { data: gAuth } = await admin.auth.admin.getUserById(guardianProfile.id)
      const gAuthUser = gAuth?.user
      guardian = {
        state: guardianProfile.password_set_at ? 'active' : 'invited',
        email: guardianProfile.email,
        invited_at: guardianProfile.created_at,
        last_sign_in_at: gAuthUser?.last_sign_in_at || null,
      }
    }

    const response: PortalStatusResponse = {
      state: playerState,
      invited_at: invitedAt,
      last_sign_in_at: lastSignInAt,
      email_confirmed_at: emailConfirmedAt,
      guardian,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Portal status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
