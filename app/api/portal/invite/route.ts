import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { contact_id } = await request.json()

    if (!contact_id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 })
    }

    // Get contact details
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name')
      .eq('id', contact_id)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Check if player already has portal access
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('contact_id', contact_id)
      .eq('role', 'player')
      .single()

    if (existingProfile) {
      return NextResponse.json({ error: 'This contact already has portal access' }, { status: 400 })
    }

    // Use service role client to invite user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      contact.email,
      {
        data: {
          full_name: `${contact.first_name} ${contact.last_name}`,
          role: 'player',
          contact_id: contact.id,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      }
    )

    if (inviteError) {
      console.error('Invite error:', inviteError)
      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 }
      )
    }

    // Record the invite
    await supabase.from('player_invites').insert({
      contact_id: contact.id,
      email: contact.email,
      invited_by: user.id,
    })

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${contact.email}`,
    })
  } catch (error) {
    console.error('Portal invite error:', error)
    const message = error instanceof Error ? error.message : 'Failed to send invitation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
