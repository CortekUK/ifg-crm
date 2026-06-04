// Compilers that turn an automation type + config into the concrete step rows
// that get inserted into automation_steps.
//
// Single source of truth for "what shape does automation type X have":
// every type is a function in AUTOMATION_STEP_COMPILERS. To change a type's
// shape, edit the compiler. To add a type, add an entry to the record and
// the matching literal to lib/constants/automations.ts — the Record<>
// signature then forces the entry to exist.
//
// Behaviour of this module mirrors the previous inlined logic in
// useAutomations.ts (buildAutomationSteps). Step order is stamped by the
// caller, not by the compilers.

import type { AutomationType } from '@/lib/constants/automations'
import type { AutomationConfig } from '@/lib/types/automations'

export interface CompiledStep {
  step_type:
    | 'send_email'
    | 'wait'
    | 'wait_until_before_date'
    | 'wait_until_meeting_ends'
    | 'send_sms'
    | 'move_to_stage'
    | 'create_deal'
    | 'create_invoice'
  delay_days: number
  delay_hours: number
  email_template_id: string | null
  sms_content: string | null
  target_stage_id: string | null
  conditions: Record<string, unknown> | null
}

type Compiler = (config: AutomationConfig | null | undefined) => CompiledStep[]

const DEFAULT_WAIT_DAYS = [3, 5, 7] as const

function emailStep(templateId: string | null = null): CompiledStep {
  return {
    step_type: 'send_email',
    delay_days: 0,
    delay_hours: 0,
    email_template_id: templateId,
    sms_content: null,
    target_stage_id: null,
    conditions: null,
  }
}

function waitStep(delayDays: number): CompiledStep {
  return {
    step_type: 'wait',
    delay_days: delayDays,
    delay_hours: 0,
    email_template_id: null,
    sms_content: null,
    target_stage_id: null,
    conditions: null,
  }
}

function createDealStep(): CompiledStep {
  return {
    step_type: 'create_deal',
    delay_days: 0,
    delay_hours: 0,
    email_template_id: null,
    sms_content: null,
    target_stage_id: null,
    conditions: null,
  }
}

function createInvoiceStep(): CompiledStep {
  return {
    step_type: 'create_invoice',
    delay_days: 0,
    delay_hours: 0,
    email_template_id: null,
    sms_content: null,
    target_stage_id: null,
    conditions: null,
  }
}

function moveToStageStep(targetStageId: string): CompiledStep {
  return {
    step_type: 'move_to_stage',
    delay_days: 0,
    delay_hours: 0,
    email_template_id: null,
    sms_content: null,
    target_stage_id: targetStageId,
    conditions: null,
  }
}

// "Wait until N hours/days before <field>" step. Resolved to a concrete
// next_step_at by the processor at scheduling time, by reading the deal's
// `field` value and subtracting (delay_days*24h + delay_hours*1h) from it.
// If the field isn't set yet, the enrollment is parked (next_step_at NULL)
// and re-checked on each cron run by sweepBeforeDateWaits().
function waitUntilBeforeDateStep(
  field: string,
  beforeValue: number,
  beforeUnit: 'hours' | 'days',
): CompiledStep {
  return {
    step_type: 'wait_until_before_date',
    delay_days: beforeUnit === 'days' ? beforeValue : 0,
    delay_hours: beforeUnit === 'hours' ? beforeValue : 0,
    email_template_id: null,
    sms_content: null,
    target_stage_id: null,
    conditions: { field },
  }
}

// Shared shape used by initial_contact and follow_up: 3 emails interleaved
// with 2 waits, with optional final move_to_stage for follow_up.
// Uses `||` (not `??`) for wait fallbacks to match the legacy behaviour
// of treating 0 as "use the default", preserving Option B behaviour-parity.
function threeEmailSequence(
  config: AutomationConfig | null | undefined,
  options: { finalStageId?: string | null } = {},
): CompiledStep[] {
  const emails = config?.emails ?? []
  const waitDays = config?.wait_days ?? []
  const steps: CompiledStep[] = [
    emailStep(emails[0]?.template_id || null),
    waitStep(waitDays[0] || DEFAULT_WAIT_DAYS[0]),
    emailStep(emails[1]?.template_id || null),
    waitStep(waitDays[1] || DEFAULT_WAIT_DAYS[1]),
    emailStep(emails[2]?.template_id || null),
  ]
  if (options.finalStageId) {
    steps.push(waitStep(waitDays[2] || DEFAULT_WAIT_DAYS[2]))
    steps.push(moveToStageStep(options.finalStageId))
  }
  return appendDormantReminderTail(steps, config)
}

