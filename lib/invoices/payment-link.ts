import type { SupabaseClient } from '@supabase/supabase-js'
import { createCheckoutSession } from '@/lib/stripe'
import { getTermsForInvoice } from '@/lib/website-content/terms'

/**
 * Creating a Stripe payment link for an invoice, and recording that it went.
 *
 * Lifted out of app/api/invoices/[id]/send-with-link so the mailbox can send
 * a payment link too without a second copy of it. Two copies of a money path
 * is how one of them quietly stops moving the deal, or stops stamping the
 * checkout session, and nobody notices until a parent pays and nothing
 * happens.
 *
 * Every payment in the CRM goes through createCheckoutSession (see lib/stripe)
 * so the Terms & Conditions tick box cannot be forgotten by a new caller —
 * which is exactly what this file would otherwise have become.
 */

export interface InvoicePaymentLink {
  payUrl: string
  sessionId: string
  invoiceId: string
  invoiceNumber: string
  description: string | null
  amount: number
  currency: string | null
  dueDate: string | null
  dealId: string | null
  contactId: string
  recipientEmail: string
  recipientName: string
  playerName: string
  recipientType: 'player' | 'guardian'
}

export class InvoicePaymentError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'InvoicePaymentError'
    this.status = status
  }
}

/**
 * Load an invoice and mint a Stripe Checkout session for it.
 *
 * Does NOT mark the invoice as sent — that only happens once an email has
 * actually gone. An unused session costs nothing and simply expires.
 */
export async function createInvoicePaymentLink(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<InvoicePaymentLink> {
  const { data: invoice } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, description, amount, currency, status, due_date, contact_id, deal_id, recipient_type, deal:deals(pipeline:pipelines(name))',
    )
    .eq('id', invoiceId)
    .maybeSingle()

  if (!invoice) throw new InvoicePaymentError('Invoice not found.', 404)

  const inv = invoice as unknown as {
    id: string
    invoice_number: string
    description: string | null
    amount: number
    currency: string | null
    status: string
    due_date: string | null
    contact_id: string
    deal_id: string | null
    recipient_type: string | null
    deal: { pipeline?: { name?: string } } | null
  }

  if (inv.status === 'paid') throw new InvoicePaymentError('That invoice has already been paid.')
  if (inv.status === 'cancelled') throw new InvoicePaymentError('That invoice has been cancelled.')

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, email, first_name, last_name, parent_email, parent_name')
    .eq('id', inv.contact_id)
    .maybeSingle()
  if (!contact) throw new InvoicePaymentError('The invoice has no contact.', 404)

  const c = contact as {
    id: string
    email: string | null
    first_name: string | null
    last_name: string | null
    parent_email: string | null
    parent_name: string | null
  }

  // Either party can still pay — Stripe checkout is keyed off the invoice
  // metadata, not the recipient address.
  const recipientType = inv.recipient_type === 'guardian' ? 'guardian' : 'player'
  const recipientEmail = recipientType === 'guardian' ? c.parent_email || c.email : c.email
  const playerName = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
  const recipientName =
    recipientType === 'guardian' ? c.parent_name || playerName : playerName

  if (!recipientEmail) throw new InvoicePaymentError('No recipient email available for this invoice.')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ifg-crm.vercel.app'
  const terms = await getTermsForInvoice(supabase, {
    pipelineName: inv.deal?.pipeline?.name,
    contactId: inv.contact_id,
  })

  const session = await createCheckoutSession(
    {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: (inv.currency || 'gbp').toLowerCase(),
            product_data: {
              name: `Invoice ${inv.invoice_number}`,
              description: inv.description || undefined,
            },
            unit_amount: Math.round(inv.amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Public return pages: this link is emailed, and the recipient is often
      // a parent with no CRM login.
      success_url: `${appUrl}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pay/cancelled?invoice_id=${inv.id}`,
      customer_email: recipientEmail,
      metadata: {
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        contact_id: c.id,
      },
    },
    terms,
  )

  if (!session.url) throw new InvoicePaymentError('Stripe did not return a payment link.', 502)

  return {
    payUrl: session.url,
    sessionId: session.id,
    invoiceId: inv.id,
    invoiceNumber: inv.invoice_number,
    description: inv.description,
    amount: inv.amount,
    currency: inv.currency,
    dueDate: inv.due_date,
    dealId: inv.deal_id,
    contactId: c.id,
    recipientEmail,
    recipientName,
    playerName,
    recipientType,
  }
}

/**
 * Record that the payment link has gone out: flip the invoice to sent, stamp
 * the session, and move the deal to "Invoice Sent" if it is behind that.
 *
 * Forward only. A deal already past Invoice Sent is not dragged backwards by
 * resending a link.
 */
export async function markInvoiceSent(
  supabase: SupabaseClient,
  link: Pick<InvoicePaymentLink, 'invoiceId' | 'sessionId' | 'dealId'>,
): Promise<void> {
  await supabase
    .from('invoices')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      stripe_checkout_session_id: link.sessionId,
    })
    .eq('id', link.invoiceId)

  if (!link.dealId) return

  const { data: deal } = await supabase
    .from('deals')
    .select('id, pipeline_id, current_stage_id')
    .eq('id', link.dealId)
    .maybeSingle()
  if (!deal) return

  const { data: allStages } = await supabase
    .from('pipeline_stages')
    .select('id, name, display_order')
    .eq('pipeline_id', (deal as { pipeline_id: string }).pipeline_id)
    .order('display_order')
  if (!allStages) return

  const stages = allStages as { id: string; name: string }[]
  const target = stages.find(
    (s) => s.name.toLowerCase().includes('invoice') && s.name.toLowerCase().includes('sent'),
  )
  if (!target) return

  const currentIndex = stages.findIndex((s) => s.id === (deal as { current_stage_id: string }).current_stage_id)
  const targetIndex = stages.findIndex((s) => s.id === target.id)
  if (targetIndex >= 0 && currentIndex < targetIndex) {
    await supabase.from('deals').update({ current_stage_id: target.id }).eq('id', deal.id)
  }
}
