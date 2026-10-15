import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Amazon SES delivery events, via SNS.
 *
 * Replaces /api/webhooks/resend. SES publishes Send, Delivery, Bounce,
 * Complaint and Reject to an SNS topic, which POSTs them here.
 *
 * WHY THIS ENDPOINT MATTERS MORE THAN THE RESEND ONE DID: SES suspends an
 * account above 5% bounces or 0.1% complaints, and it does not warn first.
 * Without this, the first sign of trouble is sending being switched off for
 * the whole business. It is also what keeps a dead address from being mailed
 * again next week, which is how a bounce rate climbs in the first place.
 *
 * SIGNATURES ARE VERIFIED, NOT ASSUMED. This URL is public and its effects are
 * destructive — it marks addresses invalid and unsubscribes people. Anyone who
 * found it could otherwise post a complaint for every contact in the business
 * and silently empty the mailing list.
 */

interface SnsEnvelope {
  Type: string
  MessageId: string
  TopicArn?: string
  Subject?: string
  Message: string
  Timestamp: string
  SignatureVersion: string
  Signature: string
  SigningCertURL: string
  SubscribeURL?: string
  Token?: string
}

/** The fields SNS signs, in the order it signs them. */
const SIGNED_FIELDS: Record<string, string[]> = {
  Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
  SubscriptionConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
  UnsubscribeConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
}

/**
 * Is this really from SNS?
 *
 * The certificate URL is checked against Amazon's own hosts before it is
 * fetched — without that, a forged message could point us at any server and
 * we would validate its signature against the attacker's own certificate.
 */
async function verifySnsSignature(envelope: SnsEnvelope): Promise<boolean> {
  const fields = SIGNED_FIELDS[envelope.Type]
  if (!fields) return false

  let certUrl: URL
  try {
    certUrl = new URL(envelope.SigningCertURL)
  } catch {
    return false
  }
  if (
    certUrl.protocol !== 'https:' ||
    !/^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(certUrl.hostname) ||
    !certUrl.pathname.endsWith('.pem')
  ) {
    return false
  }

  const payload = fields
    .filter((f) => envelope[f as keyof SnsEnvelope] !== undefined)
    .map((f) => `${f}\n${envelope[f as keyof SnsEnvelope]}\n`)
    .join('')

  try {
    const pem = await fetch(certUrl.toString(), { cache: 'no-store' }).then((r) => r.text())
    const algorithm = envelope.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1'
    return crypto
      .createVerify(algorithm)
      .update(payload, 'utf8')
      .verify(pem, envelope.Signature, 'base64')
  } catch {
    return false
  }
}

interface SesEvent {
  eventType?: string
  notificationType?: string
  mail?: { messageId?: string; destination?: string[] }
  bounce?: {
    bounceType?: string
    bounceSubType?: string
    bouncedRecipients?: { emailAddress?: string; diagnosticCode?: string }[]
  }
  complaint?: { complainedRecipients?: { emailAddress?: string }[]; complaintFeedbackType?: string }
  delivery?: { timestamp?: string }
}

/**
 * Recipient addresses from an SES event, escaped for ilike.
 *
 * _ and % are wildcards there and underscores are ordinary in addresses, so an
 * unescaped one would unsubscribe people who merely look similar.
 */
