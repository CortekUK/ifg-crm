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

    // Player flow — mark any matching pending player_invites row as accepted.
    // The profile already exists (created at invite time by handle_new_user); no
    // pipeline assignment to copy. Multiple rows may match if admin resent —
    // accept them all.
    await admin
      .from('player_invites')
      .update({ status: 'accepted' })
      .eq('email', user.email!)
      .eq('status', 'pending')

    // Staff flow — find pending user_invites row, mark accepted, copy pipelines.
    const { data: invite } = await admin
      .from('user_invites')
      .select('id, pipeline_ids')
      .eq('email', user.email!)
      .eq('status', 'pending')
      .single()

    if (!invite) {
      // No staff invite — that's expected for player accounts and password resets.
      return NextResponse.json({ success: true })
    }

    await admin
      .from('user_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id)

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
