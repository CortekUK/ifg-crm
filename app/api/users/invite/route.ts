import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Create admin client lazily to avoid issues with env vars at module load
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }

  // Service role key is optional - if not present, we'll skip the auth invite
  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set - auth invite will be skipped')
  }

  return createClient(url, serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function hasServiceRoleKey() {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const { email, fullName, role, sport, calendlyUrl } = body

    if (!email || !fullName) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 })
    }

    // Get admin client
    const supabaseAdmin = getSupabaseAdmin()

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
    }

    // Check if invite already exists
    const { data: existingInvite } = await supabaseAdmin
      .from('user_invites')
      .select('id')
      .eq('email', email)
      .eq('status', 'pending')
      .single()

    if (existingInvite) {
      return NextResponse.json({ error: 'An invitation has already been sent to this email' }, { status: 400 })
    }

    // Create invite record
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('user_invites')
      .insert({
        email,
        full_name: fullName,
        role: role || 'recruiter',
        sport: sport || 'football',
        calendly_url: calendlyUrl || null,
        invited_by: user.id,
        status: 'pending',
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Error creating invite:', inviteError)
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
    }

    // Send invite via Supabase Auth (only if service role key is available)
    let emailSent = false
    if (hasServiceRoleKey()) {
      const { error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          role: role || 'recruiter',
          sport: sport || 'football',
          calendly_url: calendlyUrl || null,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      })

      if (authError) {
        // Log but don't fail - the invite record is still created
        console.error('Error sending auth invite email:', authError)
      } else {
        emailSent = true
      }
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'Invitation sent successfully'
        : 'Invitation created (email not sent - configure SUPABASE_SERVICE_ROLE_KEY to enable)',
      invite: {
        id: invite.id,
        email: invite.email,
        full_name: invite.full_name,
        role: invite.role,
        sport: invite.sport,
      },
    })
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
