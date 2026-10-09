import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Daily cron that fires the time-based automation triggers:
//   * invoice_overdue   — flips invoice status to 'overdue' once due_date
//                         passes; the on_invoice_overdue DB trigger handles
//                         enrollment.
//   * time_before_date  — scans deals for a configured date column matching
//                         today + days_before, and enrols them into the
//                         matching pre_departure-style automation.
//
// Schedule it once a day; runs are idempotent — invoice flips are guarded
// by the `WHEN` clause on the DB trigger, and time_before_date enrollment
// re-checks for an existing active enrollment per deal/automation.
//
// vercel.json must include:
//   { "path": "/api/cron/check-time-triggers", "schedule": "0 9 * * *" }

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

// Whitelist of date columns that time_before_date automations can target.
// This list MUST match the columns added in migration 093.
const ALLOWED_DATE_FIELDS = new Set([
  'programme_start_date',
  'interview_date',
  'arrival_date',
])

interface RunResult {
  invoicesMarkedOverdue: number
  invoicesError?: string
  timeBeforeDateEnrolled: number
  timeBeforeDateAutomations: number
  timeBeforeDateError?: string
  notificationsAged: number
  notificationsAgedError?: string
}

// How long a notification stays "new" in the bell.
//
// Nothing ever aged out, so the Super Admin's bell reached 1,368 unread going
// back to May and the count stopped carrying any information — a real alert
// landed in a pile nobody could triage. Marking old ones read (rather than
// deleting them) means the badge reflects recent activity while the history
// stays intact and readable in the dropdown.
const NOTIFICATION_UNREAD_DAYS = 30

