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

    // Guardian profile linked to this player contact.
    const { data: guardianProfile } = await supabase
      .from('profiles')
      .select('id, email, created_at, password_set_at')
      .eq('guardian_for_contact_id', contactId)
      .eq('role', 'player')
      .maybeSingle()

    let guardian: GuardianStatus = {
      state: 'none',
      email: null,
      invited_at: null,
      last_sign_in_at: null,
    }

    if (guardianProfile) {
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
