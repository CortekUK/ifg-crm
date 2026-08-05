import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { VERIFIED_EMAIL_DOMAINS_LABEL, isVerifiedDomainEmail } from '@/lib/config/email-domain'

/**
 * Email the new team member their password-setup link via Resend.
 *
 * The admin still gets the shareable link in the modal (single source of
 * truth, works even if email fails), but we also send it directly so the
 * recruiter can set their password without the admin having to forward
 * anything. Best-effort: a send failure must NOT fail the invite — the link
 * is already created and returned to the admin.
 */
async function sendInviteEmail(opts: {
  to: string
  fullName: string
  role: string
  inviteLink: string
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY not configured' }

  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'
  const roleLabel = opts.role === 'super_admin' ? 'Super Admin' : opts.role === 'admin' ? 'Admin' : 'Recruiter'
  const firstName = opts.fullName.trim().split(/\s+/)[0] || 'there'

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a0f0e;">
    <h1 style="font-size:20px;margin:0 0 16px;">You're invited to the IFG CRM</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Hi ${firstName},</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">
      You've been added to the International Football Group CRM as a <strong>${roleLabel}</strong>.
      Click the button below to set your password and activate your account.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${opts.inviteLink}" style="display:inline-block;background:#0a0f0e;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:bold;">
        Set your password
      </a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#666;margin:0 0 8px;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="font-size:12px;line-height:1.5;color:#888;word-break:break-all;margin:0 0 24px;">
      ${opts.inviteLink}
    </p>
    <p style="font-size:12px;color:#999;margin:0;">This link is single-use. If you didn't expect this invite, you can ignore this email.</p>
  </div>`

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: `International Football Group <${fromEmail}>`,
      to: [opts.to],
      subject: 'Set up your IFG CRM account',
      html,
    })
    if (result.error) {
      const message =
        typeof result.error === 'object' && result.error !== null && 'message' in result.error
          ? String((result.error as { message: unknown }).message)
          : 'Email failed'
      return { sent: false, error: message }
    }
    return { sent: true }
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Email failed' }
  }
}

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

    // Hard domain restriction: team members must be on the verified sending
    // domain, otherwise their outbound automation emails would be rejected by
    // Resend. Enforced server-side too (not just in the modal) so the rule
    // can't be bypassed via a direct API call.
    if (!isVerifiedDomainEmail(String(email))) {
      return NextResponse.json(
        {
          error: `Team members must use a ${VERIFIED_EMAIL_DOMAINS_LABEL} email address. The CRM sends emails from these domains, so other addresses can't send.`,
        },
        { status: 400 },
      )
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
        // Prefer an SSR-native token_hash link pointing at our own callback
        // (/auth/callback?token_hash=...&type=invite). It's verified via
        // verifyOtp, which writes the session through @supabase/ssr's cookie
        // adapter — reliable, unlike the default action_link's #access_token
        // implicit flow, which hangs/breaks under SSR. Fall back to the raw
        // action_link if the hashed token isn't present for some reason.
        const hashedToken = linkData?.properties?.hashed_token
        const appBase = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        inviteLink = hashedToken
          ? `${appBase}/auth/callback?token_hash=${hashedToken}&type=invite`
          : (linkData?.properties?.action_link ?? null)
      }
    }

    // Also email the link directly to the new user via Resend so they can set
    // their password without the admin forwarding anything. Best-effort: the
    // admin still has the shareable link as a fallback if this fails.
    let emailSent = false
    let emailError: string | null = null
    if (inviteLink) {
      const sendResult = await sendInviteEmail({
        to: email,
        fullName,
        role: role || 'recruiter',
        inviteLink,
      })
      emailSent = sendResult.sent
      emailError = sendResult.error ?? null
      if (!emailSent) {
        console.warn(`Invite email to ${email} not sent: ${emailError}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: inviteLink
        ? emailSent
          ? `Invite created and emailed to ${email}. The link below is a backup you can share too.`
          : 'Invite created. Share the link below with the new user.'
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
      email_sent: emailSent,
      email_error: emailError,
    })
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
