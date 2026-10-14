import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authorizeUrl, getOutlookConfig } from '@/lib/outlook/config'
import { tokenEncryptionAvailable } from '@/lib/outlook/crypto'
import { OAUTH_STATE_COOKIE, createState } from '@/lib/outlook/state'

export const runtime = 'nodejs'

/**
 * Step 1 of connecting a mailbox: send the signed-in user to Microsoft.
 *
 * Staff only — a player has no mailbox to connect, and letting a portal user
 * reach this would attach a real Microsoft account to a player record.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  const isStaff = ['admin', 'super_admin', 'recruiter'].includes(profile?.role ?? '')
  if (!isStaff || profile?.is_active === false) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
  }

  const config = getOutlookConfig()
  if (!config) {
    return NextResponse.json(
      { error: 'Outlook is not configured on this deployment. Ask an administrator to set the Microsoft credentials.' },
      { status: 503 },
    )
  }
  // Refusing here is deliberate: without the key we would store a live
  // refresh token in plaintext, which is the kind of failure nobody notices.
  if (!tokenEncryptionAvailable()) {
    return NextResponse.json(
      { error: 'Outlook is not configured securely (missing token encryption key). Connection refused.' },
      { status: 503 },
    )
  }

  const { state, nonce } = createState(user.id)
  const response = NextResponse.redirect(authorizeUrl(config, state))
  response.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // must survive the redirect back from Microsoft
    path: '/',
    maxAge: 600,
  })
  return response
}
