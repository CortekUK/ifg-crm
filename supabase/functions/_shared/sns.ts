// Verifying that an HTTPS POST really came from Amazon SNS.
//
// MIRROR: the same logic lives inline in app/api/webhooks/ses-events/route.ts.
// tsconfig.json excludes supabase/functions/, so the two runtimes cannot share
// an import — the same arrangement as ses.ts and its mirror.
//
// WHY: an SNS endpoint is a public URL with no secret and no shared key, and
// this one's effects are destructive — it writes replies, moves deals and
// emails staff. Anyone who found the URL could otherwise post whatever they
// liked. The signature is the only thing standing in the way.

import crypto from 'node:crypto'

export interface SnsEnvelope {
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
 * The certificate URL is checked against Amazon's own hosts BEFORE it is
 * fetched. Without that, a forged message could point us at any server and we
 * would dutifully validate its signature against the attacker's certificate —
 * which is to say, validate nothing at all.
 */
export async function verifySnsSignature(envelope: SnsEnvelope): Promise<boolean> {
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
  } catch (err) {
    console.error('SNS signature verification threw:', err)
    return false
  }
}

/**
 * Confirm a pending subscription.
 *
 * SNS delivers nothing at all until the URL it sends is fetched. Miss this and
 * the topic looks configured and silently never delivers.
 */
export async function confirmSubscription(envelope: SnsEnvelope): Promise<void> {
  if (!envelope.SubscribeURL) return
  try {
    await fetch(envelope.SubscribeURL, { cache: 'no-store' })
    console.log('SNS subscription confirmed for', envelope.TopicArn)
  } catch (err) {
    console.error('Could not confirm the SNS subscription', err)
  }
}
