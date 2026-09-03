import type { SupabaseClient } from '@supabase/supabase-js'
import {
  toCSV,
  fetchAll,
  labelMap,
  dt,
  day,
  daysBetween,
  fullName,
  type Column,
  type Row,
} from './csv'

/**
 * The queries behind each export.
 *
 * Server-only: it runs with the caller's session, so RLS still decides
 * what any given user can export. Three of these were broken before and
 * are called out at their definitions — they referenced columns and
 * foreign keys that do not exist, so the report always threw.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

export interface ReportContext {
  supabase: Client
  /** Null on snapshot reports, which do not take a window. */
  start: Date | null
  end: Date | null
  pipelineId: string | null
  recruiterId: string | null
}

export interface ReportResult {
  columns: Column[]
  rows: Row[]
}

type Runner = (ctx: ReportContext) => Promise<ReportResult>

const iso = (d: Date | null) => (d ? d.toISOString() : null)

/** Apply the selected window to a column, when there is one. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function windowed<T extends { gte: any; lte: any }>(query: T, column: string, ctx: ReportContext): T {
  const from = iso(ctx.start)
  const to = iso(ctx.end)
  let q = query
  if (from) q = q.gte(column, from)
  if (to) q = q.lte(column, to)
  return q
}

// ---------------------------------------------------------------------------
// Pipeline & people
// ---------------------------------------------------------------------------

const deals: Runner = async (ctx) => {
  const rows = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase
      .from('deals')
      .select(
        `id, title, value, status, created_at, updated_at, won_at, lost_at, lost_reason,
         source, stage_entered_at, deal_owner_id,
         contact:contacts(first_name, last_name, email, phone, country, position, graduation_year),
         stage:pipeline_stages!current_stage_id(name, stage_type),
         pipeline:pipelines(name)`,
      )
      .order('created_at', { ascending: false })
    q = windowed(q, 'created_at', ctx)
    if (ctx.pipelineId) q = q.eq('pipeline_id', ctx.pipelineId)
    if (ctx.recruiterId) q = q.eq('deal_owner_id', ctx.recruiterId)
    return q
  })

  const owners = await labelMap(
    ctx.supabase,
    'profiles',
    rows.map((d) => d.deal_owner_id as string),
    'full_name',
  )

  // `deals.stage_entered_at` exists but nothing writes it — it is null on
  // every row — so "days in stage" comes from the last recorded move into
  // the deal's current stage, falling back to when the deal was created.
  const dealIds = rows.map((d) => String(d.id))
  const history = dealIds.length
    ? await fetchAll<Record<string, unknown>>(() =>
        ctx.supabase
          .from('deal_stage_history')
          .select('deal_id, changed_at')
          .in('deal_id', dealIds.slice(0, 1000)),
      )
    : []
  const lastMove = new Map<string, string>()
  for (const h of history) {
    const id = String(h.deal_id)
    const at = h.changed_at as string
    if (!lastMove.has(id) || at > lastMove.get(id)!) lastMove.set(id, at)
  }

  const now = new Date().toISOString()

  return {
    columns: [
      { key: 'player', label: 'Player' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'country', label: 'Country' },
      { key: 'position', label: 'Position' },
      { key: 'graduation_year', label: 'Graduation year' },
      { key: 'programme', label: 'Programme' },
      { key: 'stage', label: 'Stage' },
      { key: 'days_in_stage', label: 'Days in stage' },
      { key: 'status', label: 'Status' },
      { key: 'value', label: 'Value (GBP)' },
      { key: 'owner', label: 'Owner' },
      { key: 'source', label: 'Source' },
      { key: 'created_at', label: 'Created' },
      { key: 'won_at', label: 'Won' },
      { key: 'lost_at', label: 'Lost' },
      { key: 'lost_reason', label: 'Lost reason' },
      { key: 'title', label: 'Deal title' },
    ],
    rows: rows.map((d) => {
      const contact = d.contact as Record<string, unknown> | null
      return {
        player: fullName(contact as never) || '',
        email: contact?.email ?? '',
        phone: contact?.phone ?? '',
        country: contact?.country ?? '',
        position: contact?.position ?? '',
        graduation_year: contact?.graduation_year ?? '',
        programme: (d.pipeline as { name?: string } | null)?.name ?? '',
        stage: (d.stage as { name?: string } | null)?.name ?? '',
        days_in_stage: daysBetween(
          (d.stage_entered_at as string) ?? lastMove.get(String(d.id)) ?? (d.created_at as string),
          now,
        ),
        status: d.status,
        value: d.value ?? 0,
        owner: owners.get(String(d.deal_owner_id)) ?? '',
        source: d.source ?? '',
        created_at: dt(d.created_at as string),
        won_at: dt(d.won_at as string),
        lost_at: dt(d.lost_at as string),
        lost_reason: d.lost_reason ?? '',
        title: d.title ?? '',
      }
    }),
  }
}

/**
 * Stage movements.
 *
 * New: `deal_stage_history` has been recording every move since the
 * pipeline went live and nothing exported it.
 */
