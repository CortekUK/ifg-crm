// Canonical source of truth for automation step types, trigger types, and
// automation types. Used by Supabase Edge Functions (Deno runtime).
//
// MIRROR: lib/constants/automations.ts
// tsconfig.json excludes supabase/functions/, so these two files cannot share
// an import. Any change here MUST be made in the mirror file too, and the DB
// check constraints in the latest automation-constants migration must agree.

export const STEP_TYPES = [
  'send_email',
  'wait',
  'wait_until_before_date',
  'wait_until_meeting_ends',
  'send_sms',
  'move_to_stage',
  'create_deal',
  'create_invoice',
  'notify',
  'create_portal_account',
] as const
export type StepType = typeof STEP_TYPES[number]

export const TRIGGER_TYPES = [
  'form_submission',
  'enters_stage',
  'stage_change',
  'invoice_created',
  'invoice_overdue',
  'payment_received',
  'time_before_date',
] as const
export type TriggerType = typeof TRIGGER_TYPES[number]

export const AUTOMATION_TYPES = [
  'deal_creation',
  'initial_contact',
  'follow_up',
  'application_received',
  'interview_reminder',
  'meeting_scheduler',
  'post_interview',
  'invoice_generation',
  'deposit_invoice',
  'payment_overdue',
  'welcome_sequence',
  'pre_departure',
  'list_assignment',
  // Generic "deal stalled in this stage for N days" reminder. Single
  // email with a configurable wait, used for stages like Document
  // Collecting where the recruiter just wants a nudge if the contact
  // hasn't moved on in a week.
  'stage_reminder',
  'custom',
] as const
export type AutomationType = typeof AUTOMATION_TYPES[number]

/**
 * A pipeline name as a PLAYER should read it.
 *
 * `{{programme}}` resolved to the pipeline's own name, which is an internal
 * label in block capitals: players received "we have received your application
 * for UNIVERSITY 2027". It is shouted, and it is the name staff use on the
 * board rather than the name the programme is sold under.
 *
 * The labels here are not invented — they are the same ones already shown to
 * customers on invoices and Stripe checkout lines (lib/payments/programmes.ts)
 * and on the public website, so an email now agrees with the receipt.
 *
 * The intake year is kept when the pipeline name carries one, because which
 * year a player applied for is the useful half of the name.
 *
 * Anything unrecognised is title-cased rather than passed through, so a
 * pipeline added later reads as a name instead of a shout.
 */
export function programmeLabelFromPipeline(pipelineName: string | null | undefined): string | null {
  const raw = (pipelineName ?? '').trim()
  if (!raw) return null

  const upper = raw.toUpperCase()
  const year = raw.match(/\b(20\d{2})\b/)?.[1] ?? null

  let base: string | null = null
  if (upper.includes('GAP')) base = 'Gap Year Programme'
  else if (upper.includes('UNIVERSITY') || upper.includes('UCLAN')) base = 'University Programme'
  else if (upper.includes('RESIDENCY') || upper.includes('SUMMER')) base = 'Summer Residency'

  if (!base) {
    // Title-case the words, leaving years and short tokens alone.
    base = raw
      .toLowerCase()
      .split(/\s+/)
      .map((w) => (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ')
    return base
  }

  return year ? `${base} ${year}` : base
}