const DEFAULT_DORMANT_INTERVAL_DAYS = 21

// Optional recurring "re-engagement" tail for initial_contact / follow_up.
// When dormant_reminder_enabled (and a no_reply/Dormant stage is set), append:
//   move_to_stage → Dormant   (explicit; the looping enrollment never
//                              completes, so the no_reply-on-completion move
//                              can't fire)
//   send_email    → reminder  (first reminder, immediate on entering Dormant)
//   wait          → interval  (default 21 days)
// The engine loops the reminder+wait forever (see deriveRecurringMeta) until
// the deal leaves Dormant, replies, or is unenrolled.
function appendDormantReminderTail(
  steps: CompiledStep[],
  config: AutomationConfig | null | undefined,
): CompiledStep[] {
  if (!config?.dormant_reminder_enabled || !config?.no_reply_stage_id) {
    return steps
  }
  return [
    ...steps,
    moveToStageStep(config.no_reply_stage_id),
    emailStep(config.dormant_reminder_template_id || null),
    waitStep(config.dormant_reminder_interval_days || DEFAULT_DORMANT_INTERVAL_DAYS),
  ]
}

// Recurring metadata persisted to automations.config so the engine knows to
// loop instead of completing. Derived from the compiled shape so the loop
// target stays correct even if the base sequence length changes. The reminder
// send is the second-to-last compiled step (… reminder, wait); step_order is
// 1-based, so its order == steps.length - 1.
export function deriveRecurringMeta(
  type: AutomationType | undefined,
  config: AutomationConfig | null | undefined,
): {
  recurring: boolean
  recurring_loop_to_order: number | null
  recurring_anchor_stage_id: string | null
} {
  if (!config?.dormant_reminder_enabled || !config?.no_reply_stage_id) {
    return { recurring: false, recurring_loop_to_order: null, recurring_anchor_stage_id: null }
  }
  const steps = compileAutomationSteps(type, config)
  return {
    recurring: true,
    recurring_loop_to_order: steps.length - 1,
    recurring_anchor_stage_id: config.no_reply_stage_id,
  }
}

// Shared shape for the open-ended "emails + waits" types
// (application_received, interview_reminder, post_interview, welcome_sequence,
// payment_overdue, pre_departure, custom). If the user configured no emails
// but set single_template_id, emit exactly one email.
function variableEmailSequence(config: AutomationConfig | null | undefined): CompiledStep[] {
  const emails = config?.emails ?? []
  const waitDays = config?.wait_days ?? []
  const steps: CompiledStep[] = []
  if (emails.length > 0) {
    emails.forEach((email, i) => {
      if (i > 0 && waitDays[i - 1]) {
        steps.push(waitStep(waitDays[i - 1] || DEFAULT_WAIT_DAYS[0]))
      }
      steps.push(emailStep(email?.template_id || null))
    })
  } else if (config?.single_template_id) {
    steps.push(emailStep(config.single_template_id))
  }
  return steps
}

// meeting_scheduler: send a "schedule your meeting" email immediately when
// the trigger fires, then for each configured reminder (max 2) emit a
// wait_until_before_date step + a send_email step. Reminders fire relative
// to deals.interview_date once it's set by the player's booking flow.
function meetingSchedulerSequence(
  config: AutomationConfig | null | undefined,
): CompiledStep[] {
  const scheduleTemplateId = config?.schedule_email_template_id || null
  const reminders = (config?.reminders || []).filter(
    (r) => r.template_id && r.before_value > 0,
  )
  const steps: CompiledStep[] = [emailStep(scheduleTemplateId)]
  for (const reminder of reminders) {
    steps.push(
      waitUntilBeforeDateStep('interview_date', reminder.before_value, reminder.before_unit),
    )
    steps.push(emailStep(reminder.template_id))
  }
  // Final step: wait for the booked meeting to end. The enrollment naturally
  // completes once this step's next_step_at elapses (no further steps after
  // it). Resolves from the deal's most recent scheduled calendly_event.end_time.
  steps.push({
    step_type: 'wait_until_meeting_ends',
    delay_days: 0,
    delay_hours: 0,
    email_template_id: null,
    sms_content: null,
    target_stage_id: null,
    conditions: null,
  })
  return steps
}

