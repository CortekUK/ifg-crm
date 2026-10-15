import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/outlook/credentials'
import { sendNewMessage, type OutgoingAttachment } from '@/lib/outlook/send'
import { OutlookReconnectRequired } from '@/lib/outlook/graph'
import { escapeLikeWildcards } from '@/lib/email/classify'
import { tidyNameFromEmail } from '@/lib/utils/smartMatch'
import { getBrandingSlots } from '@/lib/templates/branding-server'
import { buildComposedEmail } from '@/lib/outlook/compose-html'
import {
  createInvoicePaymentLink, markInvoiceSent, InvoicePaymentError,
} from '@/lib/invoices/payment-link'

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

  let body: {
    to?: string
    subject?: string
    body?: string
    cc?: string[]
    templateId?: string | null
    brochureId?: string | null
    attachments?: { name?: string; contentType?: string; contentBytes?: string }[]
    invoiceId?: string | null
  }
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
  // A template carries its own subject and its own body, so neither has to
  // come from the sender when one is chosen.
  if (!subject && !body.templateId) {
    return NextResponse.json({ error: 'A subject is required.' }, { status: 400 })
  }
  if (!content?.trim() && !body.templateId && !body.brochureId && !body.attachments?.length && !body.invoiceId) {
    return NextResponse.json({ error: 'The message is empty.' }, { status: 400 })
  }

  // Graph takes attachments inline on sendMail only while the whole message
  // stays under about 4MB, and base64 adds a third to every file. 2.5MB of
  // real files leaves room for the branded body underneath both that ceiling
  // and the request limit. Bigger needs an upload session on a draft; the one
  // genuinely large thing people send is a brochure, and that goes as a link.
  const ATTACHMENT_LIMIT_BYTES = 2.5 * 1024 * 1024

  const attachments: OutgoingAttachment[] = []
  for (const a of body.attachments ?? []) {
    if (!a?.name || !a.contentBytes) continue
    attachments.push({
      name: a.name,
      contentType: a.contentType || 'application/octet-stream',
      contentBytes: a.contentBytes,
    })
  }

  // base64 is 4 characters per 3 bytes; this is the real size on the wire.
  const attachedBytes = attachments.reduce((sum, a) => sum + Math.floor(a.contentBytes.length * 0.75), 0)
  if (attachedBytes > ATTACHMENT_LIMIT_BYTES) {
    return NextResponse.json(
      {
        error: `Attachments total ${(attachedBytes / 1024 / 1024).toFixed(1)}MB. The limit is 2.5MB — for anything larger, attach a brochure instead, which sends as a link.`,
      },
      { status: 413 },
    )
  }

  const service = getServiceClient()
  if (!service) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  try {
    // The recipient is resolved BEFORE the message is built, not after. The
    // branded signature and the unsubscribe link are personalised from this
    // contact, and you cannot personalise an email with somebody you look up
    // once it has already gone.
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
        // Not fatal, and deliberately so: the message is still worth sending.
        // It goes out with the merge tags falling back to their defaults and
        // no unsubscribe link, rather than not going at all.
        console.error('outlook send: could not create contact for', to, createError.message)
      } else {
        contact = created
      }
    }

    const contactId = (contact as { id: string } | null)?.id ?? null

    // Minted before the message is built, so a Stripe failure stops the send
    // rather than producing an email with a dead Pay button. The session is
    // harmless if the send then fails — it simply expires unused, and the
    // invoice is only marked sent once the mail has actually gone.
    const payment = body.invoiceId
      ? await createInvoicePaymentLink(service, body.invoiceId)
      : null

    // Through the same branding and the same block renderer every campaign
    // uses, so a message sent from the mailbox is indistinguishable from one
    // sent from a campaign.
    const composed = await buildComposedEmail(service, {
      senderUserId: user.id,
      contactId,
      origin: request.nextUrl.origin,
      subject: subject ?? '',
      slots: await getBrandingSlots(),
      parts: {
        note: content,
        templateId: body.templateId,
        brochureId: body.brochureId,
        payment: payment && {
          payUrl: payment.payUrl,
          invoiceNumber: payment.invoiceNumber,
          description: payment.description,
          amount: payment.amount,
          currency: payment.currency,
          dueDate: payment.dueDate,
        },
      },
    })

    if (!composed.subject.trim()) {
      return NextResponse.json({ error: 'A subject is required.' }, { status: 400 })
    }

    const result = await sendNewMessage(service, user.id, {
      to,
      subject: composed.subject,
      body: composed.html,
      cc: body.cc,
      attachments,
    })

    // Only now: the mail has gone. Flipping the invoice before the send would
    // mark it sent on an email that failed.
    if (payment) await markInvoiceSent(service, payment)

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
      usedTemplate: composed.usedTemplate,
      usedBrochure: composed.usedBrochure,
      usedInvoice: composed.usedInvoice,
      contact: contact
        ? {
            id: (contact as { id: string }).id,
            name: `${first} ${last}`.trim() || to,
            hasDeal,
          }
        : null,
    })
  } catch (err) {
    if (err instanceof InvoicePaymentError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
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
