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
    const { email, fullName, role, title, sport, phone, calendlyUrl, zoomUrl, pipelineIds } = body

    if (!email || !fullName) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 })
    }

    // Get admin client
    const supabaseAdmin = getSupabaseAdmin()

    // Check if user already exists in profiles
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      // Check if this is an unconfirmed user (from a previous failed invite)
      // by looking at their auth record
      if (hasServiceRoleKey()) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(existingUser.id)
        const identities = authUser?.user?.identities
        const hasCompletedSetup = identities && identities.length > 0

        if (!hasCompletedSetup) {
          // User never signed in — clean up old auth user + profile for re-invite
          await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
          // Explicitly delete the orphaned profile (no FK cascade from auth.users)
          await supabaseAdmin.from('profiles').delete().eq('id', existingUser.id)
        } else {
          return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
        }
      } else {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
      }
    }

    // Clean up any old invites for this email (all statuses — user may have been deleted and re-invited)
    await supabaseAdmin
      .from('user_invites')
      .delete()
      .eq('email', email)

    // Create invite record
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('user_invites')
      .insert({
        email,
        full_name: fullName,
        role: role || 'recruiter',
        title: title || null,
        sport: sport || 'football',
        phone: phone || null,
        calendly_url: calendlyUrl || null,
        zoom_url: zoomUrl || null,
        pipeline_ids: pipelineIds || null,
        invited_by: user.id,
        status: 'pending',
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Error creating invite:', inviteError)
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
    }

    // Generate the invite link without relying on email delivery. The link
    // is returned in the response so the admin can share it manually via
    // any channel (WhatsApp, Slack, in person, etc.). This is the right
    // mode while real recruiter mailboxes on the verified domain are not
    // yet provisioned — Supabase would otherwise try to send an email that
    // could not be delivered.
    let inviteLink: string | null = null
    let linkError: string | null = null
    if (hasServiceRoleKey()) {
      const { data: linkData, error: authError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
          data: {
            full_name: fullName,
            role: role || 'recruiter',
            title: title || null,
            sport: sport || 'football',
            phone: phone || null,
            calendly_url: calendlyUrl || null,
            zoom_url: zoomUrl || null,
            pipeline_assignments: pipelineIds || null,
          },
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
        },
      })

      if (authError) {
        // Log but don't fail — the invite record is still created so the
        // admin can retry, and the user_invites row carries the metadata.
        console.error('Error generating invite link:', authError)
        linkError = authError.message
      } else {
        inviteLink = linkData?.properties?.action_link ?? null
      }
    }

    return NextResponse.json({
      success: true,
      message: inviteLink
        ? 'Invite created. Share the link below with the new user.'
        : 'Invite record created (link generation failed or service role key missing).',
      invite: {
        id: invite.id,
        email: invite.email,
        full_name: invite.full_name,
        role: invite.role,
        sport: invite.sport,
      },
      invite_link: inviteLink,
      link_error: linkError,
    })
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
