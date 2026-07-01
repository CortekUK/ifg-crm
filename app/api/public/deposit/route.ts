import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getServiceClient } from '@/lib/forms/process-submission'
import { findOrCreateList } from '@/lib/assistant/capture'
import { stripe } from '@/lib/stripe'

/**
 * Public deposit checkout for the website (Residency & University).
 *
 * Secret-guarded like the other /api/public/* endpoints. Flow:
 *   1. Find/create the contact (source 'website_deposit') so we ALWAYS capture
 *      the lead before they reach Stripe — this is the abandoned-cart record.
 *   2. Create a 'deposit' invoice (£2,000 deposit + card processing fee on top)
 *      so it flows through the existing invoice → webhook → paid pipeline and
 *      shows on the CRM Invoices page. Unpaid deposit invoices = reached
 *      checkout but didn't pay (IFG follow-up list).
 *   3. Create a Stripe Checkout Session and return its URL.
 *
 * The existing Stripe webhook (checkout.session.completed → invoice_id) marks it
 * paid, records the payment, notifies staff and provisions portal access.
 *
 * Env: FORM_INGEST_SECRET (auth), STRIPE_SECRET_KEY, and optionally
 * DEPOSIT_AMOUNT (default 2000), DEPOSIT_FEE_RATE (default 0.035),
 * DEPOSIT_FEE_FIXED (default 0.20), WEBSITE_URL (success/cancel fallback).
 */

export const runtime = 'nodejs'

const PROGRAMMES: Record<string, string> = {
  residency: 'Summer Residency',
  university: 'University Programme',
}

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t.length ? t : undefined
}

// Gross-up the card fee so IFG nets the full deposit. Returns whole-penny values.
function deposit() {
  const base = Number(process.env.DEPOSIT_AMOUNT || 2000)
  const rate = Number(process.env.DEPOSIT_FEE_RATE || 0.035)
  const fixed = Number(process.env.DEPOSIT_FEE_FIXED || 0.2)
  const total = (base + fixed) / (1 - rate)
  const fee = Math.max(0, Math.ceil((total - base) * 100) / 100)
  return { base, fee, total: base + fee }
}

export async function POST(request: NextRequest) {
  const secret = process.env.FORM_INGEST_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Payments are temporarily unavailable.' }, { status: 500 })
  }
  const auth = request.headers.get('authorization') || ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const programmeKey = str(body.programme) || ''
  const programmeName = PROGRAMMES[programmeKey]
  if (!programmeName) {
    return NextResponse.json({ error: 'Unknown programme.' }, { status: 400 })
  }

  const email = str(body.email)?.toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  const name = str(body.name)
  const phone = str(body.phone)

  // Success/cancel return to the website that initiated checkout.
  const originRaw = str(body.origin) || process.env.WEBSITE_URL || ''
  const origin = /^https?:\/\//.test(originRaw) ? originRaw.replace(/\/$/, '') : ''
  if (!origin) {
    return NextResponse.json({ error: 'Payments are temporarily unavailable.' }, { status: 500 })
  }

  const supabase = getServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Payments are temporarily unavailable.' }, { status: 503 })
  }

  try {
    // 1. Find/create contact (capture the lead up front).
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
    const firstName = parts[0] || 'Website'
    const lastName = parts.slice(1).join(' ') || 'Applicant'

    const { data: existing } = await supabase.from('contacts').select('id').eq('email', email).maybeSingle()
    let contactId = existing?.id as string | undefined
    if (contactId) {
      const updates: Record<string, unknown> = {}
      if (parts.length) { updates.first_name = firstName; updates.last_name = lastName }
      if (phone) updates.phone = phone
      if (Object.keys(updates).length) await supabase.from('contacts').update(updates).eq('id', contactId)
    } else {
      const { data: created } = await supabase
        .from('contacts')
        .insert({ email, first_name: firstName, last_name: lastName, phone: phone ?? null, source: 'website_deposit' })
        .select('id')
        .single()
      contactId = created?.id as string | undefined
    }
    if (!contactId) {
      return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
    }

    // Segment for abandoned-cart follow-up.
    const listId = await findOrCreateList(supabase, 'Website Deposits')
    if (listId) {
      await supabase
        .from('contact_lists')
        .upsert({ contact_id: contactId, list_id: listId, added_at: new Date().toISOString() }, { onConflict: 'contact_id,list_id' })
    }

    // 2. Create the deposit invoice. created_by_id must be a real profile.
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['super_admin', 'admin'])
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!adminProfile?.id) {
      return NextResponse.json({ error: 'Payments are temporarily unavailable.' }, { status: 503 })
    }

    const { base, fee, total } = deposit()
    const due = new Date()
    due.setDate(due.getDate() + 7)

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        contact_id: contactId,
        type: 'deposit',
        description: `${programmeName} — deposit to secure your place`,
        amount: total,
        currency: 'GBP',
        status: 'sent',
        sent_at: new Date().toISOString(),
        due_date: due.toISOString().slice(0, 10),
        recipient_type: 'player',
        created_by_id: adminProfile.id,
        notes: `Website deposit checkout (${programmeName}). Deposit £${base.toFixed(2)} + card fee £${fee.toFixed(2)}.`,
      })
      .select('id, invoice_number')
      .single()
    if (invErr || !invoice) {
      console.error('Deposit invoice create failed:', invErr)
      return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
    }

    // 3. Stripe Checkout Session — deposit + processing fee as separate lines.
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'gbp',
          product_data: { name: `${programmeName} deposit`, description: 'Deposit to secure your place' },
          unit_amount: Math.round(base * 100),
        },
        quantity: 1,
      },
    ]
    if (fee > 0) {
      lineItems.push({
        price_data: {
          currency: 'gbp',
          product_data: { name: 'Card processing fee' },
          unit_amount: Math.round(fee * 100),
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/deposit/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/deposit/cancelled?programme=${programmeKey}`,
      customer_email: email,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        contact_id: contactId,
        source: 'website_deposit',
        programme: programmeName,
      },
    })

    await supabase.from('invoices').update({ stripe_checkout_session_id: session.id }).eq('id', invoice.id)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Deposit checkout error:', err)
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
  }
}
