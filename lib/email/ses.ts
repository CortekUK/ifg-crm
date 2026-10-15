import { AwsClient } from 'aws4fetch'

/**
 * Sending email through Amazon SES.
 *
 * This replaces Resend. There is one sender in the Next.js runtime (this file)
 * and a mirror of it for the Deno edge functions at
 * supabase/functions/_shared/ses.ts — the same split, and for the same reason,
 * as lib/utils/merge-tags-core.ts and its mirror. Any change here must be made
 * there too.
 *
 * ── THE ONE THING THAT DOES NOT SURVIVE THE MOVE ───────────────────────────
 * SES will not let you set your own Message-ID. It is a disallowed custom
 * header on the v2 API and it is overwritten even on raw MIME sends. The CRM's
 * reply tracking put email_sends.tracking_id inside the Message-ID and read it
 * back out of a reply's In-Reply-To header, so that link is gone.
 *
 * The fallback already in the code carries it: with INBOUND_REPLY_DOMAIN unset
 * the Reply-To is the deal owner's own mailbox, replies land in their Outlook,
 * and the Outlook integration ingests them. Matching is by sender address
 * rather than tracking id — weaker, but not broken. Exact tracking returns
 * when SES inbound receiving is built and Reply-To can safely become
 * <tracking_id>@reply.<domain>.
 *
 * Do NOT set Reply-To to that address before the receipt rule exists: the MX
 * already points at SES, so every reply would hard bounce.
 */

export interface SesConfig {
  region: string
  accessKeyId: string
  secretAccessKey: string
  /** Groups sends for bounce/complaint tracking. Optional but expected. */
  configurationSet?: string
}

export interface SendEmailInput {
  /** `addr` or `Name <addr>`. The domain must be a verified SES identity. */
  from: string
  to: string | string[]
  subject: string
  html: string
  text?: string
  cc?: string[]
  bcc?: string[]
  replyTo?: string | string[]
  /**
   * Extra headers, e.g. List-Unsubscribe. SES refuses the ones it sets
   * itself — Message-ID, Date, From, To, Subject, Reply-To and the rest —
   * and those are dropped here rather than failing the send.
   */
  headers?: Record<string, string>
}

export interface SendEmailResult {
  /** SES's own id. The real header is <id@region.amazonses.com>. */
  messageId: string
}

export class SesError extends Error {
  status: number
  code: string | null
  /** True when retrying could plausibly work: throttling or a 5xx. */
  retryable: boolean
  constructor(message: string, status: number, code: string | null) {
    super(message)
    this.name = 'SesError'
    this.status = status
    this.code = code
    this.retryable = status >= 500 || status === 429 || code === 'TooManyRequestsException'
  }
}

/**
 * Headers SES sets itself and refuses as custom headers.
 *
 * Passing any of these makes the whole call fail with a validation error, so
 * they are filtered out. Message-ID is the one that matters — see the note at
 * the top of this file.
 */
const RESERVED_HEADERS = new Set([
  'bcc', 'cc', 'content-disposition', 'content-type', 'date', 'from',
  'message-id', 'mime-version', 'reply-to', 'return-path', 'subject', 'to',
])

export function getSesConfig(): SesConfig | null {
  const region = process.env.SES_REGION
  const accessKeyId = process.env.SES_ACCESS_KEY_ID
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY
  if (!region || !accessKeyId || !secretAccessKey) return null
  return {
    region,
    accessKeyId,
    secretAccessKey,
    configurationSet: process.env.SES_CONFIGURATION_SET || undefined,
  }
}

/** True when this deployment can send through SES. */
export function sesAvailable(): boolean {
  return getSesConfig() !== null
}

const asArray = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []

/**
 * Send one email.
 *
 * Throws SesError on failure rather than returning a result object. Resend's
 * SDK returned `{ data, error }` and did NOT throw on API errors, which is how
 * invoices once got marked "sent" on emails that never left — the result was
 * never inspected. Throwing makes that impossible to repeat by accident.
 */
export async function sendEmail(
  input: SendEmailInput,
  config?: SesConfig,
): Promise<SendEmailResult> {
  const cfg = config ?? getSesConfig()
  if (!cfg) throw new SesError('SES is not configured on this deployment.', 500, 'NotConfigured')

  const to = asArray(input.to)
  if (!to.length) throw new SesError('No recipient.', 400, 'NoRecipient')

  const headers = Object.entries(input.headers ?? {})
    .filter(([name]) => !RESERVED_HEADERS.has(name.toLowerCase()))
    .map(([Name, Value]) => ({ Name, Value }))

  const body = {
    FromEmailAddress: input.from,
    Destination: {
      ToAddresses: to,
      ...(input.cc?.length ? { CcAddresses: input.cc } : {}),
      ...(input.bcc?.length ? { BccAddresses: input.bcc } : {}),
    },
    ...(asArray(input.replyTo).length ? { ReplyToAddresses: asArray(input.replyTo) } : {}),
    ...(cfg.configurationSet ? { ConfigurationSetName: cfg.configurationSet } : {}),
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: input.html, Charset: 'UTF-8' },
          // A text part is not decoration: a message with no plain-text
          // alternative scores worse with spam filters, and some corporate
          // gateways strip HTML entirely and show an empty email.
          ...(input.text ? { Text: { Data: input.text, Charset: 'UTF-8' } } : {}),
        },
        ...(headers.length ? { Headers: headers } : {}),
      },
    },
  }

  const aws = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: 'ses',
    region: cfg.region,
  })

  const res = await aws.fetch(
    `https://email.${cfg.region}.amazonaws.com/v2/email/outbound-emails`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )

  const payload = (await res.json().catch(() => ({}))) as {
    MessageId?: string
    message?: string
    Message?: string
    __type?: string
  }

  if (!res.ok || !payload.MessageId) {
    throw new SesError(
      payload.message || payload.Message || `SES rejected the message (${res.status})`,
      res.status,
      payload.__type ?? null,
    )
  }

  return { messageId: payload.MessageId }
}

/**
 * `Name <addr>` when a name is given, otherwise the bare address.
 *
 * A display name containing a comma or a quote has to be quoted or the header
 * parses as two recipients — "Bibby, Nathan <n@…>" becomes a send to "Bibby"
 * and SES rejects the lot.
 */
export function formatSender(email: string, name?: string | null): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return email
  const escaped = trimmed.replace(/["\\]/g, '\\$&')
  return /[",;:<>@[\]]/.test(trimmed) ? `"${escaped}" <${email}>` : `${trimmed} <${email}>`
}
