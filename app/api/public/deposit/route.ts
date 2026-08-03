import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getServiceClient } from '@/lib/forms/process-submission'
import { findOrCreateList } from '@/lib/assistant/capture'
import { stripe } from '@/lib/stripe'

/**
 * Public deposit / full-payment resolver for the website (Residency & University).
 *
 * The website deposit journey is FORM-FIRST: the applicant completes the
 * programme application form (which creates their contact + a deal at "Initial
 * Lead" via the form-submission automation) BEFORE paying. This endpoint is the
 * single decision point, called with { email, programme, mode, amount }:
 *
 *   - no contact / no deal in the programme pipeline  → { status: 'need_form' }
 *       (website sends them to /apply?...&deposit=1 to fill the form)
 *   - a PAID deposit/full invoice already exists       → { status: 'already_paid', invoice }
 *       (website shows "you've already paid" + the receipt)
 *   - otherwise                                        → { status: 'checkout', url }
 *       (reuses their open invoice or creates one LINKED TO THE DEAL, then Stripe)
 *
 * On payment the Stripe webhook marks the invoice paid, moves the linked deal to
 * "Deposit Paid", removes them from the abandoned list, and (for full payments)
 * tags the contact "Paid in Full".
 *
 * Pricing (amounts, deposit, card fee) is resolved from the CMS tables
 * website_packages / website_pricing_settings via resolvePricing(); the env vars
 * below are only FALLBACKS if those tables have no rows for the programme.
 *
 * Env: FORM_INGEST_SECRET (auth), STRIPE_SECRET_KEY, optionally DEPOSIT_AMOUNT
 * (2000), DEPOSIT_FEE_RATE (0.035), DEPOSIT_FEE_FIXED (0.20),
 * UNIVERSITY_FULL_AMOUNT (18500), WEBSITE_URL (success/cancel fallback).
 */

export const runtime = 'nodejs'

const PROGRAMMES: Record<string, string> = {
  residency: 'Summer Residency',
  university: 'University Programme',
}

// Deposit programme key → the form_id used by the form-submission automations,
// so we can resolve the programme's pipeline dynamically (no hardcoded ids).
const FORM_ID_BY_PROGRAMME: Record<string, string> = {
  residency: 'summer',
  university: 'university',
}

// Historical fallbacks — used ONLY when the CMS pricing tables have no rows for a
// programme, so a DB hiccup can never break checkout. Live prices come from
// website_packages / website_pricing_settings via resolvePricing().
const FALLBACK_DEPOSIT = Number(process.env.DEPOSIT_AMOUNT || 2000)
const FALLBACK_FULL_AMOUNTS: Record<string, number[]> = {
  residency: [3500, 6000, 8000],
  university: [Number(process.env.UNIVERSITY_FULL_AMOUNT || 18500)],
}
const FALLBACK_FEE_RATE = Number(process.env.DEPOSIT_FEE_RATE || 0.035)
const FALLBACK_FEE_FIXED = Number(process.env.DEPOSIT_FEE_FIXED || 0.2)

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t.length ? t : undefined
}

// Gross-up the card fee on top of `base` so IFG nets the full amount.
function price(base: number, rate: number, fixed: number) {
  const total = (base + fixed) / (1 - rate)
  const fee = Math.max(0, Math.ceil((total - base) * 100) / 100)
  return { base, fee, total: base + fee }
}

interface Pricing { depositBase: number | null; fullAmounts: number[]; feeRate: number; feeFixed: number }