// stage_reminder: a single "deal has been parked in this stage for too
// long" nudge. Wait first, then send. Default 7 days, configurable via
// wait_days[0]. Template comes from emails[0] (UI uses the same picker
// as the multi-email sequences) with single_template_id as a fallback
// for older callers.
function stageReminderSequence(
  config: AutomationConfig | null | undefined,
): CompiledStep[] {
  const days = config?.wait_days?.[0] || 7
  const templateId =
    config?.emails?.[0]?.template_id || config?.single_template_id || null
  return [waitStep(days), emailStep(templateId)]
}

// deposit_invoice always emits at least 4 emails with waits between,
// falling back to a 3/5/7-day cadence if wait_days is unset past index 0.
function depositInvoiceSequence(config: AutomationConfig | null | undefined): CompiledStep[] {
  const emails = config?.emails ?? []
  const waitDays = config?.wait_days ?? []
  const maxEmails = Math.max(emails.length, 4)
  const steps: CompiledStep[] = []
  for (let i = 0; i < maxEmails; i++) {
    if (i > 0) {
      const fallback = i === 1 ? 3 : i === 2 ? 5 : 7
      steps.push(waitStep(waitDays[i - 1] || fallback))
    }
    steps.push(emailStep(emails[i]?.template_id || null))
  }
  return steps
}

// Registry. Record<AutomationType, ...> forces an entry for every automation
// type in the canonical constant: adding a new type to
// lib/constants/automations.ts fails the build here until a compiler is
// registered.
export const AUTOMATION_STEP_COMPILERS: Record<AutomationType, Compiler> = {
  // create_deal runs in the form webhook; the optional send_email step that
  // follows fires the welcome/initial email once the cron picks the
  // enrollment up. If no template is set we fall back to the legacy
  // "create deal and stop" shape so existing automations are unchanged.
  deal_creation: (config) => {
    const initialEmailId = config?.initial_email_template_id
    return initialEmailId
      ? [createDealStep(), emailStep(initialEmailId)]
      : [createDealStep()]
  },
  list_assignment: () => [],
  // invoice_generation is a one-stop sequence: create the invoice +
  // AUTO-send the system Stripe-payment-link email (handled inside
  // processCreateInvoiceStep), then user-picked reminder emails.
  //
  // Default shape: create_invoice + wait + reminder + wait + reminder.
  // The first email is intentionally NOT a configurable step — it's
  // baked into create_invoice so the recruiter doesn't need to find a
  // template that mimics the system invoice email.
  //
  // Reminder count grows if the user adds more email rows in the
  // editor; default is 2 (covering "1 week post-send" + "2 weeks
  // post-send").
  invoice_generation: (config) => {
    const steps: CompiledStep[] = [createInvoiceStep()]
    const emails = config?.emails ?? []
    const waitDays = config?.wait_days ?? []
    const reminderCount = Math.max(emails.length, 2)
    for (let i = 0; i < reminderCount; i++) {
      // Each reminder is preceded by a wait. Default cadence is 7 days
      // between every reminder, so 2 reminders → +7d, +14d.
      steps.push(waitStep(waitDays[i] || 7))
      steps.push(emailStep(emails[i]?.template_id || null))
    }
    return steps
  },
  // No move_to_stage step appended for either initial_contact or
  // follow_up. When the enrollment flips to 'completed' (sequence ran
  // out) the move_deal_on_enrollment_exit trigger reads
  // automations.no_reply_stage_id and moves the deal there. Putting a
  // hard-coded move step into the compiled output would duplicate that
  // job and produce two different "no-reply destination" UIs in the
  // modal (workflow steps + exit goals). One source of truth wins.
  initial_contact: (config) => threeEmailSequence(config),
  follow_up: (config) => threeEmailSequence(config),
  deposit_invoice: (config) => depositInvoiceSequence(config),
  application_received: variableEmailSequence,
  interview_reminder: variableEmailSequence,
  meeting_scheduler: meetingSchedulerSequence,
  post_interview: variableEmailSequence,
  welcome_sequence: variableEmailSequence,
  payment_overdue: variableEmailSequence,
  pre_departure: variableEmailSequence,
  stage_reminder: stageReminderSequence,
  custom: variableEmailSequence,
}

export function compileAutomationSteps(
  type: AutomationType | undefined,
  config: AutomationConfig | null | undefined,
): CompiledStep[] {
  if (!type) return []
  const compile = AUTOMATION_STEP_COMPILERS[type]
  return compile ? compile(config) : []
}
