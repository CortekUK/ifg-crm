// Supabase Edge Function: SES Inbound Reply Handler
//
// How a reply reaches this function:
//
//   player hits reply  ->  replies+<tracking_id>@reply.<domain>
//   MX                 ->  inbound-smtp.<region>.amazonaws.com
//   SES receipt rule   ->  writes the raw message to S3, publishes to SNS
//   SNS                ->  POSTs here
//   here               ->  read from S3, parse the MIME, hand to inbound-core
//
// WHY S3 AND NOT SNS ALONE: SES can put the whole message in the SNS payload,
// which looks simpler and needs no bucket. It also fails above 150KB — so a
// parent attaching a photographed registration form would have their reply
// silently vanish, which is exactly the kind of reply that matters most. S3
// takes any size.
//
// Everything that happens to a reply once parsed is in _shared/inbound-core.ts
// and is shared with the legacy Resend path, so a fix lands in both.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import PostalMime from 'https://esm.sh/postal-mime@4.0.7'
import { handleInboundMessage } from '../_shared/inbound-core.ts'
import { confirmSubscription, verifySnsSignature, type SnsEnvelope } from '../_shared/sns.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

/** The SES "Received" notification. Only the parts we act on. */
interface SesReceiptNotification {
  notificationType?: string
  mail?: {
    timestamp?: string
    source?: string
    messageId?: string
    /** The ENVELOPE recipients — the addresses actually delivered to. */
    destination?: string[]
  }
  receipt?: {
    action?: { type?: string; bucketName?: string; objectKey?: string; topicArn?: string }
    spamVerdict?: { status?: string }
    virusVerdict?: { status?: string }
    spfVerdict?: { status?: string }
    dkimVerdict?: { status?: string }
  }
}

// postal-mime's shapes, declared here rather than imported as types: the
// package's .d.ts reaches Deno through an esm.sh header, and a type-only
// import that fails to resolve is a confusing error for no benefit. Only the
// fields actually read are listed.
interface MimeAddress {
  name?: string
  address?: string
  group?: MimeAddress[]
}
interface ParsedEmail {
  headers?: { key: string; value: string }[]
  from?: MimeAddress
  to?: MimeAddress[]
  cc?: MimeAddress[]
  subject?: string
  messageId?: string
  inReplyTo?: string
  references?: string
  date?: string
  html?: string
  text?: string
  attachments?: unknown[]
}

/** Flatten postal-mime's addresses, which may be groups rather than mailboxes. */
function addressList(list: MimeAddress[] | undefined): string[] {
  const out: string[] = []
  for (const entry of list ?? []) {
    if (entry.address) out.push(entry.address)
    for (const member of entry.group ?? []) {
      if (member.address) out.push(member.address)
    }
  }
  return out
}

/**
 * Read the raw message SES stored.
 *
 * Uses the same IAM user as outbound sending, which needs s3:GetObject on this
 * bucket. Without that permission every reply is received, stored by SES and
 * then dropped here — so the failure logs loudly rather than returning empty.
 */
