import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import {
  staffAlertEnabled,
  sendStaffAlert,
  ownerEmail,
} from '@/lib/notifications/staff-email'
import {
  PAYMENT_PROGRAMMES,
  isPaymentProgramme,
  CHECKOUT_PLAYER_NAME_KEY,
  CHECKOUT_GENDER_KEY,
  CHECKOUT_GRAD_YEAR_KEY,
} from '@/lib/payments/programmes'
import { computeApplicationRouting, applyRouting } from '@/lib/forms/lead-routing'
import { applyPaymentToDeal } from '@/lib/payments/payment-received'

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
    const programmeKey = session.metadata?.programme_key
    const paymentMode = session.metadata?.payment_mode
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

      // Terms acceptance, recorded against the payment.
      //
      // Stripe reports THAT the box was ticked; the metadata we set at
      // checkout says which programme's terms and which version were on
      // screen. Terms get rewritten, so without the version a payment
      // cannot be tied to the wording that was actually agreed to.
      // Consent is recorded either by Stripe's own tick box, or by the
      // website's deposit dialogue before the customer ever reached Stripe.
      // Trusting only Stripe's field would silently lose the record for every
      // website deposit.
      const consented =
        session.consent?.terms_of_service === 'accepted' ||
        session.metadata?.terms_source === 'website'
      const termsVersion = Number(session.metadata?.terms_version)

      // Update invoice to paid.
      //
      // The result is CHECKED, and a failure aborts the whole handler with a
      // 500 so Stripe redelivers the event.
      //
      // This write failed silently once (IFG-2026-00130, 7 Oct): the payment
      // row was created and the deal moved on, but the invoice stayed "sent"
      // with paid_at null, so the player still appeared to owe £100, the
      // portal offered them a Pay Now button for money they had already sent,
      // and the invoice was heading for "overdue" and a chaser. Nothing
      // logged it, because `await supabase.update()` resolves with an `error`
      // property rather than throwing — so execution simply carried on.
      //
      // Marking the invoice paid is the step every later consequence hangs
      // off (the paid trigger stops the reminder enrolments, deal value
      // recalculates, reporting balances). If it does not land, finishing the
      // rest of this handler produces a half-applied payment, which is worse
      // than doing it again from the top: every write here is keyed on ids
      // from the session, so a redelivery is safe to repeat.
      const { data: paidRows, error: invoiceError } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'stripe',
          stripe_payment_intent_id: paymentIntentId,
          updated_at: new Date().toISOString(),
          ...(consented && {
            terms_programme: session.metadata?.terms_programme ?? null,
            terms_version: Number.isFinite(termsVersion) ? termsVersion : null,
            terms_accepted_at: new Date().toISOString(),
          }),
        })
        .eq('id', invoiceId)
        .select('id')

      // Zero rows is its own failure mode: no error, nothing updated. That is
      // how a mistyped id or a row removed mid-flight looks.
      if (invoiceError || !paidRows?.length) {
        console.error(
          `Stripe webhook: FAILED to mark invoice ${invoiceId} paid — ` +
            `${invoiceError?.message ?? 'matched no rows'}. Session ${session.id}. ` +
            'Returning 500 so Stripe retries; the player is currently shown as still owing.',
        )
        return NextResponse.json({ error: 'Could not mark invoice paid' }, { status: 500 })
      }

      // Website deposits start as email-only contacts. Fill in what Stripe
      // collected before anything below reads the contact's name.
      if (contactId && session.metadata?.source === 'website_deposit') {
        await enrichContactFromCheckout(supabase, contactId, session.metadata?.deal_id ?? null, programmeKey, session)
      }

      // They paid — take them out of the "Abandoned … Deposits" follow-up list
      // for this programme, so it only ever holds people who haven't paid.
      if (contactId && programmeKey) {
        const abandonedList = isPaymentProgramme(programmeKey)
          ? PAYMENT_PROGRAMMES[programmeKey].abandonedList.name
          : 'Abandoned Summer Deposits'
        const { data: list } = await supabase.from('lists').select('id').eq('name', abandonedList).maybeSingle()
        if (list?.id) {
          await supabase.from('contact_lists').delete().eq('contact_id', contactId).eq('list_id', list.id)
        }
      }

      // Full payment → tag the contact "Paid in Full" so full payers are
      // distinguishable from deposit-only payers within the Deposit Paid stage.
      if (contactId && paymentMode === 'full') {
        let { data: tag } = await supabase.from('tags').select('id').eq('name', 'Paid in Full').maybeSingle()
        if (!tag) {
          const { data: created } = await supabase.from('tags').insert({ name: 'Paid in Full', category: 'other' }).select('id').single()
          tag = created ?? null
          if (!tag) {
            const { data: refetched } = await supabase.from('tags').select('id').eq('name', 'Paid in Full').maybeSingle()
            tag = refetched ?? null
          }
        }
        if (tag?.id) {
          await supabase
            .from('contact_tags')
            .upsert({ contact_id: contactId, tag_id: tag.id }, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true })
        }
      }

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
          contactName = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || contact.email
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

        // ---- EMAIL ALERT ----
        // Money arriving is org-wide news, so this goes to the admins who
        // already get the in-app notification, plus the recruiter who owns
        // the player. sendStaffAlert deduplicates, so an admin who is also
        // the deal owner gets one email rather than two.
        if (await staffAlertEnabled(supabase, 'paymentReceived')) {
          const recipients = adminUsers.map((a) => a.email as string).filter(Boolean)

          if (contactId) {
            const { data: ownedDeal } = await supabase
              .from('deals')
              .select('deal_owner_id')
              .eq('contact_id', contactId)
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
              { label: 'Invoice', value: invoice.invoice_number },
              { label: 'Amount', value: formattedAmount },
            ],
            ctaLabel: 'View the invoice',
            ctaPath: '/invoices',
          })
        }
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

        // The second admin email that used to live here has been removed.
        //
        // Every card payment sent each admin TWO alerts for the same money:
        //   "Payment received — £2,000.00 from Hamza QA"   (sendStaffAlert, above)
        //   "Payment Received - IFG-2026-00171"            (this block)
        // Three recipients meant six emails for one payment.
        //
        // The one above is the one to keep. This block looped over the admins
        // directly, so it also ignored the notification settings completely:
        // turning "Payment received" off in Settings → Notifications silenced
        // the first email and this one kept going out — which is the bug this
        // ticket is actually about. sendStaffAlert checks
        // staffAlertEnabled('paymentReceived'), deduplicates its recipient
        // list, and includes the recruiter who owns the player as well as the
        // admins, so nothing is lost by dropping this.
      }

      // ---- AUTO-MOVE DEAL TO "DEPOSIT PAID" ----
      //
      // Shared with the manual Record Payment route, which used to do none of
      // this — see lib/payments/payment-received.ts.
      await applyPaymentToDeal(supabase, invoiceId)

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

