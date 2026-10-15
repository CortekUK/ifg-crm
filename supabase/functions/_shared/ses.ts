// Sending email through Amazon SES, from the Deno edge functions.
//
// MIRROR: lib/email/ses.ts
// tsconfig.json excludes supabase/functions/, so this file and its mirror
// cannot share an import. Any change here MUST be made there too — the same
// arrangement as merge-tags-core.ts and _shared/merge-tags.ts.
//
// ── THE ONE THING THAT DOES NOT SURVIVE THE MOVE ───────────────────────────
// SES will not let you set your own Message-ID. It is a disallowed custom
// header on the v2 API and is overwritten even on raw MIME sends. Campaign and
// automation email put email_sends.tracking_id inside the Message-ID so a
// reply's In-Reply-To could be matched back to the send; that link is gone.
//
// Replies now arrive in the deal owner's own mailbox (Reply-To already falls
// back to it) and are ingested by the Outlook integration, matched on sender
// address. Weaker, but not broken. Exact tracking returns when SES inbound
// receiving exists and Reply-To can safely become <tracking_id>@reply.<domain>
// — NOT before, because that MX already points at SES and a reply to it would
// hard bounce with no receipt rule behind it.

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'

export interface SendEmailInput {
  from: string
  to: string | string[]
  subject: string
  html: string
  text?: string
  cc?: string[]
  bcc?: string[]
  replyTo?: string | string[]
  /** Extra headers, e.g. List-Unsubscribe. Reserved ones are dropped. */
  headers?: Record<string, string>
}

export interface SendEmailResult {
  messageId: string
}

export class SesError extends Error {
  status: number
  code: string | null
  retryable: boolean
  constructor(message: string, status: number, code: string | null) {
    super(message)
    this.name = 'SesError'
    this.status = status
    this.code = code
    this.retryable = status >= 500 || status === 429 || code === 'TooManyRequestsException'
  }
}

// Headers SES sets itself. Passing any of them fails the whole call, so they
// are filtered out instead. Message-ID is the one that matters.
const RESERVED_HEADERS = new Set([
  'bcc', 'cc', 'content-disposition', 'content-type', 'date', 'from',
  'message-id', 'mime-version', 'reply-to', 'return-path', 'subject', 'to',
])

export function sesAvailable(): boolean {
  return !!(
    Deno.env.get('SES_REGION') &&
    Deno.env.get('SES_ACCESS_KEY_ID') &&
    Deno.env.get('SES_SECRET_ACCESS_KEY')
  )
}

const asArray = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []

/**
 * Send one email. Throws SesError on any failure.
 *
 * Deliberately throws rather than returning {data, error}: the Resend SDK did
 * the latter and did not throw on API errors, so several callers checked only
 * one of the two failure paths and recorded sends that never happened.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const region = Deno.env.get('SES_REGION')
  const accessKeyId = Deno.env.get('SES_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('SES_SECRET_ACCESS_KEY')
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new SesError('SES is not configured on this deployment.', 500, 'NotConfigured')
  }

  const to = asArray(input.to)
  if (!to.length) throw new SesError('No recipient.', 400, 'NoRecipient')

  const headers = Object.entries(input.headers ?? {})
    .filter(([name]) => !RESERVED_HEADERS.has(name.toLowerCase()))
    .map(([Name, Value]) => ({ Name, Value }))

  const configurationSet = Deno.env.get('SES_CONFIGURATION_SET')

  const body = {
    FromEmailAddress: input.from,
    Destination: {
      ToAddresses: to,
      ...(input.cc?.length ? { CcAddresses: input.cc } : {}),
      ...(input.bcc?.length ? { BccAddresses: input.bcc } : {}),
    },
    ...(asArray(input.replyTo).length ? { ReplyToAddresses: asArray(input.replyTo) } : {}),
    ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: input.html, Charset: 'UTF-8' },
          ...(input.text ? { Text: { Data: input.text, Charset: 'UTF-8' } } : {}),
        },
        ...(headers.length ? { Headers: headers } : {}),
      },
    },
  }

  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 'ses', region })

  const res = await aws.fetch(
    `https://email.${region}.amazonaws.com/v2/email/outbound-emails`,
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
 * `Name <addr>`, quoting the name when it contains anything that would make
 * the header parse as two recipients.
 */
export function formatSender(email: string, name?: string | null): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return email
  const escaped = trimmed.replace(/["\\]/g, '\\$&')
  return /[",;:<>@[\]]/.test(trimmed) ? `"${escaped}" <${email}>` : `${trimmed} <${email}>`
}
