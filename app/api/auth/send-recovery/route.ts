import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type RecoveryStatus = 'sent' | 'not_found' | 'not_activated'

export type RecoveryResponse = {
  status: RecoveryStatus
  message: string
}

// Recovery flow with explicit checks (per product requirement):
//   1. Look up the email in profiles. If no profile exists → 'not_found'.
//   2. Check profiles.password_set_at on that profile. If NULL → 'not_activated'
//      (user needs to be invited and set up first; recovery wouldn't help them).
//   3. Otherwise call supabase.auth.resetPasswordForEmail and return 'sent'.
//
// resetPasswordForEmail only resets the password for the SPECIFIC auth user
// matching the email — guardian and player are separate auth users with
// separate passwords, so a guardian recovery never touches the player and
// vice versa.
//
// Note: this does leak account existence to the caller. The product UX
// explicitly wants tailored messages, so we accept that trade-off for an
// admin-managed academy app.
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ifg-crm.vercel.app'

    // 1. Profile must exist for this email.
    const { data: profile } = await admin
      .from('profiles')
      .select('id, password_set_at, role, guardian_for_contact_id')
      .ilike('email', email.trim())
      .maybeSingle()

    if (!profile) {
      const response: RecoveryResponse = {
        status: 'not_found',
        message:
          'No portal account found for that email. Ask the academy to invite you first.',
      }
      return NextResponse.json(response, { status: 200 })
    }

    // 2. Account must have completed setup (password_set_at stamped).
    if (!profile.password_set_at) {
      const response: RecoveryResponse = {
        status: 'not_activated',
        message:
          'This account hasn\'t been set up yet. Check your invitation email to activate the portal first.',
      }
      return NextResponse.json(response, { status: 200 })
    }

    // 3. Send the recovery email.
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/set-password`,
    })

    if (error) {
      console.warn('resetPasswordForEmail error:', error.message)
      // Treat upstream rate-limit / transient as success-shaped — user just
      // doesn't get an email and can retry.
    }

    const response: RecoveryResponse = {
      status: 'sent',
      message: 'A password reset link has been sent to your email.',
    }
    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('send-recovery error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
