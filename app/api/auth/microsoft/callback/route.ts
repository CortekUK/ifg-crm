import { NextRequest, NextResponse } from 'next/server'
import { getOutlookConfig } from '@/lib/outlook/config'
import { exchangeCodeForTokens, fetchGraphMe } from '@/lib/outlook/graph'
import { getServiceClient, saveTokens } from '@/lib/outlook/credentials'
import { OAUTH_STATE_COOKIE, verifyState } from '@/lib/outlook/state'
import { ensureSubscriptions } from '@/lib/outlook/subscriptions'

export const runtime = 'nodejs'

/**
 * Step 2: Microsoft sends the user back here with a one-time code.
 *
 * Always ends in a redirect to Settings with a readable message rather than
 * raw JSON — this URL is reached by a human in a browser, not by a script.
 */
function back(request: NextRequest, params: Record<string, string>) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, '')
  const url = new URL(`${base}/settings`)
  url.searchParams.set('section', 'outlook')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const response = NextResponse.redirect(url)
  response.cookies.delete(OAUTH_STATE_COOKIE)
  return response
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  // The user pressed Cancel, or Microsoft refused. Conditional Access shows up
  // here too: if their IT restricts new apps the user is blocked at consent.
  // That is their tenant policy, not a CRM fault, so the message says so
  // rather than inviting a bug report.
  const oauthError = params.get('error')
  if (oauthError) {
    const description = params.get('error_description') || oauthError
    return back(request, { outlook_error: description.slice(0, 300) })
  }

  const code = params.get('code')
  if (!code) return back(request, { outlook_error: 'Microsoft did not return an authorisation code.' })

  const userId = verifyState(params.get('state'), request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? null)
  if (!userId) {
    return back(request, {
      outlook_error: 'This sign-in link has expired or does not belong to your session. Please try connecting again.',
    })
  }

  const config = getOutlookConfig()
  const supabase = getServiceClient()
  if (!config || !supabase) {
    return back(request, { outlook_error: 'Outlook is not configured on this deployment.' })
  }

  try {
    const tokens = await exchangeCodeForTokens(config, code)

    // offline_access should guarantee a refresh token. Without one the
    // connection silently dies in an hour, so refuse it now with a message
    // rather than appear to work until lunchtime.
    if (!tokens.refresh_token) {
      return back(request, {
        outlook_error:
          'Microsoft did not return a refresh token. The app registration needs the offline_access permission.',
      })
    }

    const me = await fetchGraphMe(tokens.access_token)
    const mailbox = me.mail || me.userPrincipalName

    await saveTokens(
      supabase,
      userId,
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresInSeconds: tokens.expires_in,
      },
      {
        mailbox_email: mailbox,
        mailbox_display_name: me.displayName,
        graph_user_id: me.id,
      },
    )

    // Register the change-notification subscriptions straight away so mail
    // starts arriving without waiting for the next cron tick. Failure here is
    // NOT fatal: the connection is good, and the renewal job will pick the
    // subscriptions up. Locally it always fails — Microsoft will not deliver
    // notifications to localhost — and the catch-up sweep covers that.
    try {
      await ensureSubscriptions(supabase, userId)
    } catch (err) {
      console.warn('outlook: subscriptions not created at connect time:', err)
    }

    return back(request, { outlook_connected: mailbox || '1' })
  } catch (err) {
    console.error('outlook: callback failed', err)
    return back(request, {
      outlook_error: err instanceof Error ? err.message.slice(0, 300) : 'Could not complete the Outlook connection.',
    })
  }
}
