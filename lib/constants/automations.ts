// Canonical source of truth for automation step types, trigger types, and
// automation types. Used by the Next.js app (types, hooks, UI).
//
// MIRROR: supabase/functions/_shared/automation-constants.ts
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
  'deposit_invoice',
  'payment_overdue',
  'welcome_sequence',
  'pre_departure',
  'list_assignment',
  'custom',
] as const
export type AutomationType = typeof AUTOMATION_TYPES[number]
