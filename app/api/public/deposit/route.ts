import { NextRequest, NextResponse } from 'next/server'
import { fullPaymentOffered } from '@/lib/website-content/package-fields'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceClient, assignRoundRobinOwner, notifyNewLead } from '@/lib/forms/process-submission'
import { findOrCreateList, EVERYONE_LIST } from '@/lib/forms/lead-routing'
import { createCheckoutSession, stripe } from '@/lib/stripe'
import { getPublishedTerms } from '@/lib/website-content/terms'
import { PAYMENT_PROGRAMMES, isPaymentProgramme, checkoutCustomFields } from '@/lib/payments/programmes'
import { sendPaymentLinkEmail } from '@/lib/invoices/payment-link-email'

/**
 * Public deposit / full-payment checkout for the website (Summer Residency,
 * University, Gap Year).
 *
 * STRIPE-FIRST: the visitor gives their name and email (plus the T&C tick where
 * terms are published) and goes straight to Stripe — there is no application
 * form in front of payment. Called with
 * { email, firstName, lastName, programme, mode, amount, confirmRepeat }:
 *
 *   1. find-or-create the contact from the name and email given (the Stripe
 *      webhook fills in the rest on payment). firstName/lastName are optional
 *      on the wire so a stale cached copy of the website still checks out.
 *   2. find-or-create a deal in the programme's pipeline at Initial Lead
 *   3. add them to ALL CONTACTS EVERYONE and the automation's static lists
 *   4. a PAID deposit/full invoice already exists and confirmRepeat isn't set
 *        → { status: 'already_paid', invoice }   (website asks "pay again?")
 *   5. otherwise a NEW invoice for this attempt, the programme's
 *      abandoned-deposits list (BEFORE Stripe opens, so a drop-off is still a
 *      lead to follow up) and a Stripe session → { status: 'checkout', url }
 *   6. the payment link is emailed to them, so someone who closes the Stripe
 *      tab can still pay. The invoice only becomes 'sent' once that email is
 *      confirmed — it used to be written as 'sent' on creation with nothing
 *      ever sent, so the CRM showed "Sent" against an invoice the payer had
 *      never been told about.
 *
 * On payment the Stripe webhook fills the contact from Stripe's details, marks
 * the invoice paid, moves the deal to "Deposit Paid" and removes them from the
 * abandoned list.
 *
 * Pricing (deposits, full amounts, card fee) comes from the CMS tables
 * website_packages / website_pricing_settings via resolvePricing(); the env
 * vars below are only FALLBACKS if those tables have no rows.
 *
 * Env: FORM_INGEST_SECRET (auth), STRIPE_SECRET_KEY, optionally DEPOSIT_AMOUNT
 * (2000), DEPOSIT_FEE_RATE (0.035), DEPOSIT_FEE_FIXED (0.20),
 * UNIVERSITY_FULL_AMOUNT (18500), WEBSITE_URL (success/cancel fallback).
 */

export const runtime = 'nodejs'

