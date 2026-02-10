import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()

    // Find pending invite for this user's email
    const { data: invite } = await admin
      .from('user_invites')
      .select('id, pipeline_ids')
      .eq('email', user.email!)
      .eq('status', 'pending')
      .single()

    if (!invite) {
      // No invite found — this is fine for password-reset flow
      return NextResponse.json({ success: true })
    }

    // Mark invite as accepted
    await admin
      .from('user_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id)

    // Copy pipeline_ids to profile's pipeline_assignments
    if (invite.pipeline_ids && invite.pipeline_ids.length > 0) {
      await admin
        .from('profiles')
        .update({ pipeline_assignments: invite.pipeline_ids })
        .eq('id', user.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Accept invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