export async function GET(request: NextRequest) {
  // Auth — same gate as the other cron routes.
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
  const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (!isVercelCron && !hasValidSecret && !isDevelopment) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const result: RunResult = {
    notificationsAged: 0,
    invoicesMarkedOverdue: 0,
    timeBeforeDateEnrolled: 0,
    timeBeforeDateAutomations: 0,
  }

  // ------------------------------------------------------------------
  // 1. Mark every invoice that has crossed its due_date as 'overdue'.
  // The on_invoice_overdue DB trigger picks up the status change and
  // enrols the deal into matching automations.
  // ------------------------------------------------------------------
  const today = new Date().toISOString().slice(0, 10)
  const { data: flipped, error: flipError } = await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .lt('due_date', today)
    .in('status', ['sent', 'viewed'])
    .select('id')

  if (flipError) {
    console.error('check-time-triggers: failed to flip overdue invoices', flipError)
    result.invoicesError = flipError.message
  } else {
    result.invoicesMarkedOverdue = flipped?.length ?? 0
  }

  // ------------------------------------------------------------------
  // 2. Enrol deals into time_before_date automations whose target date
  // (deal.<date_field>) is exactly `days_before` days in the future.
  // ------------------------------------------------------------------
  try {
    const { data: automations, error: autoError } = await supabase
      .from('automations')
      .select('id, pipeline_id, config')
      .eq('trigger_type', 'time_before_date')
      .eq('is_active', true)

    if (autoError) {
      throw autoError
    }

    result.timeBeforeDateAutomations = automations?.length ?? 0

    for (const automation of automations || []) {
      const cfg = (automation.config ?? {}) as { date_field?: string; days_before?: number }
      const dateField = cfg.date_field
      const daysBefore = cfg.days_before

      // Skip half-configured automations rather than throwing — the cron
      // has to keep running for the others.
      if (!dateField || !ALLOWED_DATE_FIELDS.has(dateField)) {
        console.warn(`Automation ${automation.id} has invalid date_field "${dateField}", skipping`)
        continue
      }
      if (typeof daysBefore !== 'number' || daysBefore < 0) {
        console.warn(`Automation ${automation.id} has invalid days_before "${daysBefore}", skipping`)
        continue
      }

      // Target date the deal should hit `days_before` days from now, as a
      // whole-day range rather than an instant.
      //
      // Two of the three whitelisted columns are `date`, but interview_date is
      // `timestamptz` — and that is the one Calendly fills. An equality test
      // against '2026-11-05' compares it to midnight, so a meeting booked for
      // 14:30 never matched and a pre-departure sequence counting back from
      // the interview date could not enrol anybody. A half-open day range is
      // correct for both column types.
      const target = new Date()
      target.setDate(target.getDate() + daysBefore)
      const dayAfter = new Date(target)
      dayAfter.setDate(dayAfter.getDate() + 1)
      const dayAfterDate = dayAfter.toISOString().slice(0, 10)

      // Find candidate deals.
      //
      // The window runs from TODAY to the target day, not just the target day
      // itself. Matching only the exact day meant a date entered late was
      // missed forever: a programme starting in 10 days, on a 30-day
      // automation, was never 30 days away again, so the player received
      // nothing — not the 30-day email, not the 7-day one. Staff fill these
      // dates in when they learn them, which is routinely inside the window.
      //
      // Enrolling late is the right call: the sequence runs its waits from
      // enrolment, so the player still gets the run-up, just compressed.
      // Deals whose date has already passed stay excluded by the `gte(today)`
      // bound, and the existing already-enrolled guard below stops anyone
      // being caught twice.
      const todayDate = new Date().toISOString().slice(0, 10)
      let dealsQuery = supabase
        .from('deals')
        .select(`id, ${dateField}`)
        .gte(dateField, todayDate)
        .lt(dateField, dayAfterDate)
      if (automation.pipeline_id) {
        dealsQuery = dealsQuery.eq('pipeline_id', automation.pipeline_id)
      }

      // supabase-js infers row types from a LITERAL select string and cannot
      // parse one built from a variable, so the shape is asserted here — the
      // columns are `id` plus whichever whitelisted date field this
      // automation targets. Same arrangement as the bulk-import route.
      const { data: deals, error: dealsError } = (await dealsQuery) as unknown as {
        data: (Record<string, unknown> & { id: string })[] | null
        error: { message: string } | null
      }
      if (dealsError) {
        console.error(`check-time-triggers: deal scan failed for automation ${automation.id}`, dealsError)
        continue
      }
      if (!deals || deals.length === 0) continue

      const dealIds = deals.map((d) => d.id)
      const dateByDeal = new Map<string, string | null>(
        deals.map((d) => [d.id, (d[dateField] as string | null) ?? null]),
      )

      // Skip deals that are already actively enrolled in this automation.
      const { data: existing } = await supabase
        .from('automation_enrollments')
        .select('deal_id')
        .eq('automation_id', automation.id)
        .in('deal_id', dealIds)
        .in('status', ['active', 'paused'])
      const alreadyEnrolled = new Set((existing || []).map((e) => e.deal_id))
      const targets = dealIds.filter((id) => !alreadyEnrolled.has(id))
      if (targets.length === 0) continue

      // Every step, in order — not just the first.
      //
      // A Pre-Departure sequence is now anchored to the deal's date
      // (wait_until_before_date steps), and the window above deliberately
      // enrols deals whose date is closer than the first reminder. Starting
      // everyone at step one would then fire the reminders whose moment had
      // already gone: a programme 10 days away would send "30 days to go" and
      // "14 days to go" within minutes of each other. QA asked for the
      // opposite — send the reminders that are STILL AHEAD, and skip the ones
      // the date has already overtaken.
      const { data: steps, error: stepError } = await supabase
        .from('automation_steps')
        .select('id, step_type, delay_days, delay_hours, step_order')
        .eq('automation_id', automation.id)
        .order('step_order', { ascending: true })

      if (stepError || !steps || steps.length === 0) {
        console.warn(`Automation ${automation.id} has no steps, skipping enrollment`)
        continue
      }

      const firstStep = steps[0]
      const now = new Date()

      // Where should THIS deal start, and when is that step due?
      // Returns null when every reminder has already passed — nothing useful
      // is left to send, so the deal is not enrolled at all.
      const startFor = (dealId: string): { stepId: string; at: Date } | null => {
        const rawDate = dateByDeal.get(dealId)

        for (const step of steps) {
          if (step.step_type !== 'wait_until_before_date') continue
          if (!rawDate) return { stepId: step.id as string, at: now }
          const target = new Date(rawDate)
          if (isNaN(target.getTime())) return { stepId: step.id as string, at: now }
          const offsetMs =
            (step.delay_days ?? 0) * 24 * 60 * 60 * 1000 +
            (step.delay_hours ?? 0) * 60 * 60 * 1000
          const due = new Date(target.getTime() - offsetMs)
          if (due.getTime() > now.getTime()) return { stepId: step.id as string, at: due }
        }

        // No date-relative steps at all: the legacy shape, where the sequence
        // runs on fixed waits from enrolment. Unchanged.
        if (!steps.some((st) => st.step_type === 'wait_until_before_date')) {
          let at = now
          if (firstStep.step_type === 'wait') {
            const ms =
              (firstStep.delay_days ?? 0) * 24 * 60 * 60 * 1000 +
              (firstStep.delay_hours ?? 0) * 60 * 60 * 1000
            at = new Date(now.getTime() + ms)
          }
          return { stepId: firstStep.id as string, at }
        }

        return null
      }

      const rows = targets
        .map((dealId) => {
          const start = startFor(dealId)
          if (!start) return null
          return {
            automation_id: automation.id,
            deal_id: dealId,
            status: 'active',
            current_step_id: start.stepId,
            next_step_at: start.at.toISOString(),
            enrolled_at: now.toISOString(),
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)

      if (rows.length === 0) continue

      const { error: insertError, count } = await supabase
        .from('automation_enrollments')
        .insert(rows, { count: 'exact' })

      if (insertError) {
        console.error(`check-time-triggers: enrollment insert failed for automation ${automation.id}`, insertError)
        continue
      }

      result.timeBeforeDateEnrolled += count ?? rows.length
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('check-time-triggers: time_before_date pass failed', err)
    result.timeBeforeDateError = msg
  }

  // ---- AGE OUT STALE BELL NOTIFICATIONS ----
  try {
    const cutoff = new Date(Date.now() - NOTIFICATION_UNREAD_DAYS * 86_400_000).toISOString()
    const { data: aged, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
      .lt('created_at', cutoff)
      .select('id')
    if (error) throw new Error(error.message)
    result.notificationsAged = aged?.length ?? 0
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('check-time-triggers: notification ageing failed', err)
    result.notificationsAgedError = msg
  }

  return NextResponse.json({
    success: !result.invoicesError && !result.timeBeforeDateError && !result.notificationsAgedError,
    timestamp: new Date().toISOString(),
    ...result,
  })
}

// Vercel sends GET, but allow POST for manual invocation in tests.
export async function POST(request: NextRequest) {
  return GET(request)
}
