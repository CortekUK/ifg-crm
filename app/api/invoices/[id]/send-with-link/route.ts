import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/stripe'
import { getTermsForInvoice } from '@/lib/website-content/terms'
import { Resend } from 'resend'

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
    const formattedAmount = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: invoice.currency || 'GBP',
    }).format(invoice.amount)

    const dueDate = new Date(invoice.due_date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

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
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'
    const playerName = `${contact.first_name} ${contact.last_name}`

    const sendResult = await resend.emails.send({
      from: `IFG <${fromEmail}>`,
      to: [recipientEmail],
      subject: `Invoice ${invoice.invoice_number} - ${formattedAmount} Due`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e40af; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Invoice from IFG</h1>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${invoice.invoice_number}</p>
          </div>
          <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
            <p>Hi ${recipientName},</p>
            ${
              recipientType === 'guardian'
                ? `<p style="color: #64748b; font-size: 13px;">This invoice is for ${playerName}.</p>`
                : ''
            }
            <p>You have a new invoice from The International Football Group. Please find the details below:</p>

            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Invoice Number</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">${invoice.invoice_number}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Description</td>
                  <td style="padding: 8px 0; text-align: right;">${invoice.description || '-'}</td>
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
              <a href="${session.url}" style="display: inline-block; background: #1e40af; color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
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
    })

    // Resend returns errors as a property, not a throw. Surface them and
    // KEEP the invoice as draft so the user can retry. The Stripe session
    // is harmless — it just sits unused; we don't bill until somebody
    // pays.
    if (sendResult.error) {
      console.error('Resend send error:', sendResult.error)
      const message =
        typeof sendResult.error === 'object' && sendResult.error !== null && 'message' in sendResult.error
          ? String((sendResult.error as { message: unknown }).message)
          : 'Email failed to send'
      return NextResponse.json(
        {
          error: `${message}. Invoice kept as draft — please retry. Common causes: Resend rate limit, unverified sender domain, or invalid recipient address.`,
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
      resend_id: sendResult.data?.id ?? null,
    })
  } catch (error) {
    console.error('Send invoice with link error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send invoice' },
      { status: 500 }
    )
  }
}
