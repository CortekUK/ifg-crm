import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/stripe'
import { getTermsForInvoice } from '@/lib/website-content/terms'
import { formatInvoiceAmount, sendPaymentLinkEmail } from '@/lib/invoices/payment-link-email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get invoice with contact
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, invoice_number, description, amount, currency, status, due_date, contact_id, deal_id, recipient_type, deal:deals(pipeline:pipelines(name))')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Get contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name, parent_email, parent_name')
      .eq('id', invoice.contact_id)
      .single()

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Resolve who the email goes to. Either party can still pay — Stripe
    // checkout is keyed off the invoice metadata, not the recipient address.
    const recipientType = invoice.recipient_type || 'player'
    const recipientEmail =
      recipientType === 'guardian'
        ? contact.parent_email || contact.email
        : contact.email
    const recipientName =
      recipientType === 'guardian'
        ? contact.parent_name || `${contact.first_name} ${contact.last_name}`
        : `${contact.first_name} ${contact.last_name}`

    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'No recipient email available for this invoice' },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ifg-crm.vercel.app'
    const formattedAmount = formatInvoiceAmount(invoice.amount, invoice.currency)

    const terms = await getTermsForInvoice(supabase, {
      pipelineName: (invoice.deal as { pipeline?: { name?: string } } | null)?.pipeline?.name,
      contactId: invoice.contact_id,
    })

    // Create Stripe Checkout Session for the payment link
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
            unit_amount: Math.round(invoice.amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/portal/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/portal/payments/cancelled?invoice_id=${invoiceId}`,
      customer_email: recipientEmail,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        contact_id: contact.id,
      },
    }, terms)

    // Send email FIRST. Resend's SDK returns { data, error } instead of
    // throwing on API errors (rate limit, unverified domain, invalid
    // recipient, etc.), so without inspecting the result we'd silently
    // mark the invoice as 'sent' and tell the user it succeeded — which
    // is exactly the bug we're fixing here. Only after a confirmed
    // delivery do we flip the status, stamp the Stripe session, and
    // auto-move the deal stage.
    const playerName = `${contact.first_name} ${contact.last_name}`

    const sendResult = await sendPaymentLinkEmail(recipientEmail, {
      invoiceNumber: invoice.invoice_number,
      description: invoice.description,
      amount: invoice.amount,
      currency: invoice.currency,
      dueDate: invoice.due_date,
      recipientName,
      playerName,
      recipientType: recipientType === 'guardian' ? 'guardian' : 'player',
      payUrl: session.url!,
    })

    // KEEP the invoice as draft on failure so the user can retry. The Stripe
    // session is harmless — it just sits unused; we don't bill until somebody
    // pays.
    if (!sendResult.ok) {
      console.error('Resend send error:', sendResult.message)
      return NextResponse.json(
        {
          error: `${sendResult.message}. Invoice kept as draft — please retry. Common causes: Resend rate limit, unverified sender domain, or invalid recipient address.`,
        },
        { status: 502 },
      )
    }

    // Email confirmed delivered to Resend. Flip status, stamp the
    // checkout session, and move the deal forward.
    await supabase
      .from('invoices')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        stripe_checkout_session_id: session.id,
      })
      .eq('id', invoiceId)

    if (invoice.deal_id) {
      const { data: deal } = await supabase
        .from('deals')
        .select('id, pipeline_id, current_stage_id')
        .eq('id', invoice.deal_id)
        .single()

      if (deal) {
        const { data: allStages } = await supabase
          .from('pipeline_stages')
          .select('id, name, display_order')
          .eq('pipeline_id', deal.pipeline_id)
          .order('display_order')

        if (allStages) {
          const invoiceSentStage = allStages.find(
            (s) => s.name.toLowerCase().includes('invoice') && s.name.toLowerCase().includes('sent'),
          )
          const currentStageIndex = allStages.findIndex((s) => s.id === deal.current_stage_id)
          const invoiceSentIndex = invoiceSentStage
            ? allStages.findIndex((s) => s.id === invoiceSentStage.id)
            : -1

          if (invoiceSentStage && invoiceSentIndex >= 0 && currentStageIndex < invoiceSentIndex) {
            await supabase
              .from('deals')
              .update({ current_stage_id: invoiceSentStage.id })
              .eq('id', deal.id)
          }
        }
      }
    }

    // Create in-app notification for player
    const { data: playerProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('contact_id', contact.id)
      .eq('role', 'player')
      .single()

    if (playerProfile) {
      await supabase.from('notifications').insert({
        user_id: playerProfile.id,
        type: 'payment',
        title: 'New Invoice',
        message: `Invoice ${invoice.invoice_number} for ${formattedAmount} is ready for payment.`,
        href: '/portal/invoices',
      })
    }

    return NextResponse.json({
      success: true,
      message: `Invoice sent to ${recipientEmail} with payment link`,
      resend_id: sendResult.id,
    })
  } catch (error) {
    console.error('Send invoice with link error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send invoice' },
      { status: 500 }
    )
  }
}