// Historical fallbacks — used ONLY when the CMS pricing tables have no rows for a
// programme, so a DB hiccup can never break checkout. Live prices come from
// website_packages / website_pricing_settings via resolvePricing().
const FALLBACK_DEPOSIT = Number(process.env.DEPOSIT_AMOUNT || 2000)
const FALLBACK_FULL_AMOUNTS: Record<string, number[]> = {
  residency: [2995, 5495],
  university: [Number(process.env.UNIVERSITY_FULL_AMOUNT || 18500)],
  gapyear: [18500, 10000],
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

interface Pricing { depositAmounts: number[]; fullAmounts: number[]; feeRate: number; feeFixed: number }

type Db = SupabaseClient

// Resolve authoritative pricing for a programme from the CMS tables, with the
// historical constants as a safety net. Server-side only (service client) — the
// client can never dictate an amount; every request is validated against the
// published amounts returned here.
//
// Deposits: a programme with per-package deposits (Gap Year: one per season)
// takes them from website_packages.deposit_amount; one without (Residency,
// University) uses the single website_pricing_settings.deposit_default.
async function resolvePricing(supabase: Db, programmeKey: string): Promise<Pricing> {
  const fallbackDeposits = FALLBACK_DEPOSIT ? [FALLBACK_DEPOSIT] : []
  try {
    const [settingsRes, pkgRes] = await Promise.all([
      supabase
        .from('website_pricing_settings')
        .select('deposit_default, deposit_enabled, fee_rate, fee_fixed')
        .eq('programme', programmeKey)
        .maybeSingle(),
      supabase
        .from('website_packages')
        .select('full_amount, full_enabled, deposit_amount, deposit_enabled')
        .eq('programme', programmeKey)
        .eq('published', true),
    ])
    const settings = settingsRes.data as
      | { deposit_default: number | null; deposit_enabled: boolean; fee_rate: number | null; fee_fixed: number | null }
      | null
    const pkgs =
      (pkgRes.data as
        | { full_amount: number | null; full_enabled: boolean; deposit_amount: number | null; deposit_enabled: boolean }[]
        | null) ?? []

    const unique = (xs: number[]) => Array.from(new Set(xs.map(Number)))
    const settingsDeposit = settings
      ? settings.deposit_enabled && settings.deposit_default != null
        ? [Number(settings.deposit_default)]
        : []
      : fallbackDeposits
    const feeRate = settings?.fee_rate != null ? Number(settings.fee_rate) : FALLBACK_FEE_RATE
    const feeFixed = settings?.fee_fixed != null ? Number(settings.fee_fixed) : FALLBACK_FEE_FIXED

    // No published packages: the CMS isn't set up for this programme (or the read
    // failed), so keep taking the historical amounts.
    if (!pkgs.length) {
      return {
        depositAmounts: settingsDeposit,
        fullAmounts: fullPaymentOffered(programmeKey) ? FALLBACK_FULL_AMOUNTS[programmeKey] ?? [] : [],
        feeRate,
        feeFixed,
      }
    }

    // Packages exist: the CRM is the single source of truth, exactly as the website
    // shows it. A package's "Deposit accepted" / "Payable in full" switches decide
    // what can be paid — switched off means refused here, never a hardcoded fallback
    // (that fallback used to let a full payment through after every package had
    // "Payable in full" turned off). A deposit-accepting package with no amount of
    // its own takes the programme's default deposit.
    // A programme that doesn't offer full payment at all (Gap Year, for now) refuses
    // it whatever an individual package says.
    const fullAmounts = fullPaymentOffered(programmeKey)
      ? unique(pkgs.filter((p) => p.full_enabled && typeof p.full_amount === 'number').map((p) => p.full_amount as number))
      : []
    const depositAmounts = unique(
      pkgs.flatMap((p) => {
        if (!p.deposit_enabled) return []
        if (typeof p.deposit_amount === 'number') return [p.deposit_amount]
        return settingsDeposit
      }),
    )
    return { depositAmounts, fullAmounts, feeRate, feeFixed }
  } catch {
    return {
      depositAmounts: fallbackDeposits,
      fullAmounts: fullPaymentOffered(programmeKey) ? FALLBACK_FULL_AMOUNTS[programmeKey] ?? [] : [],
      feeRate: FALLBACK_FEE_RATE,
      feeFixed: FALLBACK_FEE_FIXED,
    }
  }
}

// Pick the amount to charge: the client names one, the server accepts it only
// if it is one of the published amounts. With a single option and none named,
// use that option. Anything else is rejected.
function pickAmount(raw: unknown, allowed: number[]): number | null {
  const requested = raw != null && raw !== '' ? Math.round(Number(raw)) : null
  if (requested != null) return !Number.isNaN(requested) && allowed.includes(requested) ? requested : null
  return allowed.length === 1 ? allowed[0] : null
}

interface ProgrammeAutomation {
  id: string
  name: string | null
  pipelineId: string
  initialStageId: string | null
  roundRobinUsers: string[]
  staticListIds: string[]
}

interface AutomationRow {
  id: string
  name: string | null
  pipeline_id: string | null
  trigger_stage_id: string | null
  config: {
    form_id?: string
    form_ids?: string[]
    initial_stage_id?: string
    round_robin_users?: string[]
    static_list_ids?: string[]
  } | null
}

/** The programme's active form-submission automation: its pipeline, the stage
 *  new leads land on (Initial Lead), and who owns them. */
async function resolveAutomation(supabase: Db, formId: string): Promise<ProgrammeAutomation | null> {
  const { data } = await supabase
    .from('automations')
    .select('id, name, pipeline_id, trigger_stage_id, config')
    .eq('trigger_type', 'form_submission')
    .eq('is_active', true)
  for (const a of (data as AutomationRow[] | null) ?? []) {
    const cfg = a.config || {}
    const ids = cfg.form_ids?.length ? cfg.form_ids : cfg.form_id ? [cfg.form_id] : []
    if (ids.includes(formId) && a.pipeline_id) {
      return {
        id: a.id,
        name: a.name,
        pipelineId: a.pipeline_id,
        // The automation's own initial stage — never "first by display_order",
        // which is Dormant on every pipeline.
        initialStageId: cfg.initial_stage_id || a.trigger_stage_id,
        roundRobinUsers: cfg.round_robin_users ?? [],
        staticListIds: cfg.static_list_ids ?? [],
      }
    }
  }
  return null
}

/** Find the contact by email (case-insensitive) or create one.
 *
 *  The name now comes from the checkout dialogue. It used to be left blank
 *  until Stripe reported it back, which meant anyone who opened checkout and
 *  did not pay sat in the CRM as a nameless email address — and the whole point
 *  of writing the lead down BEFORE Stripe is that a drop-off is still somebody
 *  to follow up. A recruiter cannot chase, greet or segment "(no name)".
 *
 *  Stripe still fills in the rest on payment; this only seeds what we were
 *  told up front, and never overwrites a name already on the record.
 */
async function findOrCreateContact(
  supabase: Db,
  email: string,
  firstName?: string,
  lastName?: string,
): Promise<string | null> {
  const find = async () => {
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .ilike('email', email.replace(/[%_\\]/g, '\\$&'))
      .order('created_at', { ascending: true })
      .limit(1)
    return data?.[0] ?? null
  }

  const existing = await find()
  if (existing) {
    // A returning visitor whose record never got a name (an earlier abandoned
    // checkout) gets one now. An existing name is left alone: the person at the
    // keyboard may be a parent paying for a player already on file.
    const patch: Record<string, string> = {}
    if (firstName && !(existing.first_name as string | null)?.trim()) patch.first_name = firstName
    if (lastName && !(existing.last_name as string | null)?.trim()) patch.last_name = lastName
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('contacts').update(patch).eq('id', existing.id)
      if (error) console.warn('Could not backfill deposit contact name:', error.message)
    }
    return existing.id as string
  }

  const { data: created, error } = await supabase
    .from('contacts')
    .insert({
      email,
      first_name: firstName ?? '',
      last_name: lastName ?? '',
      source: 'website_deposit',
    })
    .select('id')
    .single()
  if (created?.id) return created.id as string
  // Lost a race with a parallel request for the same email — re-read.
  if (error) console.warn('Deposit contact insert failed, re-reading:', error.message)
  return (await find())?.id as string | undefined ?? null
}