// Resolve authoritative pricing for a programme from the CMS tables, with the
// historical constants as a safety net. Server-side only (service client) — the
// client can never dictate an amount; every `full` request is validated against
// the published package amounts returned here.
async function resolvePricing(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  programmeKey: string,
): Promise<Pricing> {
  try {
    const [settingsRes, pkgRes] = await Promise.all([
      supabase
        .from('website_pricing_settings')
        .select('deposit_default, deposit_enabled, fee_rate, fee_fixed')
        .eq('programme', programmeKey)
        .maybeSingle(),
      supabase
        .from('website_packages')
        .select('full_amount, full_enabled')
        .eq('programme', programmeKey)
        .eq('published', true),
    ])
    const settings = settingsRes.data as
      | { deposit_default: number | null; deposit_enabled: boolean; fee_rate: number | null; fee_fixed: number | null }
      | null
    const pkgs = (pkgRes.data as { full_amount: number | null; full_enabled: boolean }[] | null) ?? []

    const fullAmounts = Array.from(
      new Set(
        pkgs.filter((p) => p.full_enabled && typeof p.full_amount === 'number').map((p) => p.full_amount as number),
      ),
    )
    return {
      depositBase: settings
        ? settings.deposit_enabled && settings.deposit_default != null
          ? Number(settings.deposit_default)
          : null
        : FALLBACK_DEPOSIT,
      fullAmounts: fullAmounts.length ? fullAmounts : FALLBACK_FULL_AMOUNTS[programmeKey] ?? [],
      feeRate: settings?.fee_rate != null ? Number(settings.fee_rate) : FALLBACK_FEE_RATE,
      feeFixed: settings?.fee_fixed != null ? Number(settings.fee_fixed) : FALLBACK_FEE_FIXED,
    }
  } catch {
    return {
      depositBase: FALLBACK_DEPOSIT,
      fullAmounts: FALLBACK_FULL_AMOUNTS[programmeKey] ?? [],
      feeRate: FALLBACK_FEE_RATE,
      feeFixed: FALLBACK_FEE_FIXED,
    }
  }
}

interface AutomationRow { pipeline_id: string | null; config: { form_id?: string; form_ids?: string[] } | null }

