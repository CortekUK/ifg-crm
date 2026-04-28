import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Always-succeeds password recovery. Used by the "Forgot / Set up password"
// link on both the player and admin login pages. Handles three cases with the
// same flow:
//   1. User has a password — gets a recovery link to change it.
//   2. User clicked the original invite link but never saved a password
//      (email_confirmed_at set, no email/password identity) — recovery link
//      lets them set one without admin intervention.
//   3. Email doesn't exist — Supabase returns 200 anyway to avoid leaking
//      account existence; we mirror that.
//
// Returns 200 in all real cases. The client-side messaging is generic too.
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ifg-crm.vercel.app'

    // Recovery link sends the user to /set-password where they can save a
    // fresh password. The page already calls /api/auth/accept-invite after
    // submission so any pending player_invites / user_invites row gets marked
    // accepted on first save.
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/set-password`,
    })

    if (error) {
      // Treat rate-limit / not-found responses as success on the wire to avoid
      // leaking account existence — but still log so we can debug.
      console.warn('send-recovery suppressed error:', error.message)
    }

    return NextResponse.json({
      success: true,
      message: 'If that email is on file, you will receive a setup link shortly.',
    })
  } catch (error) {
    console.error('send-recovery error:', error)
    // Even on internal errors, return success-shaped response — the failure
    // mode is "user doesn't get an email" which they'll notice and retry.
    return NextResponse.json({
      success: true,
      message: 'If that email is on file, you will receive a setup link shortly.',
    })
  }
}
