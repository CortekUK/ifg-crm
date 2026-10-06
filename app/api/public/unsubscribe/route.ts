import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/forms/process-submission'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe'

/**
 * Email unsubscribe. Public and unauthenticated by necessity — the people
 * using it have no CRM account — so the signed token in the link is what
 * stands in for auth.
 *
 * POST only. Two callers:
 *   - a mail client's native Unsubscribe button (RFC 8058 one-click), which
 *     posts here with a `List-Unsubscribe=One-Click` body and wants a plain
 *     2xx back
 *   - the /unsubscribe confirmation page's form, which sends `redirect=1` and
 *     wants to be sent back to the page with the result
 *
 * There is deliberately no GET. Mail clients and security scanners follow
 * links in email with GET, so a GET that unsubscribed would opt out people who
 * never clicked anything.
 *
 * Writes three columns, because the schema grew three answers to one question:
 *   subscription_status  — what the automation engine actually gates sends on
 *   email_subscribed     — the per-channel flag from migration 035
 *   unsubscribed_at      — when, for reporting
 * SMS is deliberately untouched: migration 035 exists precisely because
 * unsubscribing from email must not unsubscribe from SMS.
 */

export const runtime = 'nodejs'

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t.length ? t : undefined
}

export async function POST(request: NextRequest) {
  // Params may arrive in the query (one-click, where the URL is all the mail
  // client has) or in the form body (our own page). Query wins; both are
  // covered by the same signature.
  const url = new URL(request.url)
  let contactId = str(url.searchParams.get('c'))
  let token = str(url.searchParams.get('t'))
  let wantsRedirect = false

  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    try {
      const form = await request.formData()
      contactId = contactId ?? str(form.get('c') as string)
      token = token ?? str(form.get('t') as string)
      wantsRedirect = str(form.get('redirect') as string) === '1'
    } catch {
      // A one-click POST may carry a body we can't parse as a form. The query
      // string still has what we need, so this is not fatal.
    }
  }

  const back = (state: 'done' | 'invalid' | 'error') =>
    NextResponse.redirect(
      new URL(
        `/unsubscribe?state=${state}${contactId ? `&c=${encodeURIComponent(contactId)}` : ''}${token ? `&t=${encodeURIComponent(token)}` : ''}`,
        url.origin,
      ),
      // 303 so the browser follows with GET and a refresh can't re-post.
      { status: 303 },
    )

  if (!contactId || !token || !(await verifyUnsubscribeToken(contactId, token))) {
    if (wantsRedirect) return back('invalid')
    return NextResponse.json({ error: 'This unsubscribe link is not valid.' }, { status: 400 })
  }

  const supabase = getServiceClient()
  if (!supabase) {
    if (wantsRedirect) return back('error')
    return NextResponse.json({ error: 'Unsubscribe is temporarily unavailable.' }, { status: 503 })
  }

  const { error } = await supabase
    .from('contacts')
    .update({
      subscription_status: 'unsubscribed',
      email_subscribed: false,
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('id', contactId)

  if (error) {
    console.error('Unsubscribe failed:', error.message)
    if (wantsRedirect) return back('error')
    return NextResponse.json({ error: 'Could not record your request.' }, { status: 500 })
  }

  if (wantsRedirect) return back('done')
  return NextResponse.json({ success: true })
}
