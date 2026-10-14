import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/outlook/credentials'
import { sendNewMessage } from '@/lib/outlook/send'
import { OutlookReconnectRequired } from '@/lib/outlook/graph'
import { escapeLikeWildcards } from '@/lib/email/classify'
import { tidyNameFromEmail } from '@/lib/utils/smartMatch'

export const runtime = 'nodejs'

/**
 * Compose: send a new message from the signed-in user's own mailbox.
 *
 * Also reports whether the recipient is a known contact and whether they
 * already have a deal, so the screen can offer to create one (the Smart Deal
 * step). The deal itself is NOT created here — that needs a pipeline choice
 * from the user, and silently creating one would put a player into a pipeline
 * nobody picked.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!['admin', 'super_admin', 'recruiter'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
  }

  let body: { to?: string; subject?: string; body?: string; cc?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const to = body.to?.trim().toLowerCase()
  const subject = body.subject?.trim()
  const content = body.body

  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: 'A valid recipient email address is required.' }, { status: 400 })
  }
  if (!subject) return NextResponse.json({ error: 'A subject is required.' }, { status: 400 })
  if (!content?.trim()) return NextResponse.json({ error: 'The message is empty.' }, { status: 400 })

  const service = getServiceClient()
  if (!service) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  try {
    const result = await sendNewMessage(service, user.id, {
      to,
      subject,
      body: content,
      cc: body.cc,
    })

    // Look the recipient up so the UI can offer Smart Deal. Read through the
    // service client: the answer is about whether a deal EXISTS, and must not
    // vary with what this user happens to be allowed to see.
    let { data: contact } = await service
      .from('contacts')
      .select('id, first_name, last_name')
      .ilike('email', escapeLikeWildcards(to))
      .limit(1)
      .maybeSingle()

    // Writing to someone the CRM has never seen is the main reason Compose
    // exists — cold outreach. Record them as a contact at the moment we email
    // them, or the message goes out and the person is immediately lost: no
    // record, no deal, and nothing for their reply to match against when it
    // comes back. The address is the only fact we have, so the name is left
    // for whoever follows up to fill in.
    if (!contact) {
      // first_name and last_name are NOT NULL on contacts, so a name has to
      // be derived. tidyNameFromEmail is the SAME helper Smart Match uses when
      // it creates a contact from a reply, so a person who arrives by either
      // route ends up named identically rather than one path inventing its own
      // rule ("john.smith" -> John Smith, not a contact called "john.smith").
      const { firstName, lastName } = tidyNameFromEmail(to)

      const { data: created, error: createError } = await service
        .from('contacts')
        .insert({
          email: to,
          first_name: firstName,
          last_name: lastName,
          source: 'outlook_compose',
          sport: 'football',
        })
        .select('id, first_name, last_name')
        .maybeSingle()

      if (createError) {
        // The mail has already gone. Report the send as the success it is and
        // let the screen carry on without the deal prompt, rather than failing
        // the whole call over a contact row.
        console.error('outlook send: could not create contact for', to, createError.message)
      } else {
        contact = created
      }
    }

    let hasDeal = false
    if (contact) {
      const { count } = await service
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', (contact as { id: string }).id)
      hasDeal = (count ?? 0) > 0
    }

    const first = (contact as { first_name: string | null } | null)?.first_name ?? ''
    const last = (contact as { last_name: string | null } | null)?.last_name ?? ''

    return NextResponse.json({
      success: true,
      conversationId: result.conversationId,
      contact: contact
        ? {
            id: (contact as { id: string }).id,
            name: `${first} ${last}`.trim() || to,
            hasDeal,
          }
        : null,
    })
  } catch (err) {
    if (err instanceof OutlookReconnectRequired) {
      return NextResponse.json(
        { error: 'Your Outlook connection needs reconnecting.', reconnect: true },
        { status: 409 },
      )
    }
    console.error('outlook send failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not send the message.' },
      { status: 502 },
    )
  }
}
