import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Stamp profiles.password_set_at = NOW() for the current authenticated user.
// Called by the set-password page immediately after supabase.auth.updateUser({password})
// returns without an error. This is our truth source for "user has saved a
// real password" — Supabase's encrypted_password column is redacted from the
// admin API and the other auth.users fields all flip earlier (on magic-link
// click), so we maintain our own bit.
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update only if not already set — set-password may be called multiple
    // times (e.g. password reset), and the original activation moment is the
    // useful timestamp.
    const { error } = await supabase
      .from('profiles')
      .update({ password_set_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('password_set_at', null)

    if (error) {
      console.error('mark-password-set error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('mark-password-set exception:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