interface CheckoutDetails {
  customer_details?: { name?: string | null; phone?: string | null; address?: { country?: string | null } | null } | null
  custom_fields?: { key: string; text?: { value?: string | null } | null; dropdown?: { value?: string | null } | null }[] | null
}

/**
 * Copy the details collected on the Stripe page onto the contact.
 *
 * The cardholder is the payer — usually a parent, not the player — so their
 * name and phone go to parent_name / parent_phone (the phone also fills the
 * contact's main phone if empty), the billing country fills the contact's
 * country, and the "Player full name" custom field becomes the contact's name. Only blank fields are filled:
 * an existing contact's data is never overwritten. Best-effort — a failure
 * here must never stop the payment being recorded.
 */
async function enrichContactFromCheckout(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contactId: string,
  dealId: string | null,
  programmeKey: string | undefined,
  session: CheckoutDetails,
) {
  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('email, first_name, last_name, phone, parent_name, parent_phone, country, gender, graduation_year')
      .eq('id', contactId)
      .single()
    if (!contact) return

    const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')
    const blank = (v: unknown) => !clean(v)

    const field = (key: string) => session.custom_fields?.find((f) => f.key === key)
    const playerName = clean(field(CHECKOUT_PLAYER_NAME_KEY)?.text?.value)
    const genderRaw = clean(field(CHECKOUT_GENDER_KEY)?.dropdown?.value).toLowerCase()
    const gender = genderRaw === 'male' || genderRaw === 'female' ? genderRaw : null
    const yearRaw = Number(clean(field(CHECKOUT_GRAD_YEAR_KEY)?.dropdown?.value))
    const graduationYear = Number.isInteger(yearRaw) && yearRaw >= 1900 && yearRaw <= 2100 ? yearRaw : null
    const payerName = clean(session.customer_details?.name)
    const payerPhone = clean(session.customer_details?.phone)
    // Stripe gives the billing country as an ISO code ("GB"); contacts store
    // the country name ("United Kingdom"), like the website forms do.
    const countryCode = clean(session.customer_details?.address?.country).toUpperCase()
    let country = ''
    if (/^[A-Z]{2}$/.test(countryCode)) {
      try { country = new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ?? '' } catch { country = '' }
    }

    const update: Record<string, string | number> = {}
    if (playerName && blank(contact.first_name) && blank(contact.last_name)) {
      // The player-name question often comes back as a first name only, while
      // the full name sits in the name Stripe collected for the card. A
      // deposit paid as "Hamza" + "Hamza Shafique" was saved as first name
      // "Hamza" and no surname, so recruiters saw a half-named player.
      //
      // Only borrowed when the two clearly refer to the same person — same
      // first word — so a parent paying for their child never overwrites the
      // child's surname with the parent's.
      let full = playerName
      if (!playerName.includes(' ') && payerName && payerName.includes(' ')) {
        const payerFirst = payerName.slice(0, payerName.indexOf(' '))
        if (payerFirst.toLowerCase() === playerName.toLowerCase()) full = payerName
      }
      const cut = full.lastIndexOf(' ')
      update.first_name = cut > 0 ? full.slice(0, cut) : full
      update.last_name = cut > 0 ? full.slice(cut + 1) : ''
    }
    if (payerName && blank(contact.parent_name)) update.parent_name = payerName
    if (payerPhone && blank(contact.parent_phone)) update.parent_phone = payerPhone
    // Also the contact's main phone when they have none, so recruiters have a
    // number to call from the Contacts list; parent_phone records whose it is.
    if (payerPhone && blank(contact.phone)) update.phone = payerPhone
    if (country && blank(contact.country)) update.country = country
    if (gender && blank(contact.gender)) update.gender = gender
    if (graduationYear && !contact.graduation_year) update.graduation_year = graduationYear

    if (Object.keys(update).length) {
      await supabase.from('contacts').update(update).eq('id', contactId)
    }

    // File them into the cohort lists + tags ("ALL MENS", "2027 MENS", gender,
    // year and programme tags) the same way a website form lead is routed.
    // Uses the contact's own values where they already had them.
    const finalGender = (contact.gender as 'male' | 'female' | null) || gender
    const finalYear = Number(contact.graduation_year) || graduationYear
    if (finalGender || finalYear) {
      await applyRouting(
        supabase,
        contactId,
        computeApplicationRouting({
          formId: isPaymentProgramme(programmeKey) ? PAYMENT_PROGRAMMES[programmeKey].formId : '',
          gender: finalGender,
          graduationYear: finalYear || null,
        }),
      )
    }

    // The deal was titled with the email while the name was unknown.
    if (dealId && playerName) {
      const { data: deal } = await supabase.from('deals').select('title').eq('id', dealId).single()
      if (deal && (blank(deal.title) || clean(deal.title).toLowerCase() === clean(contact.email).toLowerCase())) {
        await supabase.from('deals').update({ title: playerName }).eq('id', dealId)
      }
    }
  } catch (err) {
    console.error('Contact enrichment from Stripe failed (payment unaffected):', err)
  }
}
