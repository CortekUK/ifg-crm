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
import { staffAlertEnabled, sendStaffAlert, ownerEmail } from '@/lib/notifications/staff-email'

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
    .select('invoice_number, currency, amount, contact_id')
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

  const { data: adminUsers } = await supabase
    .from('profiles')
    .select('id, email')
    .in('role', ['admin', 'super_admin'])
    .eq('is_active', true)

  if (adminUsers?.length) {
    await supabase.from('notifications').insert(
      adminUsers.map((admin) => ({
        user_id: admin.id,
        type: 'payment',
        title: 'Payment Received',
        message: `${contactName || 'A player'} paid ${formattedAmount} for invoice ${invoice.invoice_number} by ${methodLabel}.`,
        href: '/invoices',
      })),
    )

    if (await staffAlertEnabled(supabase, 'paymentReceived')) {
      const recipients = adminUsers.map((a) => a.email as string).filter(Boolean)

      if (resolvedContactId) {
        const { data: ownedDeal } = await supabase
          .from('deals')
          .select('deal_owner_id')
          .eq('contact_id', resolvedContactId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const owner = await ownerEmail(supabase, ownedDeal?.deal_owner_id ?? null)
        if (owner) recipients.push(owner)
      }

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