function addressesOf(list: { emailAddress?: string }[] | undefined): string[] {
  return (list ?? [])
    .map((r) => r.emailAddress)
    .filter(Boolean)
    .map((a) => (a as string).replace(/[%_\\]/g, (c) => `\\${c}`))
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(request: NextRequest) {
  const raw = await request.text()

  let envelope: SnsEnvelope
  try {
    envelope = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!(await verifySnsSignature(envelope))) {
    console.warn('ses-events: rejected a message with a bad SNS signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  // If the topic is pinned, anything from another topic is refused. Optional,
  // because the subscription has to be confirmed before the ARN is known.
  const expectedTopic = process.env.SES_SNS_TOPIC_ARN
  if (expectedTopic && envelope.TopicArn && envelope.TopicArn !== expectedTopic) {
    return NextResponse.json({ error: 'Unexpected topic' }, { status: 403 })
  }

  // SNS will not deliver anything until the subscription is confirmed, and it
  // confirms by us fetching the URL it sends. Miss this and the topic silently
  // never delivers.
  if (envelope.Type === 'SubscriptionConfirmation' && envelope.SubscribeURL) {
    try {
      await fetch(envelope.SubscribeURL, { cache: 'no-store' })
      console.log('ses-events: SNS subscription confirmed for', envelope.TopicArn)
    } catch (err) {
      console.error('ses-events: could not confirm the SNS subscription', err)
    }
    return NextResponse.json({ confirmed: true })
  }

  if (envelope.Type !== 'Notification') return NextResponse.json({ received: true })

  let event: SesEvent
  try {
    event = JSON.parse(envelope.Message)
  } catch {
    return NextResponse.json({ received: true, skipped: 'unparseable message' })
  }

  const supabase = serviceClient()
  if (!supabase) {
    // 200 anyway: a configuration fault here must not make SNS retry forever.
    console.error('ses-events: no service client')
    return NextResponse.json({ received: true })
  }

  const type = event.eventType ?? event.notificationType
  const messageId = event.mail?.messageId
  if (!type || !messageId) return NextResponse.json({ received: true })

  // The column is still called resend_message_id — it holds whichever provider
  // sent the message, and renaming it is a migration for another day.
  //
  // Looked up twice, because the event can beat the row. Every send path gets
  // a message id back from SES and only THEN writes email_sends; SES can
  // deliver and publish inside a second, and SNS arrives just as fast. A
  // Delivery event for a fast recipient was arriving before the row existed
  // and being dropped — observed against SES's own mailbox simulator, where
  // bounces and complaints landed and the instant delivery did not. One short
  // retry closes the window without making SNS wait.
  const findSend = async () => {
    const { data } = await supabase
      .from('email_sends')
      .select('id, status, recipient_contact_id')
      .eq('resend_message_id', messageId)
      .maybeSingle()
    return data as { id: string; status: string; recipient_contact_id: string | null } | null
  }

  let row = await findSend()
  if (!row) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    row = await findSend()
  }

  // Terminal states are never walked back. A Delivery notification arriving
  // after a Complaint must not erase the complaint.
  const RANK: Record<string, number> = {
    sent: 0, delivered: 1, opened: 2, clicked: 3, bounced: 99, complained: 99, failed: 99,
  }

  /**
   * Move the row forward, never backward — enforced in the UPDATE itself.
   *
   * Reading the status and then writing it is a race, and SES exercises it:
   * a complaint and a delivery for the same message arrive at the same moment,
   * both read "sent", and whichever writes last wins. Observed in testing —
   * a complained message ended up marked delivered, with the complaint's own
   * error_message still on it.
   *
   * `in('status', ...)` makes the guard part of the statement, so the second
   * writer matches no rows instead of overwriting the first.
   */
  const setStatus = async (status: string, patch: Record<string, unknown> = {}) => {
    if (!row) return
    const incoming = RANK[status] ?? 0
    const overtakeable = Object.keys(RANK).filter((s) => (RANK[s] ?? 0) < incoming)
    if (!overtakeable.length) return
    await supabase
      .from('email_sends')
      .update({ status, ...patch })
      .eq('id', row.id)
      .in('status', overtakeable)
  }

  switch (type) {
    case 'Delivery':
      await setStatus('delivered', { delivered_at: new Date().toISOString() })
      break

    case 'Bounce': {
      const permanent = event.bounce?.bounceType === 'Permanent'
      const reason =
        event.bounce?.bouncedRecipients?.[0]?.diagnosticCode ||
        `${event.bounce?.bounceType ?? 'Bounce'} / ${event.bounce?.bounceSubType ?? 'unknown'}`

      await setStatus('bounced', {
        bounced_at: new Date().toISOString(),
        error_message: reason.slice(0, 500),
      })

      // Only a PERMANENT bounce condemns the address. A transient one is a
      // full mailbox or a server having a bad morning, and stopping those
      // would quietly drop reachable people off the list.
      //
      // Recorded on subscription_status, not on an email_valid column: that
      // column does not exist. /api/webhooks/resend has been writing to it
      // since it was built and every one of those writes has failed silently,
      // which is why no bounced contact has ever been marked.
      if (permanent) {
        const stop = {
          email_subscribed: false,
          subscription_status: 'bounced',
          unsubscribed_at: new Date().toISOString(),
        }
        for (const address of addressesOf(event.bounce?.bouncedRecipients)) {
          await supabase.from('contacts').update(stop).ilike('email', address)
        }
        if (row?.recipient_contact_id) {
          await supabase.from('contacts').update(stop).eq('id', row.recipient_contact_id)
        }
      }
      break
    }

    case 'Complaint': {
      await setStatus('complained', { error_message: event.complaint?.complaintFeedbackType ?? 'Marked as spam' })

      // Someone pressing "this is spam" is an unsubscribe with consequences.
      // 0.1% of these and SES stops the account, so it is honoured everywhere
      // the address appears, not just on the contact this send was keyed to.
      const stop = {
        email_subscribed: false,
        subscription_status: 'complained',
        unsubscribed_at: new Date().toISOString(),
      }
      for (const address of addressesOf(event.complaint?.complainedRecipients)) {
        await supabase.from('contacts').update(stop).ilike('email', address)
      }
      if (row?.recipient_contact_id) {
        await supabase.from('contacts').update(stop).eq('id', row.recipient_contact_id)
      }
      break
    }

    case 'Reject':
      await setStatus('failed', { error_message: 'Rejected by SES before sending' })
      break

    default:
      break
  }

  return NextResponse.json({ received: true, type, matched: !!row })
}

/** SNS also probes with GET when a subscription is being set up by hand. */
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'ses-events' })
}