const stageMovements: Runner = async (ctx) => {
  const history = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase
      .from('deal_stage_history')
      .select('id, deal_id, from_stage_id, to_stage_id, changed_by, changed_at')
      .order('changed_at', { ascending: false })
    q = windowed(q, 'changed_at', ctx)
    return q
  })

  const dealIds = [...new Set(history.map((h) => h.deal_id as string))]
  const dealRows = dealIds.length
    ? await fetchAll<Record<string, unknown>>(() =>
        ctx.supabase
          .from('deals')
          .select('id, title, pipeline_id, contact:contacts(first_name, last_name), pipeline:pipelines(name)')
          .in('id', dealIds),
      )
    : []
  const dealsById = new Map(dealRows.map((d) => [String(d.id), d]))

  const stages = await labelMap(
    ctx.supabase,
    'pipeline_stages',
    history.flatMap((h) => [h.from_stage_id as string, h.to_stage_id as string]),
    'name',
  )
  const people = await labelMap(
    ctx.supabase,
    'profiles',
    history.map((h) => h.changed_by as string),
    'full_name',
  )

  // Previous move for the same deal gives how long it sat where it was.
  const byDeal = new Map<string, Record<string, unknown>[]>()
  for (const h of [...history].sort(
    (a, b) => new Date(a.changed_at as string).getTime() - new Date(b.changed_at as string).getTime(),
  )) {
    const list = byDeal.get(String(h.deal_id)) ?? []
    list.push(h)
    byDeal.set(String(h.deal_id), list)
  }
  const heldFor = new Map<string, number | null>()
  for (const list of byDeal.values()) {
    list.forEach((h, i) => {
      const previous = i > 0 ? (list[i - 1].changed_at as string) : null
      heldFor.set(String(h.id), daysBetween(previous, h.changed_at as string))
    })
  }

  const filtered = ctx.pipelineId
    ? history.filter((h) => dealsById.get(String(h.deal_id))?.pipeline_id === ctx.pipelineId)
    : history

  return {
    columns: [
      { key: 'changed_at', label: 'When' },
      { key: 'player', label: 'Player' },
      { key: 'programme', label: 'Programme' },
      { key: 'from_stage', label: 'From stage' },
      { key: 'to_stage', label: 'To stage' },
      { key: 'days_in_previous', label: 'Days in previous stage' },
      { key: 'changed_by', label: 'Moved by' },
    ],
    rows: filtered.map((h) => {
      const deal = dealsById.get(String(h.deal_id))
      return {
        changed_at: dt(h.changed_at as string),
        player: fullName(deal?.contact as never) || (deal?.title as string) || '',
        programme: (deal?.pipeline as { name?: string } | null)?.name ?? '',
        from_stage: stages.get(String(h.from_stage_id)) ?? '—',
        to_stage: stages.get(String(h.to_stage_id)) ?? '',
        days_in_previous: heldFor.get(String(h.id)) ?? '',
        changed_by: people.get(String(h.changed_by)) ?? 'Automation',
      }
    }),
  }
}

const recruiters: Runner = async (ctx) => {
  const rows = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase.from('deals').select('id, value, status, deal_owner_id, pipeline_id')
    q = windowed(q, 'created_at', ctx)
    if (ctx.recruiterId) q = q.eq('deal_owner_id', ctx.recruiterId)
    if (ctx.pipelineId) q = q.eq('pipeline_id', ctx.pipelineId)
    return q
  })

  const profiles = await fetchAll<Record<string, unknown>>(() =>
    ctx.supabase.from('profiles').select('id, full_name, email, role').eq('is_active', true),
  )

  const stats = new Map<string, { total: number; won: number; lost: number; value: number; wonValue: number }>()
  for (const deal of rows) {
    const owner = deal.deal_owner_id as string | null
    if (!owner) continue
    const s = stats.get(owner) ?? { total: 0, won: 0, lost: 0, value: 0, wonValue: 0 }
    s.total += 1
    s.value += Number(deal.value ?? 0)
    if (deal.status === 'won') {
      s.won += 1
      s.wonValue += Number(deal.value ?? 0)
    }
    if (deal.status === 'lost') s.lost += 1
    stats.set(owner, s)
  }

  return {
    columns: [
      { key: 'name', label: 'Recruiter' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'total', label: 'Deals owned' },
      { key: 'won', label: 'Won' },
      { key: 'lost', label: 'Lost' },
      { key: 'open', label: 'Still open' },
      { key: 'win_rate', label: 'Win rate' },
      { key: 'value', label: 'Total value (GBP)' },
      { key: 'won_value', label: 'Won value (GBP)' },
    ],
    rows: profiles
      .filter((p) => stats.has(String(p.id)))
      .map((p) => {
        const s = stats.get(String(p.id))!
        return {
          name: p.full_name || p.email,
          email: p.email,
          role: p.role,
          total: s.total,
          won: s.won,
          lost: s.lost,
          open: s.total - s.won - s.lost,
          win_rate: s.total > 0 ? `${((s.won / s.total) * 100).toFixed(1)}%` : '0.0%',
          value: s.value,
          won_value: s.wonValue,
        }
      })
      .sort((a, b) => Number(b.total) - Number(a.total)),
  }
}

