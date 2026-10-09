/**
 * The follow-on effects of a payment that was recorded by hand.
 *
 * Record Payment (bank transfer, cash, "other") wrote a payments row and set
 * the invoice to paid, and stopped there. Everything a card payment triggers
 * in the Stripe webhook — the deal moving to Deposit Paid, the chasing
 * sequences ending, staff being told — never happened. A player who paid by
 * bank transfer therefore kept getting "have you thought about paying your
 * deposit?" emails, and their card stayed in Initial Lead.
 *
 * The write itself still happens from the browser (useCreatePayment); this
 * route is called straight afterwards and only applies the side effects, so
 * the existing payment path is unchanged. It needs the service-role key to
 * stop automations and move a card, so it is gated to admins.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { applyPaymentToDeal } from '@/lib/payments/payment-received'
import {
  staffAlertEnabled,
  sendStaffAlert,
  alertRecipients,
  ownerForPaidInvoice,
} from '@/lib/notifications/staff-email'

export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  let body: { invoiceId?: unknown; contactId?: unknown; amount?: unknown; method?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : null
  const contactId = typeof body.contactId === 'string' ? body.contactId : null
  const amount = typeof body.amount === 'number' ? body.amount : null
  const method = typeof body.method === 'string' ? body.method : 'manual'

  // A payment with no invoice has no deal to move and nothing to stop. That is
  // a legitimate thing to record (an ad-hoc payment), so it is not an error.
  if (!invoiceId) return NextResponse.json({ applied: false, reason: 'no-invoice' })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 })
  }
  const supabase = createClient(url, serviceRoleKey)

  const { data: invoice } = await supabase
    .from('invoices')
    // deal_id decides which recruiter is told about the payment — see
    // ownerForPaidInvoice.
    .select('invoice_number, currency, amount, contact_id, deal_id')
    .eq('id', invoiceId)
    .maybeSingle()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })

  const result = await applyPaymentToDeal(supabase, invoiceId)

  // ---- TELL STAFF ----
  //
  // The person recording it obviously knows. The deal owner, who is the one
  // still chasing the player, usually does not — a bank transfer lands in a
  // finance inbox, not theirs.
  const resolvedContactId = contactId ?? (invoice.contact_id as string | null)
  const formattedAmount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: (invoice.currency as string) || 'GBP',
  }).format(amount ?? (invoice.amount as number) ?? 0)

  let contactName: string | null = null
  if (resolvedContactId) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('first_name, last_name')
      .eq('id', resolvedContactId)
      .maybeSingle()
    if (contact) {
      contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || null
    }
  }

  const methodLabel = method.replace(/_/g, ' ')

  // Same rule as the card-payment path: the owner, or the admins when nobody
  // owns the player. Resolved once and used for both the bell and the email,
  // so a payment recorded by hand notifies the same people as one taken by
  // card (QA-51 Issue 1).
  // The owner of THIS invoice's deal, not of the player's newest one.
  const payingDealOwnerId = await ownerForPaidInvoice(supabase, invoice, resolvedContactId)

  const { data: notifyProfiles } = payingDealOwnerId
    ? await supabase
        .from('profiles')
        .select('id, email')
        .eq('id', payingDealOwnerId)
        .eq('is_active', true)
    : await supabase
        .from('profiles')
        .select('id, email')
        .in('role', ['admin', 'super_admin'])
        .eq('is_active', true)

  if (notifyProfiles?.length) {
    await supabase.from('notifications').insert(
      notifyProfiles.map((who) => ({
        user_id: who.id,
        type: 'payment',
        title: 'Payment Received',
        message: `${contactName || 'A player'} paid ${formattedAmount} for invoice ${invoice.invoice_number} by ${methodLabel}.`,
        href: '/invoices',
      })),
    )

    if (await staffAlertEnabled(supabase, 'paymentReceived')) {
      // The owner, or the admins when nobody owns the player — the rule
      // this alert is documented to follow (QA-51 Issue 1). It used to
      // email every admin on top of the owner, so one QA deposit went to
      // three people and in normal running the admins are copied on every
      // payment for players they do not handle.
      const recipients = await alertRecipients(supabase, payingDealOwnerId)

      await sendStaffAlert({
        to: recipients,
        subject: `Payment received — ${formattedAmount} from ${contactName || 'a player'}`,
        heading: `Payment received — ${formattedAmount}`,
        details: [
          { label: 'From', value: contactName || 'A player' },
          { label: 'Invoice', value: invoice.invoice_number as string },
          { label: 'Amount', value: formattedAmount },
          { label: 'Method', value: methodLabel },
        ],
        ctaLabel: 'View the invoice',
        ctaPath: '/invoices',
      })
    }
  }

  return NextResponse.json({ applied: true, ...result })
}