/** Resolve the programme's pipeline via its active form-submission automation. */
async function resolvePipelineId(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  formId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('automations')
    .select('pipeline_id, config')
    .eq('trigger_type', 'form_submission')
    .eq('is_active', true)
  for (const a of (data as AutomationRow[] | null) ?? []) {
    const cfg = a.config || {}
    const ids = cfg.form_ids?.length ? cfg.form_ids : cfg.form_id ? [cfg.form_id] : []
    if (ids.includes(formId) && a.pipeline_id) return a.pipeline_id
  }
  return null
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

  // Payment mode: 'deposit' or 'full' (whole programme).
  const mode = str(body.mode) === 'full' ? 'full' : 'deposit'
  const invoiceType: 'deposit' | 'full_payment' = mode === 'full' ? 'full_payment' : 'deposit'
  const payNoun = mode === 'full' ? 'full payment' : 'deposit'

  const supabase = getServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Payments are temporarily unavailable.' }, { status: 503 })
  }

  // Authoritative amount from the CMS pricing tables (never trust the client).
  const pricing = await resolvePricing(supabase, programmeKey)
  let baseAmount: number
  if (mode === 'full') {
    const raw = body.amount
    const requested = raw != null && raw !== '' ? Math.round(Number(raw)) : null
    if (requested != null) {
      if (Number.isNaN(requested) || !pricing.fullAmounts.includes(requested)) {
        return NextResponse.json({ error: 'Invalid payment amount.' }, { status: 400 })
      }
      baseAmount = requested
    } else if (pricing.fullAmounts.length === 1) {
      baseAmount = pricing.fullAmounts[0] // single programme fee (e.g. University)
    } else {
      return NextResponse.json({ error: 'Invalid payment amount.' }, { status: 400 })
    }
  } else {
    if (pricing.depositBase == null) {
      return NextResponse.json({ error: 'Deposits are not available for this programme.' }, { status: 400 })
    }
    baseAmount = pricing.depositBase
  }

  try {
    const formId = FORM_ID_BY_PROGRAMME[programmeKey]
    const pipelineId = await resolvePipelineId(supabase, formId)
    if (!pipelineId) {
      // Automation/pipeline not configured — send them through the form anyway.
      return NextResponse.json({ status: 'need_form' })
    }

    // 1. Do we know this person yet? (Form-first: contact + deal must exist.)
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (!contact?.id) return NextResponse.json({ status: 'need_form' })

    // 2. Have they applied to THIS programme (deal in its pipeline)?
    const { data: deals } = await supabase
      .from('deals')
      .select('id')
      .eq('contact_id', contact.id)
      .eq('pipeline_id', pipelineId)
      .order('created_at', { ascending: false })
      .limit(1)
    const deal = deals?.[0]
    if (!deal?.id) return NextResponse.json({ status: 'need_form' })

    // 3. Already paid this programme's deposit/fee? → show the receipt.
    const { data: paidRows } = await supabase
      .from('invoices')
      .select('invoice_number, amount, paid_at, description, type')
      .eq('deal_id', deal.id)
      .in('type', ['deposit', 'full_payment'])
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(1)
    if (paidRows?.[0]) {
      const p = paidRows[0]
      return NextResponse.json({
        status: 'already_paid',
        invoice: {
          number: p.invoice_number,
          amount: p.amount,
          date: p.paid_at,
          description: p.description,
          kind: p.type === 'full_payment' ? 'full' : 'deposit',
        },
      })
    }

    // --- CHECKOUT: they have a deal, haven't paid → take payment. ---
    const originRaw = str(body.origin) || process.env.WEBSITE_URL || ''
    const origin = /^https?:\/\//.test(originRaw) ? originRaw.replace(/\/$/, '') : ''
    if (!origin) {
      return NextResponse.json({ error: 'Payments are temporarily unavailable.' }, { status: 500 })
    }

    const { base, fee, total } = price(baseAmount, pricing.feeRate, pricing.feeFixed)
    const due = new Date()
    due.setDate(due.getDate() + 7)
    const dueDate = due.toISOString().slice(0, 10)
    const description =
      mode === 'full'
        ? `${programmeName} — full programme payment`
        : `${programmeName} — deposit to secure your place`
    const notes = `Website ${payNoun} checkout (${programmeName}). ${mode === 'full' ? 'Amount' : 'Deposit'} £${base.toFixed(2)} + card fee £${fee.toFixed(2)}.`

    // Reuse an existing OPEN deposit/full invoice for this deal (repeat attempt)
    // rather than creating duplicates; otherwise create a new one linked to the deal.
    const { data: openRows } = await supabase
      .from('invoices')
      .select('id, invoice_number')
      .eq('deal_id', deal.id)
      .in('type', ['deposit', 'full_payment'])
      .in('status', ['sent', 'overdue'])
      .order('created_at', { ascending: false })
      .limit(1)

    let invoiceId: string
    let invoiceNumber: string
    if (openRows?.[0]) {
      invoiceId = openRows[0].id
      invoiceNumber = openRows[0].invoice_number
      await supabase
        .from('invoices')
        .update({ type: invoiceType, description, amount: total, notes, sent_at: new Date().toISOString(), due_date: dueDate })
        .eq('id', invoiceId)
    } else {
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
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert({
          contact_id: contact.id,
          deal_id: deal.id,
          type: invoiceType,
          description,
          amount: total,
          currency: 'GBP',
          status: 'sent',
          sent_at: new Date().toISOString(),
          due_date: dueDate,
          recipient_type: 'player',
          created_by_id: adminProfile.id,
          notes,
        })
        .select('id, invoice_number')
        .single()
      if (invErr || !invoice) {
        console.error('Deposit invoice create failed:', invErr)
        return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
      }
      invoiceId = invoice.id
      invoiceNumber = invoice.invoice_number
    }

    // Abandoned-cart follow-up list (per programme). Removed by the webhook on payment.
    const list =
      programmeKey === 'university'
        ? { name: 'Abandoned University Deposits', desc: 'Started the University Programme deposit/payment checkout on the website but have not paid yet — follow up.' }
        : { name: 'Abandoned Summer Deposits', desc: 'Started the Summer Residency deposit/payment checkout on the website but have not paid yet — follow up.' }
    const listId = await findOrCreateList(supabase, list.name, list.desc)
    if (listId) {
      await supabase
        .from('contact_lists')
        .upsert({ contact_id: contact.id, list_id: listId, added_at: new Date().toISOString() }, { onConflict: 'contact_id,list_id' })
    }

    // Stripe Checkout — amount + processing fee as separate lines.
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'gbp',
          product_data: {
            name: mode === 'full' ? `${programmeName} — full payment` : `${programmeName} deposit`,
            description: mode === 'full' ? 'Full programme payment' : 'Deposit to secure your place',
          },
          unit_amount: Math.round(base * 100),
        },
        quantity: 1,
      },
    ]
    if (fee > 0) {
      lineItems.push({
        price_data: { currency: 'gbp', product_data: { name: 'Card processing fee' }, unit_amount: Math.round(fee * 100) },
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
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        contact_id: contact.id,
        deal_id: deal.id,
        source: 'website_deposit',
        payment_mode: mode,
        programme: programmeName,
        programme_key: programmeKey,
      },
    })

    await supabase.from('invoices').update({ stripe_checkout_session_id: session.id }).eq('id', invoiceId)

    return NextResponse.json({ status: 'checkout', url: session.url })
  } catch (err) {
    console.error('Deposit checkout error:', err)
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
  }
}
