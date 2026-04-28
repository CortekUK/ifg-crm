import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve the player's contact id — guardians map to their linked player.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, contact_id, guardian_for_contact_id')
      .eq('id', user.id)
      .single()

    const playerContactId =
      profile?.contact_id ?? profile?.guardian_for_contact_id ?? null

    if (profile?.role !== 'player' || !playerContactId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { invoice_id } = await request.json()

    if (!invoice_id) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 })
    }

    // Fetch invoice and verify ownership
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, invoice_number, description, amount, currency, status, contact_id')
      .eq('id', invoice_id)
      .eq('contact_id', playerContactId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 })
    }

    if (invoice.status === 'cancelled') {
      return NextResponse.json({ error: 'Invoice is cancelled' }, { status: 400 })
    }

    // Get contact email
    const { data: contact } = await supabase
      .from('contacts')
      .select('email, first_name, last_name')
      .eq('id', playerContactId)
      .single()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: (invoice.currency || 'gbp').toLowerCase(),
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: invoice.description || undefined,
            },
            unit_amount: Math.round(invoice.amount * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/portal/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/portal/payments/cancelled?invoice_id=${invoice_id}`,
      customer_email: contact?.email || user.email || undefined,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        contact_id: playerContactId,
      },
    })

    // Save checkout session ID on invoice
    await supabase
      .from('invoices')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', invoice_id)

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
