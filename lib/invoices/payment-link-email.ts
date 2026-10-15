import { formatSender, sendEmail, sesAvailable } from '@/lib/email/ses'

/**
 * The "here is your invoice, pay here" email.
 *
 * One template, two senders: an admin pressing Send on an invoice
 * (app/api/invoices/[id]/send-with-link) and the public website checkout
 * (app/api/public/deposit), which had no email at all — it inserted the
 * invoice with status 'sent' and a sent_at stamp and sent nothing, so the
 * CRM showed "Sent" against an invoice the payer had never been told about.
 *
 * Both callers follow the same rule: send FIRST, and only mark the invoice
 * 'sent' once Resend confirms. Resend's SDK reports API failures (rate limit,
 * unverified domain, invalid recipient) as a returned `error` property rather
 * than by throwing, so a caller that ignores the result lies about delivery.
 */

export interface PaymentLinkEmailInput {
  invoiceNumber: string
  description: string | null
  amount: number
  currency: string | null
  dueDate: string
  /** Who the email is addressed to — the player, or their guardian. */
  recipientName: string
  /** The player the invoice is for; shown only when a guardian is paying. */
  playerName: string
  recipientType: 'player' | 'guardian'
  /** Stripe Checkout URL for this invoice. */
  payUrl: string
}

export function formatInvoiceAmount(amount: number, currency: string | null): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount)
}

export function buildPaymentLinkEmail(input: PaymentLinkEmailInput): { subject: string; html: string } {
  const formattedAmount = formatInvoiceAmount(input.amount, input.currency)
  const dueDate = new Date(input.dueDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return {
    subject: `Invoice ${input.invoiceNumber} - ${formattedAmount} Due`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e40af; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Invoice from IFG</h1>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${input.invoiceNumber}</p>
          </div>
          <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
            <p>Hi ${input.recipientName},</p>
            ${
              input.recipientType === 'guardian'
                ? `<p style="color: #64748b; font-size: 13px;">This invoice is for ${input.playerName}.</p>`
                : ''
            }
            <p>You have a new invoice from The International Football Group. Please find the details below:</p>

            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Invoice Number</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">${input.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Description</td>
                  <td style="padding: 8px 0; text-align: right;">${input.description || '-'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Due Date</td>
                  <td style="padding: 8px 0; text-align: right;">${dueDate}</td>
                </tr>
                <tr style="border-top: 2px solid #e2e8f0;">
                  <td style="padding: 16px 0 8px; color: #64748b; font-weight: bold;">Amount Due</td>
                  <td style="padding: 16px 0 8px; text-align: right; font-weight: bold; font-size: 28px; color: #1e40af;">${formattedAmount}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${input.payUrl}" style="display: inline-block; background: #1e40af; color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
                Pay Now
              </a>
            </div>

            <p style="color: #64748b; font-size: 13px; text-align: center;">
              Click the button above to make a secure payment via Stripe.<br/>
              This link will expire in 24 hours.
            </p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">
              The International Football Group<br/>
              If you have any questions, please contact us at info@theinternationalfootballgroup.com
            </p>
          </div>
        </div>
      `,
  }
}

export type SendPaymentLinkResult =
  | { ok: true; id: string | null }
  | { ok: false; message: string }

/**
 * buildInvoiceMessageId used to live here. It built
 * <tracking_id@reply.domain> so a reply's In-Reply-To could be looked up in
 * email_sends.tracking_id. SES assigns its own Message-ID and refuses ours, on
 * both the structured and the raw APIs, so the header never reached the
 * recipient and the function could only mislead whoever found it.
 */

/** `reply.<domain>`, however INBOUND_REPLY_DOMAIN happens to be written. */
function replyDomain(): string {
  const domain = (process.env.INBOUND_REPLY_DOMAIN ?? '').trim().replace(/^@+/, '')
  if (!domain) return 'reply.local'
  return domain.startsWith('reply.') ? domain : `reply.${domain}`
}

/**
 * The tracked Reply-To, mirroring buildReplyToAddress in
 * supabase/functions/_shared/message-id.ts (duplicated because that module is
 * Deno and this one is Node).
 *
 * It MUST be this address and not a staff mailbox. Only
 * reply.<domain> is pointed at Resend inbound, which feeds the CRM's reply
 * handler; staff mail on the main domain goes to Outlook, so a reply sent there
 * lands in a personal inbox and the CRM never sees it. That is exactly why
 * replies to invoice emails went missing while replies to ordinary automation
 * emails arrived in seconds (QA-28).
 *
 * Returns null when INBOUND_REPLY_DOMAIN is unset, so the caller can fall back
 * to a real mailbox rather than send a tracked address that would bounce.
 */
export function buildInvoiceReplyTo(trackingId: string, displayName?: string | null): string | null {
  const raw = (process.env.INBOUND_REPLY_DOMAIN ?? '').trim()
  if (!raw) return null
  const address = `replies+${trackingId}@${replyDomain()}`
  const safeName = displayName?.replace(/[\r\n]+/g, ' ').trim()
  if (!safeName) return address
  return `"${safeName.replace(/(["\\])/g, '\\$1')}" <${address}>`
}

export async function sendPaymentLinkEmail(
  recipientEmail: string,
  input: PaymentLinkEmailInput,
  /**
   * Makes the email part of the conversation instead of a dead end.
   *
   * QA-28 new issue: a player who replied to "Invoice IFG-2026-00171 - £2,000
   * Due" — to query the amount, or report a payment problem — was never
   * captured, matched or shown on the deal. The invoice email went out with no
   * reply-to and no recognisable Message-ID, so the reply landed in the admin@
   * mailbox and the CRM never saw it. Every automation email already carries
   * both, which is why replies to those arrive within seconds.
   *
   * `trackingId` must be the same value written to email_sends.tracking_id, and
   * `replyTo` should be a mailbox somebody actually reads — the deal owner, as
   * the automation path does.
   *
   * ON SES, THE MESSAGE-ID HALF OF THIS NO LONGER WORKS. SES assigns its own
   * Message-ID and refuses ours, so a reply's In-Reply-To cannot carry the
   * tracking id. Replies arrive in the deal owner's mailbox and are ingested
   * by the Outlook integration instead, matched on sender address. Exact
   * tracking returns with SES inbound receiving, when the sub-addressed
   * Reply-To below can be used safely.
   */
  tracking?: { trackingId: string; replyTo?: string | null; replyToName?: string | null },
): Promise<SendPaymentLinkResult> {
  if (!sesAvailable()) return { ok: false, message: 'Email service not configured' }

  const { subject, html } = buildPaymentLinkEmail(input)
  const fromEmail = process.env.FROM_EMAIL || 'admin@theinternationalfootballgroup.com'

  // The tracked sub-address is only safe once SES inbound receiving exists:
  // reply.<domain> already has an MX pointed at SES, so until a receipt rule
  // is in place a reply to it would hard bounce. The deal owner's mailbox is
  // read by a human and ingested by the Outlook integration, which is why it
  // is the one in use.
  const replyTo =
    (tracking ? buildInvoiceReplyTo(tracking.trackingId, tracking.replyToName) : null) ??
    tracking?.replyTo ??
    undefined

  try {
    const { messageId } = await sendEmail({
      from: formatSender(fromEmail, 'IFG'),
      to: recipientEmail,
      replyTo,
      subject,
      html,
    })
    return { ok: true, id: messageId }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Email failed to send' }
  }
}
