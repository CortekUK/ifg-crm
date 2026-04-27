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
}

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

      // Target date the deal should hit `days_before` days from now.
      const target = new Date()
      target.setDate(target.getDate() + daysBefore)
      const targetDate = target.toISOString().slice(0, 10)

      // Find candidate deals.
      let dealsQuery = supabase
        .from('deals')
        .select('id')
        .eq(dateField, targetDate)
      if (automation.pipeline_id) {
        dealsQuery = dealsQuery.eq('pipeline_id', automation.pipeline_id)
      }

      const { data: deals, error: dealsError } = await dealsQuery
      if (dealsError) {
        console.error(`check-time-triggers: deal scan failed for automation ${automation.id}`, dealsError)
        continue
      }
      if (!deals || deals.length === 0) continue

      const dealIds = deals.map((d) => d.id)

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

      // Get the first step so the enrollment knows where to start.
      const { data: firstStep, error: stepError } = await supabase
        .from('automation_steps')
        .select('id, step_type, delay_days, delay_hours')
        .eq('automation_id', automation.id)
        .order('step_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (stepError || !firstStep) {
        console.warn(`Automation ${automation.id} has no steps, skipping enrollment`)
        continue
      }

      const now = new Date()
      let nextStepAt = now
      if (firstStep.step_type === 'wait') {
        const ms =
          (firstStep.delay_days ?? 0) * 24 * 60 * 60 * 1000 +
          (firstStep.delay_hours ?? 0) * 60 * 60 * 1000
        nextStepAt = new Date(now.getTime() + ms)
      }

      const rows = targets.map((dealId) => ({
        automation_id: automation.id,
        deal_id: dealId,
        status: 'active',
        current_step_id: firstStep.id,
        next_step_at: nextStepAt.toISOString(),
        enrolled_at: now.toISOString(),
      }))

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

  return NextResponse.json({
    success: !result.invoicesError && !result.timeBeforeDateError,
    timestamp: new Date().toISOString(),
    ...result,
  })
}

// Vercel sends GET, but allow POST for manual invocation in tests.
export async function POST(request: NextRequest) {
  return GET(request)
}