const monthlySummary: Runner = async (ctx) => {
  const [dealRows, contactCount, payments, campaignCount, emailCount, replyCount] = await Promise.all([
    fetchAll<Record<string, unknown>>(() => {
      let q = ctx.supabase.from('deals').select('id, status, value, pipeline_id')
      q = windowed(q, 'created_at', ctx)
      if (ctx.pipelineId) q = q.eq('pipeline_id', ctx.pipelineId)
      return q
    }),
    (async () => {
      let q = ctx.supabase.from('contacts').select('*', { count: 'exact', head: true })
      q = windowed(q, 'created_at', ctx)
      const { count } = await q
      return count ?? 0
    })(),
    fetchAll<Record<string, unknown>>(() => {
      let q = ctx.supabase
        .from('payments')
        .select('amount, invoice:invoices(deal:deals(pipeline_id))')
        .eq('status', 'successful')
      q = windowed(q, 'created_at', ctx)
      return q
    }),
    (async () => {
      let q = ctx.supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .in('status', ['sent', 'sending'])
      q = windowed(q, 'created_at', ctx)
      const { count } = await q
      return count ?? 0
    })(),
    (async () => {
      let q = ctx.supabase.from('email_sends').select('*', { count: 'exact', head: true })
      q = windowed(q, 'sent_at', ctx)
      const { count } = await q
      return count ?? 0
    })(),
    (async () => {
      let q = ctx.supabase.from('email_replies').select('*', { count: 'exact', head: true })
      q = windowed(q, 'received_at', ctx)
      const { count } = await q
      return count ?? 0
    })(),
  ])

  const scopedPayments = ctx.pipelineId
    ? payments.filter(
        (p) =>
          ((p.invoice as { deal?: { pipeline_id?: string } } | null)?.deal?.pipeline_id ?? null) ===
          ctx.pipelineId,
      )
    : payments

  const won = dealRows.filter((d) => d.status === 'won')
  const lost = dealRows.filter((d) => d.status === 'lost')
  const revenue = scopedPayments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
  const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`

  return {
    columns: [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' },
      { key: 'details', label: 'How it is counted' },
    ],
    rows: [
      { metric: 'New contacts', value: contactCount, details: 'Contacts created in the period' },
      { metric: 'New deals', value: dealRows.length, details: 'Deals created in the period' },
      { metric: 'Deals won', value: won.length, details: 'Of those deals, marked won' },
      { metric: 'Deals lost', value: lost.length, details: 'Of those deals, marked lost' },
      {
        metric: 'Win rate',
        value: dealRows.length > 0 ? `${((won.length / dealRows.length) * 100).toFixed(1)}%` : '0.0%',
        details: 'Won / created',
      },
      {
        metric: 'Open pipeline value',
        value: gbp(
          dealRows.filter((d) => d.status === 'active').reduce((s, d) => s + Number(d.value ?? 0), 0),
        ),
        details: 'Value of deals still open',
      },
      { metric: 'Revenue received', value: gbp(revenue), details: 'Successful payments in the period' },
      { metric: 'Campaigns sent', value: campaignCount, details: 'Campaigns sent or sending' },
      { metric: 'Emails sent', value: emailCount, details: 'Individual emails delivered to Resend' },
      { metric: 'Replies received', value: replyCount, details: 'Inbound email replies' },
    ],
  }
}

// ---------------------------------------------------------------------------
// Revenue & finance
// ---------------------------------------------------------------------------

const payments: Runner = async (ctx) => {
  const rows = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase
      .from('payments')
      .select(
        `id, amount, status, payment_method, created_at,
         contact:contacts(first_name, last_name, email),
         invoice:invoices(invoice_number, type, deal:deals(pipeline_id, pipeline:pipelines(name)))`,
      )
      .order('created_at', { ascending: false })
    q = windowed(q, 'created_at', ctx)
    return q
  })

  const scoped = ctx.pipelineId
    ? rows.filter(
        (p) =>
          ((p.invoice as { deal?: { pipeline_id?: string } } | null)?.deal?.pipeline_id ?? null) ===
          ctx.pipelineId,
      )
    : rows

  return {
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'player', label: 'Player' },
      { key: 'email', label: 'Email' },
      { key: 'amount', label: 'Amount (GBP)' },
      { key: 'status', label: 'Status' },
      { key: 'method', label: 'Method' },
      { key: 'invoice_number', label: 'Invoice #' },
      { key: 'invoice_type', label: 'Invoice type' },
      { key: 'programme', label: 'Programme' },
    ],
    rows: scoped.map((p) => {
      const invoice = p.invoice as Record<string, unknown> | null
      return {
        date: dt(p.created_at as string),
        player: fullName(p.contact as never),
        email: (p.contact as { email?: string } | null)?.email ?? '',
        amount: p.amount ?? 0,
        status: p.status,
        method: p.payment_method ?? '',
        invoice_number: invoice?.invoice_number ?? '',
        invoice_type: invoice?.type ?? '',
        programme:
          ((invoice?.deal as { pipeline?: { name?: string } } | null)?.pipeline?.name) ?? '',
      }
    }),
  }
}

async function invoiceRows(ctx: ReportContext, snapshot: boolean) {
  const rows = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase
      .from('invoices')
      .select(
        `id, invoice_number, type, description, amount, status, due_date, sent_at, paid_at,
         created_at, payment_method, recipient_type,
         contact:contacts(first_name, last_name, email),
         deal:deals(pipeline_id, pipeline:pipelines(name))`,
      )
      .order('due_date', { ascending: true })
    if (snapshot) q = q.in('status', ['sent', 'viewed', 'overdue'])
    else q = windowed(q, 'created_at', ctx)
    return q
  })

  return ctx.pipelineId
    ? rows.filter(
        (i) => ((i.deal as { pipeline_id?: string } | null)?.pipeline_id ?? null) === ctx.pipelineId,
      )
    : rows
}

const invoices: Runner = async (ctx) => ({
  columns: [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'player', label: 'Player' },
    { key: 'email', label: 'Email' },
    { key: 'programme', label: 'Programme' },
    { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Amount (GBP)' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Raised' },
    { key: 'sent_at', label: 'Sent' },
    { key: 'due_date', label: 'Due' },
    { key: 'paid_at', label: 'Paid' },
    { key: 'method', label: 'Method' },
    { key: 'description', label: 'Description' },
  ],
  rows: (await invoiceRows(ctx, false)).map((i) => ({
    invoice_number: i.invoice_number,
    player: fullName(i.contact as never),
    email: (i.contact as { email?: string } | null)?.email ?? '',
    programme: ((i.deal as { pipeline?: { name?: string } } | null)?.pipeline?.name) ?? '',
    type: i.type,
    amount: i.amount ?? 0,
    status: i.status,
    created_at: day(i.created_at as string),
    sent_at: day(i.sent_at as string),
    due_date: day(i.due_date as string),
    paid_at: day(i.paid_at as string),
    method: i.payment_method ?? '',
    description: i.description ?? '',
  })),
})

/** Ageing is a snapshot: what is unpaid today, and by how far. */
const invoiceAgeing: Runner = async (ctx) => {
  const rows = await invoiceRows(ctx, true)
  const today = Date.now()

  const bracket = (days: number) => {
    if (days <= 0) return 'Not yet due'
    if (days <= 30) return '1–30 days'
    if (days <= 60) return '31–60 days'
    if (days <= 90) return '61–90 days'
    return '90+ days'
  }

  return {
    columns: [
      { key: 'invoice_number', label: 'Invoice #' },
      { key: 'player', label: 'Player' },
      { key: 'email', label: 'Email' },
      { key: 'programme', label: 'Programme' },
      { key: 'amount', label: 'Amount (GBP)' },
      { key: 'due_date', label: 'Due' },
      { key: 'days_overdue', label: 'Days overdue' },
      { key: 'bracket', label: 'Age bracket' },
      { key: 'status', label: 'Status' },
    ],
    rows: rows
      .map((i) => {
        const due = i.due_date ? new Date(i.due_date as string).getTime() : null
        const overdue = due ? Math.floor((today - due) / 86_400_000) : 0
        return {
          invoice_number: i.invoice_number,
          player: fullName(i.contact as never),
          email: (i.contact as { email?: string } | null)?.email ?? '',
          programme: ((i.deal as { pipeline?: { name?: string } } | null)?.pipeline?.name) ?? '',
          amount: i.amount ?? 0,
          due_date: day(i.due_date as string),
          days_overdue: Math.max(0, overdue),
          bracket: bracket(overdue),
          status: i.status,
        }
      })
      .sort((a, b) => Number(b.days_overdue) - Number(a.days_overdue)),
  }
}

const depositConversion: Runner = async (ctx) => {
  let pipelineQuery = ctx.supabase.from('pipelines').select('id, name')
  if (ctx.pipelineId) pipelineQuery = pipelineQuery.eq('id', ctx.pipelineId)
  const { data: pipelines } = await pipelineQuery

  const deposits = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase
      .from('invoices')
      .select('id, status, amount, deal:deals(pipeline_id)')
      .eq('type', 'deposit')
    q = windowed(q, 'created_at', ctx)
    return q
  })

  const dealRows = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase.from('deals').select('id, pipeline_id, status')
    q = windowed(q, 'created_at', ctx)
    return q
  })

  return {
    columns: [
      { key: 'programme', label: 'Programme' },
      { key: 'deals', label: 'Deals created' },
      { key: 'deposits_raised', label: 'Deposits raised' },
      { key: 'deposits_paid', label: 'Deposits paid' },
      { key: 'deposit_value', label: 'Deposit value paid (GBP)' },
      { key: 'paid_rate', label: 'Deposit payment rate' },
      { key: 'enrolments', label: 'Enrolments (won)' },
      { key: 'overall', label: 'Deal → enrolment rate' },
    ],
    rows: (pipelines ?? []).map((p) => {
      const mine = deposits.filter(
        (d) => (d.deal as { pipeline_id?: string } | null)?.pipeline_id === p.id,
      )
      const paid = mine.filter((d) => d.status === 'paid')
      const dealsHere = dealRows.filter((d) => d.pipeline_id === p.id)
      const won = dealsHere.filter((d) => d.status === 'won').length

      return {
        programme: p.name,
        deals: dealsHere.length,
        deposits_raised: mine.length,
        deposits_paid: paid.length,
        deposit_value: paid.reduce((s, d) => s + Number(d.amount ?? 0), 0),
        paid_rate: mine.length > 0 ? `${((paid.length / mine.length) * 100).toFixed(1)}%` : '0.0%',
        enrolments: won,
        overall:
          dealsHere.length > 0 ? `${((won / dealsHere.length) * 100).toFixed(1)}%` : '0.0%',
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Marketing
// ---------------------------------------------------------------------------

const campaigns: Runner = async (ctx) => {
  const rows = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase
      .from('campaigns')
      .select(
        `id, name, type, status, subject, scheduled_at, sent_at, created_at,
         total_recipients, processed_recipients, delivered_count, open_count,
         click_count, bounce_count, from_name, from_email,
         pipeline:pipelines(name)`,
      )
      .order('created_at', { ascending: false })
    q = windowed(q, 'created_at', ctx)
    return q
  })

  const rate = (part: number, whole: number) =>
    whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '0.0%'

  return {
    columns: [
      { key: 'name', label: 'Campaign' },
      { key: 'subject', label: 'Subject' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'programme', label: 'Programme' },
      { key: 'from', label: 'From' },
      { key: 'recipients', label: 'Recipients' },
      { key: 'processed', label: 'Processed' },
      { key: 'delivered', label: 'Delivered' },
      { key: 'opened', label: 'Opened' },
      { key: 'clicked', label: 'Clicked' },
      { key: 'bounced', label: 'Bounced' },
      { key: 'open_rate', label: 'Open rate' },
      { key: 'click_rate', label: 'Click rate' },
      { key: 'sent_at', label: 'Sent' },
    ],
    rows: rows.map((c) => {
      const processed = Number(c.processed_recipients ?? 0)
      return {
        name: c.name,
        subject: c.subject ?? '',
        type: c.type,
        status: c.status,
        programme: (c.pipeline as { name?: string } | null)?.name ?? 'All',
        from: [c.from_name, c.from_email].filter(Boolean).join(' '),
        recipients: c.total_recipients ?? 0,
        processed,
        delivered: c.delivered_count ?? 0,
        opened: c.open_count ?? 0,
        clicked: c.click_count ?? 0,
        bounced: c.bounce_count ?? 0,
        open_rate: rate(Number(c.open_count ?? 0), processed),
        click_rate: rate(Number(c.click_count ?? 0), processed),
        sent_at: dt((c.sent_at ?? c.scheduled_at) as string),
      }
    }),
  }
}

const campaignConversions: Runner = async (ctx) => {
  const campaignRows = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase
      .from('campaigns')
      .select('id, name, type, sent_at, total_recipients, pipeline_id, pipeline:pipelines(name)')
      .in('status', ['sent', 'sending'])
    q = windowed(q, 'created_at', ctx)
    if (ctx.pipelineId) q = q.eq('pipeline_id', ctx.pipelineId)
    return q
  })

  const ids = campaignRows.map((c) => String(c.id))
  const recipients = ids.length
    ? await fetchAll<Record<string, unknown>>(() =>
        ctx.supabase.from('campaign_recipients').select('campaign_id, contact_id').in('campaign_id', ids),
      )
    : []

  const dealRows = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase.from('deals').select('contact_id, status, value')
    q = windowed(q, 'created_at', ctx)
    return q
  })

  const byContact = new Map<string, { total: number; won: number; value: number }>()
  for (const d of dealRows) {
    const id = d.contact_id as string | null
    if (!id) continue
    const s = byContact.get(id) ?? { total: 0, won: 0, value: 0 }
    s.total += 1
    if (d.status === 'won') {
      s.won += 1
      s.value += Number(d.value ?? 0)
    }
    byContact.set(id, s)
  }

  return {
    columns: [
      { key: 'name', label: 'Campaign' },
      { key: 'type', label: 'Type' },
      { key: 'programme', label: 'Programme' },
      { key: 'recipients', label: 'Recipients' },
      { key: 'deals', label: 'Deals created' },
      { key: 'won', label: 'Deals won' },
      { key: 'rate', label: 'Recipient → deal rate' },
      { key: 'value', label: 'Won value (GBP)' },
      { key: 'sent_at', label: 'Sent' },
    ],
    rows: campaignRows.map((c) => {
      const contactIds = recipients
        .filter((r) => r.campaign_id === c.id)
        .map((r) => r.contact_id as string)
      let created = 0
      let won = 0
      let value = 0
      for (const id of contactIds) {
        const s = byContact.get(id)
        if (!s) continue
        created += s.total
        won += s.won
        value += s.value
      }
      const audience = contactIds.length || Number(c.total_recipients ?? 0)
      return {
        name: c.name,
        type: c.type,
        programme: (c.pipeline as { name?: string } | null)?.name ?? 'All',
        recipients: audience,
        deals: created,
        won,
        rate: audience > 0 ? `${((created / audience) * 100).toFixed(1)}%` : '0.0%',
        value,
        sent_at: dt(c.sent_at as string),
      }
    }),
  }
}

/**
 * Email delivery log.
 *
 * New. Engagement columns are read from the `*_at` timestamps, which is
 * where the Resend webhook writes them — the analytics page used to match
 * `status = 'opened'`, a value nothing ever sets.
 */
const emailSends: Runner = async (ctx) => {
  const rows = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase
      .from('email_sends')
      .select(
        `id, recipient_email, subject, from_name, from_email, status, sent_at,
         delivered_at, opened_at, clicked_at, bounced_at, open_count, click_count,
         error_message, campaign_id,
         contact:contacts!recipient_contact_id(first_name, last_name)`,
      )
      .order('sent_at', { ascending: false })
    q = windowed(q, 'sent_at', ctx)
    return q
  })

  const campaignNames = await labelMap(
    ctx.supabase,
    'campaigns',
    rows.map((r) => r.campaign_id as string),
    'name',
  )

  return {
    columns: [
      { key: 'sent_at', label: 'Sent' },
      { key: 'player', label: 'Player' },
      { key: 'recipient', label: 'To' },
      { key: 'subject', label: 'Subject' },
      { key: 'campaign', label: 'Campaign' },
      { key: 'status', label: 'Status' },
      { key: 'delivered_at', label: 'Delivered' },
      { key: 'opened_at', label: 'First opened' },
      { key: 'opens', label: 'Opens' },
      { key: 'clicked_at', label: 'First clicked' },
      { key: 'clicks', label: 'Clicks' },
      { key: 'bounced_at', label: 'Bounced' },
      { key: 'error', label: 'Error' },
    ],
    rows: rows.map((r) => ({
      sent_at: dt(r.sent_at as string),
      player: fullName(r.contact as never),
      recipient: r.recipient_email,
      subject: r.subject ?? '',
      campaign: campaignNames.get(String(r.campaign_id)) ?? 'Automation or one-off',
      status: r.status,
      delivered_at: dt(r.delivered_at as string),
      opened_at: dt(r.opened_at as string),
      opens: r.open_count ?? 0,
      clicked_at: dt(r.clicked_at as string),
      clicks: r.click_count ?? 0,
      bounced_at: dt(r.bounced_at as string),
      error: r.error_message ?? '',
    })),
  }
}

/**
 * Replies received.
 *
 * Replaces the old "SMS / Email responses" report, which selected
 * `sms_messages.body` and `from_number` — neither column exists, so the
 * report threw every time it was run. `sms_messages` holds no rows and no
 * SMS is sent or received, so this covers email only.
 */
const emailReplies: Runner = async (ctx) => {
  const rows = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase
      .from('email_replies')
      .select(
        `id, subject, from_email, from_name, body, body_preview, received_at,
         match_status, ai_intent, follow_up_status, read,
         contact:contacts(first_name, last_name, email)`,
      )
      .order('received_at', { ascending: false })
    q = windowed(q, 'received_at', ctx)
    return q
  })

  return {
    columns: [
      { key: 'received_at', label: 'Received' },
      { key: 'from_email', label: 'From' },
      { key: 'from_name', label: 'From name' },
      { key: 'player', label: 'Matched player' },
      { key: 'match_status', label: 'Match status' },
      { key: 'intent', label: 'Detected intent' },
      { key: 'follow_up_status', label: 'Follow-up status' },
      { key: 'read', label: 'Read' },
      { key: 'subject', label: 'Subject' },
      { key: 'message', label: 'Message' },
    ],
    rows: rows.map((r) => ({
      received_at: dt(r.received_at as string),
      from_email: r.from_email ?? '',
      from_name: r.from_name ?? '',
      player: fullName(r.contact as never),
      match_status: r.match_status ?? '',
      intent: r.ai_intent ?? '',
      follow_up_status: r.follow_up_status ?? '',
      read: Boolean(r.read),
      subject: r.subject ?? '',
      message: String(r.body ?? r.body_preview ?? '')
        .replace(/\s+/g, ' ')
        .slice(0, 800),
    })),
  }
}

/** Brochure downloads. New — brochure_leads was never exportable. */
const brochureLeads: Runner = async (ctx) => {
  const rows = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase
      .from('brochure_leads')
      .select(
        `brochure_id, contact_id, created_at,
         contact:contacts(first_name, last_name, email, phone, country, source)`,
      )
      .order('created_at', { ascending: false })
    q = windowed(q, 'created_at', ctx)
    return q
  })

  const brochures = await labelMap(
    ctx.supabase,
    'website_brochures',
    rows.map((r) => r.brochure_id as string),
    'title',
  )

  return {
    columns: [
      { key: 'created_at', label: 'Requested' },
      { key: 'brochure', label: 'Brochure' },
      { key: 'player', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'country', label: 'Country' },
      { key: 'source', label: 'Contact source' },
    ],
    rows: rows.map((r) => ({
      created_at: dt(r.created_at as string),
      brochure: brochures.get(String(r.brochure_id)) ?? '',
      player: fullName(r.contact as never),
      email: (r.contact as { email?: string } | null)?.email ?? '',
      phone: (r.contact as { phone?: string } | null)?.phone ?? '',
      country: (r.contact as { country?: string } | null)?.country ?? '',
      source: (r.contact as { source?: string } | null)?.source ?? '',
    })),
  }
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

const contacts: Runner = async (ctx) => {
  const rows = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase
      .from('contacts')
      .select(
        `id, first_name, last_name, email, phone, date_of_birth, gender, country, state, city,
         club_name, position, graduation_year, gpa, preferred_programme, sport,
         parent_name, parent_email, parent_phone, source, source_detail,
         subscription_status, email_subscribed, sms_subscribed, created_at, last_activity_at`,
      )
      .order('created_at', { ascending: false })
    q = windowed(q, 'created_at', ctx)
    return q
  })

  return {
    columns: [
      { key: 'first_name', label: 'First name' },
      { key: 'last_name', label: 'Last name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'date_of_birth', label: 'Date of birth' },
      { key: 'gender', label: 'Gender' },
      { key: 'country', label: 'Country' },
      { key: 'state', label: 'State/Region' },
      { key: 'city', label: 'City' },
      { key: 'club_name', label: 'Club' },
      { key: 'position', label: 'Position' },
      { key: 'graduation_year', label: 'Graduation year' },
      { key: 'gpa', label: 'GPA' },
      { key: 'preferred_programme', label: 'Preferred programme' },
      { key: 'sport', label: 'Sport' },
      { key: 'parent_name', label: 'Parent name' },
      { key: 'parent_email', label: 'Parent email' },
      { key: 'parent_phone', label: 'Parent phone' },
      { key: 'source', label: 'Source' },
      { key: 'source_detail', label: 'Source detail' },
      { key: 'subscription_status', label: 'Subscription status' },
      { key: 'email_subscribed', label: 'Email subscribed' },
      { key: 'sms_subscribed', label: 'SMS subscribed' },
      { key: 'created_at', label: 'Created' },
      { key: 'last_activity_at', label: 'Last activity' },
    ],
    rows: rows.map((c) => ({
      ...c,
      date_of_birth: day(c.date_of_birth as string),
      created_at: dt(c.created_at as string),
      last_activity_at: dt(c.last_activity_at as string),
    })),
  }
}

/** Website form submissions. New — 70 rows that nothing could export. */
const formSubmissions: Runner = async (ctx) => {
  const rows = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase
      .from('form_submissions')
      .select(
        `id, form_id, form_source, status, error_message, created_at, processed_at,
         processing_time_ms, payload,
         contact:contacts(first_name, last_name, email)`,
      )
      .order('created_at', { ascending: false })
    q = windowed(q, 'created_at', ctx)
    return q
  })

  return {
    columns: [
      { key: 'created_at', label: 'Submitted' },
      { key: 'form_id', label: 'Form' },
      { key: 'form_source', label: 'Source' },
      { key: 'player', label: 'Matched player' },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Status' },
      { key: 'error_message', label: 'Error' },
      { key: 'processed_at', label: 'Processed' },
      { key: 'processing_ms', label: 'Processing (ms)' },
      { key: 'payload', label: 'Submitted fields' },
    ],
    rows: rows.map((s) => ({
      created_at: dt(s.created_at as string),
      form_id: s.form_id ?? '',
      form_source: s.form_source ?? '',
      player: fullName(s.contact as never),
      email: (s.contact as { email?: string } | null)?.email ?? '',
      status: s.status,
      error_message: s.error_message ?? '',
      processed_at: dt(s.processed_at as string),
      processing_ms: s.processing_time_ms ?? '',
      payload: JSON.stringify(s.payload ?? {}),
    })),
  }
}

/**
 * Automation activity.
 *
 * The old version was broken in three ways at once: it filtered on
 * `automation_logs.executed_at` (the column is `sent_at`), joined
 * `automation_logs → automations` (there is no such foreign key — the link
 * runs through `automation_steps`), and read `automation_steps.name` and
 * `.action_type`, neither of which exists. Every run threw.
 */
const automations: Runner = async (ctx) => {
  const logs = await fetchAll<Record<string, unknown>>(() => {
    let q = ctx.supabase
      .from('automation_logs')
      .select('id, step_id, deal_id, status, error_message, sent_at, log_type')
      .order('sent_at', { ascending: false })
    q = windowed(q, 'sent_at', ctx)
    return q
  })

  const stepIds = [...new Set(logs.map((l) => l.step_id as string).filter(Boolean))]
  const steps = stepIds.length
    ? await fetchAll<Record<string, unknown>>(() =>
        ctx.supabase
          .from('automation_steps')
          .select('id, step_order, step_type, delay_days, delay_hours, automation:automations(name, pipeline_id)')
          .in('id', stepIds),
      )
    : []
  const stepsById = new Map(steps.map((s) => [String(s.id), s]))

  const dealIds = [...new Set(logs.map((l) => l.deal_id as string).filter(Boolean))]
  const dealRows = dealIds.length
    ? await fetchAll<Record<string, unknown>>(() =>
        ctx.supabase
          .from('deals')
          .select('id, title, pipeline_id, contact:contacts(first_name, last_name, email), pipeline:pipelines(name)')
          .in('id', dealIds),
      )
    : []
  const dealsById = new Map(dealRows.map((d) => [String(d.id), d]))

  const scoped = ctx.pipelineId
    ? logs.filter((l) => {
        const step = stepsById.get(String(l.step_id))
        const automationPipeline = (step?.automation as { pipeline_id?: string } | null)?.pipeline_id
        const dealPipeline = dealsById.get(String(l.deal_id))?.pipeline_id
        return automationPipeline === ctx.pipelineId || dealPipeline === ctx.pipelineId
      })
    : logs

  return {
    columns: [
      { key: 'sent_at', label: 'When' },
      { key: 'automation', label: 'Automation' },
      { key: 'step', label: 'Step' },
      { key: 'step_type', label: 'Action' },
      { key: 'player', label: 'Player' },
      { key: 'email', label: 'Email' },
      { key: 'programme', label: 'Programme' },
      { key: 'status', label: 'Outcome' },
      { key: 'error_message', label: 'Error' },
    ],
    rows: scoped.map((l) => {
      const step = stepsById.get(String(l.step_id))
      const deal = dealsById.get(String(l.deal_id))
      return {
        sent_at: dt(l.sent_at as string),
        automation: (step?.automation as { name?: string } | null)?.name ?? '',
        step: step?.step_order != null ? `Step ${step.step_order}` : '',
        step_type: step?.step_type ?? l.log_type ?? '',
        player: fullName(deal?.contact as never) || (deal?.title as string) || '',
        email: (deal?.contact as { email?: string } | null)?.email ?? '',
        programme: (deal?.pipeline as { name?: string } | null)?.name ?? '',
        status: l.status,
        error_message: l.error_message ?? '',
      }
    }),
  }
}

/** Lists and tags, with how many contacts each holds. */
const audience: Runner = async (ctx) => {
  const [lists, tags] = await Promise.all([
    fetchAll<Record<string, unknown>>(() =>
      ctx.supabase.from('lists').select('id, name, description, is_dynamic, created_at').order('name'),
    ),
    fetchAll<Record<string, unknown>>(() =>
      ctx.supabase.from('tags').select('id, name, category, description, created_at').order('name'),
    ),
  ])

  // Counted with head:true so no membership rows cross the wire — the
  // join tables hold ~650,000 rows between them.
  const listCounts = await Promise.all(
    lists.map(async (l) => {
      const { count } = await ctx.supabase
        .from('contact_lists')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', l.id)
      return count ?? 0
    }),
  )
  const tagCounts = await Promise.all(
    tags.map(async (t) => {
      const { count } = await ctx.supabase
        .from('contact_tags')
        .select('*', { count: 'exact', head: true })
        .eq('tag_id', t.id)
      return count ?? 0
    }),
  )

  return {
    columns: [
      { key: 'kind', label: 'Type' },
      { key: 'name', label: 'Name' },
      { key: 'category', label: 'Category' },
      { key: 'contacts', label: 'Contacts' },
      { key: 'description', label: 'Description' },
      { key: 'created_at', label: 'Created' },
    ],
    rows: [
      ...lists.map((l, i) => ({
        kind: 'List',
        name: l.name,
        category: l.is_dynamic ? 'Dynamic' : 'Static',
        contacts: listCounts[i],
        description: l.description ?? '',
        created_at: day(l.created_at as string),
      })),
      ...tags.map((t, i) => ({
        kind: 'Tag',
        name: t.name,
        category: t.category ?? '',
        contacts: tagCounts[i],
        description: t.description ?? '',
        created_at: day(t.created_at as string),
      })),
    ].sort((a, b) => Number(b.contacts) - Number(a.contacts)),
  }
}

export const RUNNERS: Record<string, Runner> = {
  deals,
  'stage-movements': stageMovements,
  recruiters,
  'monthly-summary': monthlySummary,
  payments,
  invoices,
  'invoice-ageing': invoiceAgeing,
  'deposit-conversion': depositConversion,
  campaigns,
  'campaign-conversions': campaignConversions,
  'email-sends': emailSends,
  'email-replies': emailReplies,
  'brochure-leads': brochureLeads,
  contacts,
  'form-submissions': formSubmissions,
  automations,
  audience,
}

export { toCSV }
