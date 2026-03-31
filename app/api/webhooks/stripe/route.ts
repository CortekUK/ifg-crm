import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  let event

  // Verify webhook signature if secret is configured
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (webhookSecret && signature) {
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  } else {
    // In development without webhook secret, parse directly
    event = JSON.parse(payload)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const invoiceId = session.metadata?.invoice_id
    const contactId = session.metadata?.contact_id
    const paymentIntentId = session.payment_intent

    if (invoiceId) {
      // Update invoice to paid
      await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'stripe',
          stripe_payment_intent_id: paymentIntentId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)

      // Create payment record
      if (contactId) {
        await supabase.from('payments').insert({
          invoice_id: invoiceId,
          contact_id: contactId,
          amount: session.amount_total / 100,
          payment_date: new Date().toISOString(),
          payment_method: 'stripe',
          stripe_payment_id: paymentIntentId,
          reference: `Stripe Checkout ${session.id}`,
          status: 'successful',
        })
      }

      // Create notification for admin users
      const { data: adminUsers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'super_admin'])
        .eq('is_active', true)

      const { data: invoice } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('id', invoiceId)
        .single()

      if (adminUsers && invoice) {
        const notifications = adminUsers.map((admin) => ({
          user_id: admin.id,
          type: 'payment',
          title: 'Payment Received',
          message: `Invoice ${invoice.invoice_number} has been paid via Stripe.`,
          href: '/invoices',
        }))

        await supabase.from('notifications').insert(notifications)
      }

      // Create notification for the player
      if (contactId) {
        const { data: playerProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('contact_id', contactId)
          .eq('role', 'player')
          .single()

        if (playerProfile && invoice) {
          await supabase.from('notifications').insert({
            user_id: playerProfile.id,
            type: 'payment',
            title: 'Payment Confirmed',
            message: `Your payment for invoice ${invoice.invoice_number} has been confirmed.`,
            href: '/portal/invoices',
          })
        }
      }

      console.log(`Payment completed for invoice ${invoiceId}`)
    }
  }

  return NextResponse.json({ received: true })
}
