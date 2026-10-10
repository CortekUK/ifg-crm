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

type InviteBody = {
  contact_id: string
  invite_guardian?: boolean
  resend?: boolean
}

type DeleteBody = {
  contact_id: string
  remove_guardian?: boolean
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { contact_id, remove_guardian } = (await request.json()) as DeleteBody

    if (!contact_id || !remove_guardian) {
      return NextResponse.json(
        { error: 'contact_id and remove_guardian are required' },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()
    const { data: guardianProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('guardian_for_contact_id', contact_id)
      .eq('role', 'player')
      .maybeSingle()

    if (!guardianProfile) {
      return NextResponse.json({ success: true, message: 'No guardian to remove' })
    }

    await admin.auth.admin.deleteUser(guardianProfile.id)
    await admin.from('profiles').delete().eq('id', guardianProfile.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Guardian remove error:', error)
    const message = error instanceof Error ? error.message : 'Failed to remove guardian'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { contact_id, invite_guardian, resend } = (await request.json()) as InviteBody

    if (!contact_id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 })
    }

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name, parent_name, parent_email')
      .eq('id', contact_id)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    if (invite_guardian) {
      // Guardian invites use the parent fields already on the contact and
      // require the player to have an active portal first.
      if (!contact.parent_email) {
        return NextResponse.json(
          { error: 'Add a parent/guardian email to the contact before inviting' },
          { status: 400 }
        )
      }

      // The guardian cannot be invited on the same address as the player:
      // one login belongs to one email, and Supabase would reject the second
      // with "a user with this email address has already been registered",
      // which tells the admin nothing about what to do.
      //
      // This is not an edge case. 3,508 contacts hold their parent's address
      // as their own email — IFG reaches a lot of younger players through a
      // parent — so whoever works those contacts will meet it.
      if (
        contact.email &&
        contact.parent_email.trim().toLowerCase() === contact.email.trim().toLowerCase()
      ) {
        return NextResponse.json(
          {
            error:
              'The parent email is the same as the player email, so a separate guardian login cannot be created. That address already signs in as the player and sees everything a guardian would. To give the parent their own login, give the player a different email address first.',
          },
          { status: 400 }
        )
      }

      const { data: playerProfile } = await supabase
        .from('profiles')
        .select('id, password_set_at')
        .eq('contact_id', contact_id)
        .eq('role', 'player')
        .is('guardian_for_contact_id', null)
        .maybeSingle()

      if (!playerProfile || !playerProfile.password_set_at) {
        return NextResponse.json(
          { error: 'Player must activate their portal before inviting a guardian' },
          { status: 400 }
        )
      }

      // Find any existing guardian profile for this player.
      const { data: existingGuardian } = await supabaseAdmin
        .from('profiles')
        .select('id, email, password_set_at, is_active')
        .eq('guardian_for_contact_id', contact_id)
        .eq('role', 'player')
        .maybeSingle()

      if (existingGuardian) {
        // Active = password actually saved. profiles.password_set_at is the
        // single source of truth — see migration 098.
        const guardianHasPassword = !!existingGuardian.password_set_at

        // Emails are case-insensitive; compare them that way or a capital
        // letter reads as "a different parent".
        const sameAddress =
          (existingGuardian.email ?? '').trim().toLowerCase() ===
          (contact.parent_email ?? '').trim().toLowerCase()

        // Deactivated by migration 223 when the parent email changed.
        const guardianIsRevoked = existingGuardian.is_active === false

        // The decision is "is this row about the CURRENT parent?", not "did
        // that parent ever set a password".
        //
        // It used to be keyed on the password, and the combination of a
        // PENDING old guardian plus a changed parent email fell through to
        // "A guardian invitation is already pending" — so after changing the
        // parent email, staff could not invite the new parent at all. The
        // panel only offers Invite for the new address, never Resend, so
        // there was no way round it (QA-57). Migration 223 deactivates the old
        // login, which made it worse: a revoked row blocked the replacement
        // while granting nobody access.
        //
        // A row for a different address, or a revoked one, is stale whatever
        // its password state — remove it and invite fresh. Editing the parent
        // email on the contact is the authorisation.
        if (!sameAddress || guardianIsRevoked) {
          await supabaseAdmin.auth.admin.deleteUser(existingGuardian.id)
          await supabaseAdmin.from('profiles').delete().eq('id', existingGuardian.id)
        } else if (guardianHasPassword) {
          return NextResponse.json(
            { error: 'Guardian already has an active portal account' },
            { status: 400 }
          )
        } else if (!resend) {
          // Same address, invited, not yet activated, and this is not a
          // deliberate resend — say so rather than silently re-sending.
          return NextResponse.json(
            { error: 'A guardian invitation is already pending' },
            { status: 400 }
          )
        } else {
          // Same address + resend: wipe the stale row and send fresh.
          await supabaseAdmin.auth.admin.deleteUser(existingGuardian.id)
          await supabaseAdmin.from('profiles').delete().eq('id', existingGuardian.id)
        }
      }

      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        contact.parent_email,
        {
          data: {
            full_name: contact.parent_name || contact.parent_email,
            role: 'player',
            guardian_for_contact_id: contact.id,
          },
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        }
      )

      if (inviteError) {
        return NextResponse.json({ error: inviteError.message }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: `Invitation sent to ${contact.parent_email}`,
      })
    }

    // A portal login IS an email address, so there is nothing to create
    // without one. Checked here rather than left to Supabase, which refuses
    // with its own wording ("Unable to validate email address") that reads as
    // a system fault rather than "this contact has no email".
    if (!contact.email?.trim()) {
      return NextResponse.json(
        {
          error:
            'This contact has no email address, so there is nobody to send the invitation to. Add an email to the contact first.',
        },
        { status: 400 }
      )
    }

    // Player path. profiles.password_set_at is the single source of truth
    // for "this account has a working password" (see migration 098).
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, password_set_at')
      .eq('contact_id', contact_id)
      .eq('role', 'player')
      .is('guardian_for_contact_id', null)
      .maybeSingle()

    if (existingProfile) {
      const hasPassword = !!existingProfile.password_set_at

      if (hasPassword) {
        return NextResponse.json(
          { error: 'This contact already has an active portal account' },
          { status: 400 }
        )
      }

      if (!resend) {
        return NextResponse.json(
          { error: 'An invitation is already pending for this contact' },
          { status: 400 }
        )
      }

      await supabaseAdmin.auth.admin.deleteUser(existingProfile.id)
      await supabaseAdmin.from('profiles').delete().eq('id', existingProfile.id)
    }

    // Clear old invite rows for this contact whether or not a profile was
    // found. It used to sit inside the branch above, so re-inviting after the
    // player had been deleted from Users → Players — where no profile remains
    // — left the previous row in place and added a second alongside it.
    await supabaseAdmin.from('player_invites').delete().eq('contact_id', contact_id)

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
      return NextResponse.json({ error: inviteError.message }, { status: 400 })
    }

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
