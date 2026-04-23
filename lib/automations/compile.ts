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
  step_type: 'send_email' | 'wait' | 'send_sms' | 'move_to_stage' | 'create_deal'
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
  return steps
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
  deal_creation: () => [createDealStep()],
  list_assignment: () => [],
  initial_contact: (config) => threeEmailSequence(config),
  follow_up: (config) => threeEmailSequence(config, { finalStageId: config?.final_stage_id }),
  deposit_invoice: (config) => depositInvoiceSequence(config),
  application_received: variableEmailSequence,
  interview_reminder: variableEmailSequence,
  post_interview: variableEmailSequence,
  welcome_sequence: variableEmailSequence,
  payment_overdue: variableEmailSequence,
  pre_departure: variableEmailSequence,
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