async function fetchRawEmail(bucket: string, key: string): Promise<ArrayBuffer | null> {
  const region = Deno.env.get('SES_REGION')
  const accessKeyId = Deno.env.get('SES_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('SES_SECRET_ACCESS_KEY')
  if (!region || !accessKeyId || !secretAccessKey) {
    console.error('ses-inbound: SES/S3 credentials are not configured')
    return null
  }

  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region })
  const path = key.split('/').map(encodeURIComponent).join('/')
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${path}`

  const res = await aws.fetch(url, { method: 'GET' })
  if (!res.ok) {
    console.error(
      `ses-inbound: S3 GET ${bucket}/${key} failed ${res.status}:`,
      (await res.text().catch(() => '')).slice(0, 400),
    )
    return null
  }
  return await res.arrayBuffer()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const raw = await req.text()

    let envelope: SnsEnvelope
    try {
      envelope = JSON.parse(raw)
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    if (!(await verifySnsSignature(envelope))) {
      console.warn('ses-inbound: rejected a message with a bad SNS signature')
      return json({ error: 'Invalid signature' }, 403)
    }

    // A valid signature only proves SNS sent it — any AWS account's topic
    // would verify. Pinning the ARN is what proves it is OUR topic. Optional,
    // because the subscription has to be confirmed before the ARN is known.
    const expectedTopic = Deno.env.get('SES_INBOUND_SNS_TOPIC_ARN')
    if (expectedTopic && envelope.TopicArn && envelope.TopicArn !== expectedTopic) {
      console.warn('ses-inbound: refused an unexpected topic', envelope.TopicArn)
      return json({ error: 'Unexpected topic' }, 403)
    }

    if (envelope.Type === 'SubscriptionConfirmation') {
      await confirmSubscription(envelope)
      return json({ confirmed: true }, 200)
    }
    if (envelope.Type !== 'Notification') return json({ received: true }, 200)

    let notification: SesReceiptNotification
    try {
      notification = JSON.parse(envelope.Message)
    } catch {
      return json({ received: true, skipped: 'unparseable message' }, 200)
    }

    if (notification.notificationType !== 'Received') {
      return json({ received: true, skipped: notification.notificationType ?? 'unknown' }, 200)
    }

    // Malware is dropped, not stored. Nothing downstream opens the body, but
    // the attachment would sit in our bucket and the alert email would carry
    // the sender's text to a recruiter.
    if (notification.receipt?.virusVerdict?.status === 'FAIL') {
      console.warn('ses-inbound: dropped a message that failed the virus check')
      return json({ received: true, dropped: 'virus' }, 200)
    }
    // Spam is NOT dropped. The reply address contains a UUID nobody can guess,
    // so unsolicited mail to it is near-impossible, which makes a FAIL here far
    // more likely to be a real player whose mail provider looks bad than actual
    // spam. Losing a reply is the worse error.
    if (notification.receipt?.spamVerdict?.status === 'FAIL') {
      console.log('ses-inbound: message failed the spam check — processing anyway')
    }

    // Where SES put it. The S3 action reports the key directly; the fallback
    // covers a rule whose SNS action is separate from its S3 action, where the
    // key is the message id under whatever prefix the rule was given.
    const action = notification.receipt?.action
    const configuredBucket = Deno.env.get('SES_INBOUND_BUCKET')
    const bucket = action?.bucketName || configuredBucket
    const key =
      action?.objectKey ||
      (notification.mail?.messageId
        ? `${Deno.env.get('SES_INBOUND_PREFIX') ?? ''}${notification.mail.messageId}`
        : null)

    if (!bucket || !key) {
      console.error('ses-inbound: no S3 object to read', JSON.stringify(action ?? {}))
      return json({ received: true, skipped: 'no s3 object' }, 200)
    }
    // Only ever read our own bucket. The notification is attacker-influenced
    // input until this check passes.
    if (configuredBucket && bucket !== configuredBucket) {
      console.warn(`ses-inbound: refused a read of an unexpected bucket ${bucket}`)
      return json({ error: 'Unexpected bucket' }, 403)
    }

    const rawEmail = await fetchRawEmail(bucket, key)
    if (!rawEmail) {
      // 500 on purpose: SNS retries, and the usual cause is a missing IAM
      // permission that someone is about to fix. A 200 would discard the
      // reply for good.
      return json({ error: 'Could not read the stored message' }, 500)
    }

    const email = (await PostalMime.parse(rawEmail)) as ParsedEmail

    const headers: Record<string, string> = {}
    for (const header of email.headers ?? []) {
      // postal-mime lower-cases `key` already; done again so detectAutoReply
      // does not depend on that staying true.
      headers[header.key.toLowerCase()] = header.value
    }

    // postal-mime has already RFC 2047-decoded the display name, so rebuild
    // the From rather than using the raw header. Angle brackets and quotes are
    // stripped out of the name: parseEmailAddress matches `Name <addr>` and a
    // name containing either would make it read the whole string as a bare
    // address.
    const from = email.from
    const fromName = (from?.name ?? '').replace(/["<>]/g, '').trim()
    const fromHeader = from?.address
      ? fromName
        ? `${fromName} <${from.address}>`
        : from.address
      : headers['from'] || notification.mail?.source || ''

    // Envelope recipients FIRST. The VERP tracking id lives in the address the
    // message was actually delivered to, and the To: header does not always
    // contain it — a forward, a Bcc or a mailing list all lose it.
    const to = [
      ...(notification.mail?.destination ?? []),
      ...addressList(email.to),
      ...addressList(email.cc),
    ].filter(Boolean)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    console.log(
      `ses-inbound: processing ${email.messageId ?? '(no message-id)'} from ${fromHeader}` +
        `${email.attachments?.length ? ` with ${email.attachments.length} attachment(s)` : ''}`,
    )

    const outcome = await handleInboundMessage(supabase, {
      from: fromHeader,
      to: to.length ? to : null,
      subject: email.subject ?? null,
      text: email.text ?? null,
      html: email.html ?? null,
      headers,
      inReplyTo: email.inReplyTo ?? headers['in-reply-to'] ?? null,
      references: email.references ?? headers['references'] ?? null,
      messageId: email.messageId ?? headers['message-id'] ?? null,
      receivedAt: notification.mail?.timestamp || email.date || new Date().toISOString(),
    })

    return json(outcome.body, outcome.status)
  } catch (error) {
    console.error('ses-inbound: processing error', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})
