// Public payment page redirect.
// /pay/<invoice_id> resolves the invoice to its Stripe Checkout Session
// URL and 307s the visitor over. If the existing session has expired (or
// none exists yet), a fresh one is minted and stamped onto the invoice.
//
// No auth required — players reach this via copy-payment-link without
// being signed in. We use the service-role client to bypass RLS for the
// invoice + contact lookup, but only enough fields to build the
// Checkout Session.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, createCheckoutSession } from '@/lib/stripe'
import { getPublishedTerms, programmeFromPipelineName } from '@/lib/website-content/terms'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: invoiceId } = await params

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    return new NextResponse('Server misconfigured: Supabase env missing', { status: 500 })
  }
  const supabase = createClient(url, serviceRoleKey)

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, description, amount, currency, status, contact_id, stripe_checkout_session_id, recipient_type, deal:deals(pipeline:pipelines(name))')
    .eq('id', invoiceId)
    .single()

  if (error || !invoice) {
    return new NextResponse('Invoice not found', { status: 404 })
  }

  if (invoice.status === 'paid') {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    return NextResponse.redirect(`${appUrl}/portal/payments/success?invoice_id=${invoiceId}`, 303)
  }
  if (invoice.status === 'cancelled') {
    return new NextResponse('This invoice has been cancelled.', { status: 410 })
  }

  // Try to reuse the existing Stripe session — saves an API roundtrip
  // and keeps the same payment URL for retries. If the session is in any
  // non-open state (paid via another flow, expired, etc.), we mint a
  // fresh one.
  let sessionUrl: string | null = null
  if (invoice.stripe_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        invoice.stripe_checkout_session_id,
      )
      if (existing.status === 'open' && existing.url) {
        sessionUrl = existing.url
      }
    } catch (err) {
      console.warn('Could not retrieve existing Stripe session, creating new:', err)
    }
  }

  if (!sessionUrl) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('email, first_name, last_name, parent_email')
      .eq('id', invoice.contact_id)
      .single()
    if (!contact) {
      return new NextResponse('Contact not found for this invoice', { status: 404 })
    }

    const recipientType = invoice.recipient_type || 'player'
    const customerEmail =
      recipientType === 'guardian'
        ? contact.parent_email || contact.email
        : contact.email

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

    const pipelineName = (invoice.deal as { pipeline?: { name?: string } } | null)?.pipeline?.name
    const terms = await getPublishedTerms(supabase, programmeFromPipelineName(pipelineName))

    const session = await createCheckoutSession({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: (invoice.currency || 'gbp').toLowerCase(),
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: invoice.description || undefined,
            },
            unit_amount: Math.round(Number(invoice.amount) * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/portal/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/portal/payments/cancelled?invoice_id=${invoiceId}`,
      customer_email: customerEmail || undefined,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        contact_id: invoice.contact_id,
      },
    }, terms)

    await supabase
      .from('invoices')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', invoiceId)

    sessionUrl = session.url ?? null
  }

  if (!sessionUrl) {
    return new NextResponse('Failed to generate payment link', { status: 500 })
  }

  return NextResponse.redirect(sessionUrl, 307)
}
