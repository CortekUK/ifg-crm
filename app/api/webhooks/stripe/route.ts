import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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
    event = JSON.parse(payload)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const invoiceId = session.metadata?.invoice_id
    const contactId = session.metadata?.contact_id
    const paymentIntentId = session.payment_intent

    if (invoiceId) {
      // Check if invoice is still valid (not cancelled/deleted)
      const { data: currentInvoice } = await supabase
        .from('invoices')
        .select('status')
        .eq('id', invoiceId)
        .single()

      if (!currentInvoice || currentInvoice.status === 'cancelled') {
        console.log(`Invoice ${invoiceId} is cancelled/deleted — ignoring payment`)
        return NextResponse.json({ received: true, ignored: true })
      }

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
        })
      }

      // Get invoice and contact details
      const { data: invoice } = await supabase
        .from('invoices')
        .select('invoice_number, amount, currency, description')
        .eq('id', invoiceId)
        .single()

      let contactEmail: string | null = null
      let contactName: string | null = null

      if (contactId) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('email, first_name, last_name')
          .eq('id', contactId)
          .single()

        if (contact) {
          contactEmail = contact.email
          contactName = `${contact.first_name} ${contact.last_name}`
        }
      }

      const formattedAmount = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: invoice?.currency || 'GBP',
      }).format(session.amount_total / 100)

      // ---- IN-APP NOTIFICATIONS ----

      // Notify admin users
      const { data: adminUsers } = await supabase
        .from('profiles')
        .select('id, email')
        .in('role', ['admin', 'super_admin'])
        .eq('is_active', true)

      if (adminUsers && invoice) {
        const notifications = adminUsers.map((admin) => ({
          user_id: admin.id,
          type: 'payment',
          title: 'Payment Received',
          message: `${contactName || 'A player'} paid ${formattedAmount} for invoice ${invoice.invoice_number}.`,
          href: '/invoices',
        }))
        await supabase.from('notifications').insert(notifications)
      }

      // Notify the player
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
            message: `Your payment of ${formattedAmount} for invoice ${invoice.invoice_number} has been confirmed.`,
            href: '/portal/invoices',
          })
        }
      }

      // ---- EMAIL NOTIFICATIONS ----

      const resendApiKey = process.env.RESEND_API_KEY
      if (resendApiKey && invoice) {
        const resend = new Resend(resendApiKey)
        const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'

        // Email to player: payment confirmation
        if (contactEmail) {
          try {
            await resend.emails.send({
              from: `IFG <${fromEmail}>`,
              to: [contactEmail],
              subject: `Payment Confirmed - ${invoice.invoice_number}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #1e40af; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">Payment Confirmed</h1>
                  </div>
                  <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
                    <p>Hi ${contactName || 'there'},</p>
                    <p>We've received your payment. Here are the details:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                      <tr>
                        <td style="padding: 8px 0; color: #64748b;">Invoice</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: bold;">${invoice.invoice_number}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b;">Description</td>
                        <td style="padding: 8px 0; text-align: right;">${invoice.description || '-'}</td>
                      </tr>
                      <tr style="border-top: 2px solid #e2e8f0;">
                        <td style="padding: 12px 0; color: #64748b; font-weight: bold;">Amount Paid</td>
                        <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 20px; color: #16a34a;">${formattedAmount}</td>
                      </tr>
                    </table>
                    <p style="color: #64748b; font-size: 14px;">Thank you for your payment. If you have any questions, please don't hesitate to contact us.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                    <p style="color: #94a3b8; font-size: 12px; text-align: center;">The International Football Group</p>
                  </div>
                </div>
              `,
            })
            console.log(`Payment confirmation email sent to ${contactEmail}`)
          } catch (emailErr) {
            console.error('Failed to send player confirmation email:', emailErr)
          }
        }

        // Email to admins: payment received
        if (adminUsers) {
          for (const admin of adminUsers) {
            try {
              await resend.emails.send({
                from: `IFG CRM <${fromEmail}>`,
                to: [admin.email],
                subject: `Payment Received - ${invoice.invoice_number}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #16a34a; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; font-size: 24px;">Payment Received</h1>
                    </div>
                    <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
                      <p><strong>${contactName || 'A player'}</strong> has paid invoice <strong>${invoice.invoice_number}</strong>.</p>
                      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                        <tr>
                          <td style="padding: 8px 0; color: #64748b;">Player</td>
                          <td style="padding: 8px 0; text-align: right;">${contactName || 'Unknown'} (${contactEmail || '-'})</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b;">Invoice</td>
                          <td style="padding: 8px 0; text-align: right;">${invoice.invoice_number}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b;">Amount</td>
                          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #16a34a;">${formattedAmount}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #64748b;">Method</td>
                          <td style="padding: 8px 0; text-align: right;">Stripe</td>
                        </tr>
                      </table>
                      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://ifg-crm.vercel.app'}/invoices" style="display: inline-block; background: #1e40af; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">View in CRM</a>
                    </div>
                  </div>
                `,
              })
            } catch (emailErr) {
              console.error(`Failed to send admin email to ${admin.email}:`, emailErr)
            }
          }
        }
      }

      // ---- AUTO-MOVE DEAL TO "DEPOSIT PAID" ----

      // Find the deal linked to this invoice
      const { data: invoiceWithDeal } = await supabase
        .from('invoices')
        .select('deal_id')
        .eq('id', invoiceId)
        .single()

      if (invoiceWithDeal?.deal_id) {
        const { data: deal } = await supabase
          .from('deals')
          .select('id, pipeline_id')
          .eq('id', invoiceWithDeal.deal_id)
          .single()

        if (deal) {
          // Find "Deposit Paid" stage
          const { data: depositPaidStage } = await supabase
            .from('pipeline_stages')
            .select('id')
            .eq('pipeline_id', deal.pipeline_id)
            .ilike('name', '%deposit%paid%')
            .single()

          if (depositPaidStage) {
            await supabase
              .from('deals')
              .update({ current_stage_id: depositPaidStage.id })
              .eq('id', deal.id)

            console.log(`Deal ${deal.id} moved to Deposit Paid stage`)
          }
        }
      }

      // ---- AUTO-CREATE PORTAL ACCOUNT ----

      if (contactId && contactEmail) {
        // Check if player already has portal access
        const { data: existingPlayer } = await supabase
          .from('profiles')
          .select('id')
          .eq('contact_id', contactId)
          .eq('role', 'player')
          .single()

        if (!existingPlayer) {
          // Create portal account via Supabase Auth invite
          try {
            const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
              contactEmail,
              {
                data: {
                  full_name: contactName || 'Player',
                  role: 'player',
                  contact_id: contactId,
                },
                redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://ifg-crm.vercel.app'}/auth/callback`,
              }
            )

            if (inviteError) {
              console.error('Failed to create portal account:', inviteError)
            } else {
              console.log(`Portal invite sent to ${contactEmail}`)

              // Record the invite
              try {
                await supabase.from('player_invites').insert({
                  contact_id: contactId,
                  email: contactEmail,
                  invited_by: adminUsers?.[0]?.id || '',
                })
              } catch {}

            }
          } catch (portalErr) {
            console.error('Portal account creation error:', portalErr)
          }
        }
      }

      console.log(`Payment completed for invoice ${invoiceId}`)
    }
  }

  return NextResponse.json({ received: true })
}