/** The contact's deal in this pipeline, or a new one at Initial Lead with a
 *  round-robin owner (the same assignment form submissions use). */
async function findOrCreateDeal(
  supabase: Db,
  contactId: string,
  email: string,
  programmeKey: string,
  automation: ProgrammeAutomation,
): Promise<{ id: string; created: boolean; ownerId: string | null } | null> {
  const { data: deals } = await supabase
    .from('deals')
    .select('id, deal_owner_id')
    .eq('contact_id', contactId)
    .eq('pipeline_id', automation.pipelineId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (deals?.[0]?.id) {
    return { id: deals[0].id as string, created: false, ownerId: (deals[0].deal_owner_id as string | null) ?? null }
  }

  const ownerId = await assignRoundRobinOwner(supabase, automation.id, automation.roundRobinUsers)
  const { data: deal, error } = await supabase
    .from('deals')
    .insert({
      contact_id: contactId,
      pipeline_id: automation.pipelineId,
      current_stage_id: automation.initialStageId,
      deal_owner_id: ownerId,
      // Only the email is known yet; the webhook swaps in the player's name.
      title: email,
      deal_value: 0,
      source: `website_deposit:${programmeKey}`,
    })
    .select('id')
    .single()
  if (error || !deal) {
    console.error('Deposit deal create failed:', error)
    return null
  }
  return { id: deal.id as string, created: true, ownerId }
}

/** Upsert the contact into lists by id. Best-effort. */
async function addToLists(supabase: Db, contactId: string, listIds: Iterable<string>) {
  const ids = new Set(listIds)
  if (!ids.size) return
  const now = new Date().toISOString()
  await supabase
    .from('contact_lists')
    .upsert(
      [...ids].map((list_id) => ({ contact_id: contactId, list_id, added_at: now })),
      { onConflict: 'contact_id,list_id' },
    )
}

/** Lists every deposit lead belongs to: ALL CONTACTS EVERYONE + the
 *  programme automation's static lists. */
async function addToLeadLists(supabase: Db, contactId: string, automation: ProgrammeAutomation) {
  const ids = [...automation.staticListIds]
  const everyone = await findOrCreateList(supabase, EVERYONE_LIST)
  if (everyone) ids.push(everyone)
  await addToLists(supabase, contactId, ids)
}

/** The programme's abandoned-deposits list — joined only when a Stripe
 *  checkout is actually opened; the webhook removes them once they pay. */
async function addToAbandonedList(supabase: Db, contactId: string, programmeKey: keyof typeof PAYMENT_PROGRAMMES) {
  const { name, description } = PAYMENT_PROGRAMMES[programmeKey].abandonedList
  const listId = await findOrCreateList(supabase, name, description)
  if (listId) await addToLists(supabase, contactId, [listId])
}

/**
 * Retire this deal's earlier unpaid website checkouts before starting a new
 * one, so only one Stripe page per deal can ever take money. The old session
 * is expired first; only if Stripe confirms it is no longer payable is the
 * invoice cancelled. A session that already completed is left alone — its
 * webhook will mark that invoice paid.
 */
async function retireOpenCheckouts(supabase: Db, dealId: string) {
  const { data: open } = await supabase
    .from('invoices')
    .select('id, stripe_checkout_session_id')
    .eq('deal_id', dealId)
    .in('type', ['deposit', 'full_payment'])
    // 'draft' included because a checkout whose payment-link email failed
    // stays draft — it still has a live Stripe page that must be retired.
    .in('status', ['draft', 'sent', 'overdue'])
    .not('stripe_checkout_session_id', 'is', null)
  for (const inv of (open as { id: string; stripe_checkout_session_id: string }[] | null) ?? []) {
    try {
      const session = await stripe.checkout.sessions.retrieve(inv.stripe_checkout_session_id)
      if (session.status === 'complete') continue
      if (session.status === 'open') await stripe.checkout.sessions.expire(session.id)
      await supabase.from('invoices').update({ status: 'cancelled' }).eq('id', inv.id)
    } catch (err) {
      // Can't confirm the old page is dead → leave the invoice as it is rather
      // than risk ignoring a payment the webhook later reports.
      console.warn(`Could not retire checkout for invoice ${inv.id}:`, err)
    }
  }
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
  if (!isPaymentProgramme(programmeKey)) {
    return NextResponse.json({ error: 'Unknown programme.' }, { status: 400 })
  }
  const programme = PAYMENT_PROGRAMMES[programmeKey]
  const programmeName = programme.name

  const email = str(body.email)?.toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }

  // Optional so that an older cached copy of the website — which sends email
  // only — keeps working rather than failing checkout. Capped because these
  // land straight on the contact record.
  const firstName = str(body.firstName)?.slice(0, 80)
  const lastName = str(body.lastName)?.slice(0, 80)

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
  const allowed = mode === 'full' ? pricing.fullAmounts : pricing.depositAmounts
  if (mode === 'deposit' && !allowed.length) {
    return NextResponse.json({ error: 'Deposits are not available for this programme.' }, { status: 400 })
  }
  if (mode === 'full' && !allowed.length) {
    return NextResponse.json({ error: 'Paying in full online is not available for this programme.' }, { status: 400 })
  }
  const baseAmount = pickAmount(body.amount, allowed)
  if (baseAmount == null) {
    return NextResponse.json({ error: 'Invalid payment amount.' }, { status: 400 })
  }

  // Terms gate. The tick box lives on the website's deposit dialogue, which is
  // a client component and therefore cannot be the thing that enforces it.
  // Refusing here is what makes it a gate rather than a decoration. Checked
  // before anything is written, so a refused request leaves no trace.
  // Nothing published means nothing to enforce.
  const published = await getPublishedTerms(supabase, programmeKey)
  if (published && body.termsAccepted !== true) {
    return NextResponse.json(
      {
        error: 'Please confirm you have read and agree to the Terms & Conditions.',
        code: 'TERMS_NOT_ACCEPTED',
      },
      { status: 400 },
    )
  }

  const originRaw = str(body.origin) || process.env.WEBSITE_URL || ''
  const origin = /^https?:\/\//.test(originRaw) ? originRaw.replace(/\/$/, '') : ''
  if (!origin) {
    return NextResponse.json({ error: 'Payments are temporarily unavailable.' }, { status: 500 })
  }

  try {
    const automation = await resolveAutomation(supabase, programme.formId)
    if (!automation) {
      console.error(`Deposit: no active form-submission automation for form "${programme.formId}"`)
      return NextResponse.json({ error: 'Payments are temporarily unavailable.' }, { status: 503 })
    }

    // 1-2. The lead exists in the CRM before Stripe opens, so closing the
    // Stripe tab still leaves a contact and a deal.
    const contactId = await findOrCreateContact(supabase, email, firstName, lastName)
    if (!contactId) {
      return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
    }
    const deal = await findOrCreateDeal(supabase, contactId, email, programmeKey, automation)
    if (!deal) {
      return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
    }
    await addToLeadLists(supabase, contactId, automation)
    if (deal.created) {
      void notifyNewLead(supabase, {
        dealId: deal.id,
        ownerId: deal.ownerId,
        email,
        programme: automation.name ?? programmeName,
        source: `website_deposit:${programmeKey}`,
      })
    }

    // 4. Already paid this programme? Paying again is allowed, but only after
    // the visitor confirms — a double-click or a re-opened link must not
    // silently take another deposit.
    if (body.confirmRepeat !== true) {
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
    }

    // 5. A new invoice for every checkout attempt, so a repeat payment never
    // overwrites the record of an earlier one.
    await retireOpenCheckouts(supabase, deal.id)

    // 3. Only now — a checkout is really starting — do they join the abandoned
    // list. Doing it earlier would put someone who has already paid back on it
    // just for seeing the "you've paid before" warning and pressing Cancel.
    await addToAbandonedList(supabase, contactId, programmeKey)

    const { base, fee, total } = price(baseAmount, pricing.feeRate, pricing.feeFixed)
    const due = new Date()
    due.setDate(due.getDate() + 7)
    const dueDate = due.toISOString().slice(0, 10)
    const description =
      mode === 'full'
        ? `${programmeName} — full programme payment`
        : `${programmeName} — deposit to secure your place`
    const notes = `Website ${payNoun} checkout (${programmeName}). ${mode === 'full' ? 'Amount' : 'Deposit'} £${base.toFixed(2)} + card fee £${fee.toFixed(2)}.`

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
        contact_id: contactId,
        deal_id: deal.id,
        type: invoiceType,
        description,
        amount: total,
        currency: 'GBP',
        // Nothing has been sent yet. Writing 'sent' + sent_at here (with no
        // email anywhere in this route) is what made the CRM claim an invoice
        // had been sent to someone who never received one. It becomes 'sent'
        // below, after Resend confirms the payment-link email.
        status: 'draft',
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

    const terms = published ? { ...published, acceptedUpstream: true } : null

    const session = await createCheckoutSession({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/deposit/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/deposit/cancelled?programme=${programmeKey}`,
      customer_email: email,
      // The payer's details (name, phone) and the player's name, gender and
      // graduation year are collected on Stripe's page; the webhook copies
      // them onto the contact and files them into the cohort lists.
      phone_number_collection: { enabled: true },
      custom_fields: checkoutCustomFields(),
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        contact_id: contactId,
        deal_id: deal.id,
        source: 'website_deposit',
        payment_mode: mode,
        programme: programmeName,
        programme_key: programmeKey,
      },
    }, terms)

    await supabase.from('invoices').update({ stripe_checkout_session_id: session.id }).eq('id', invoice.id)

    // Email them the payment link. This is what makes "Sent" true, and it is
    // the way back for the drop-offs this flow is built around: someone who
    // opens Stripe and closes the tab now has the link in their inbox as well
    // as sitting on the abandoned-deposits list.
    //
    // A failure here is NOT fatal — the visitor is already being handed a
    // working Stripe URL, and refusing the checkout over an undelivered
    // receipt would lose a payment to fix a bookkeeping problem. The invoice
    // simply stays 'draft', which is the truth, and it stays on the abandoned
    // list either way.
    if (session.url) {
      const emailed = await sendPaymentLinkEmail(email, {
        invoiceNumber: invoice.invoice_number,
        description,
        amount: total,
        currency: 'GBP',
        dueDate,
        // Only the email address is known at this point — the webhook fills
        // in the names once Stripe has collected them.
        recipientName: 'there',
        playerName: '',
        recipientType: 'player',
        payUrl: session.url,
      })
      if (emailed.ok) {
        await supabase
          .from('invoices')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', invoice.id)
      } else {
        console.error(`Deposit invoice ${invoice.invoice_number} email failed:`, emailed.message)
      }
    }

    return NextResponse.json({ status: 'checkout', url: session.url })
  } catch (err) {
    console.error('Deposit checkout error:', err)
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
  }
}
