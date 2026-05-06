import type { Pipeline, PipelineStage } from './pipelines'
import type { Template } from './templates'
import type { AutomationType, TriggerType, StepType } from '@/lib/constants/automations'

export type { AutomationType, TriggerType, StepType }

export interface AutomationStepStats {
  sent: number
  delivered: number
  failed: number
  bounced: number
  in_queue: number
}

export interface AutomationStep {
  id: string
  automation_id: string
  step_order: number
  step_type: StepType
  delay_days: number
  delay_hours: number
  email_template_id: string | null
  sms_content: string | null
  target_stage_id: string | null
  conditions: Record<string, unknown> | null
  created_at: string
  template?: Template | null
  // Stats for email steps
  stats?: AutomationStepStats
  // Joined data (when fetched with automation)
  automation?: Automation | null
  // For notify steps
  notify_type?: 'parent' | 'deal_owner' | 'admin'
}

export interface FieldMappings {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  sport?: string
  graduation_year?: string
  position?: string
  [key: string]: string | undefined
}

export interface AutomationConfig {
  // For deal creation
  round_robin_users?: string[]
  form_id?: string
  // 'activecampaign' routes to /api/webhooks/activecampaign; the rest route
  // to /api/webhooks/wordpress (the handler picks payload shape from the
  // exact value).
  form_source?: 'activecampaign' | 'gravity_forms' | 'wpforms' | 'contact_form_7' | 'elementor_forms' | 'generic'
  field_mappings?: FieldMappings
  initial_stage_id?: string
  // Default monetary value to write to deal_value when this automation
  // creates a new deal (form-webhook + WP/AC webhooks). Lets a configurer
  // set the programme price once per automation instead of every deal
  // landing at 0. Recruiter can still override on the deal page.
  default_deal_value?: number
  // For deal_creation: optional email to send immediately after the deal is
  // created. Compiles to a send_email step that runs right after create_deal,
  // so the contact gets a welcome/initial email the moment the form fires.
  initial_email_template_id?: string | null
  // For sequences
  emails?: {
    step: number
    template_id: string
    use_predictive_send?: boolean
  }[]
  wait_days?: number[]
  // Exit conditions
  exit_on_reply?: boolean
  // Stage to move the deal to when the contact replies (positive outcome).
  // Null/undefined = don't move the deal, just stop the enrollment.
  exit_to_stage_id?: string | null
  // Stage to move the deal to when the sequence completes WITHOUT a reply
  // (no engagement). Typically a "Lost" / "No Reply" / "Dead" stage.
  no_reply_stage_id?: string | null
  // Final action
  final_stage_id?: string
  // For time-based triggers (pre-departure)
  days_before?: number
  date_field?: 'programme_start_date' | 'interview_date' | 'arrival_date'
  // For payment-related automations
  stop_on_payment?: boolean
  // Deposit Invoice automations: where the deal lands in two outcomes.
  //   paid_stage_id   — moved here when an invoice on the deal becomes
  //                     'paid' and stop_on_payment fires.
  //   unpaid_stage_id — moved here if the entire reminder sequence
  //                     completes without a paid invoice.
  paid_stage_id?: string | null
  unpaid_stage_id?: string | null
  // For single-email automations
  single_template_id?: string
  // For notifications
  notify_parent?: boolean
  notify_deal_owner?: boolean
  notify_admin?: boolean
  // For welcome sequence
  create_portal_account?: boolean
  // Welcome Sequence: when the player activates their portal account
  // (sets their password — profiles.password_set_at IS NOT NULL), the
  // enrollment exits and the deal moves to this stage. Optional; if
  // unset, the automation just runs to the end of its email list.
  activated_stage_id?: string | null
  // For list assignment (static + dynamic)
  static_list_ids?: string[]
  dynamic_list_rules?: {
    field: string
    value: string
    list_id: string
  }[]
  // For meeting_scheduler:
  // 1. Send schedule_email_template_id immediately when the trigger fires.
  // 2. For each entry in reminders[], wait until that many hours/days
  //    before deals.interview_date, then send template_id.
  schedule_email_template_id?: string
  reminders?: {
    template_id: string
    before_value: number
    before_unit: 'hours' | 'days'
  }[]
  // For invoice_generation:
  //   amount_source — how the invoice amount is derived:
  //     'deal_value'  → use deal.deal_value as-is
  //     'percentage'  → invoice_amount_percent% of deal.deal_value
  //                     (e.g. 25 → 25% deposit)
  //     'custom'      → fixed invoice_amount_custom regardless of deal
  //   invoice_type   — maps to invoices.type column (deposit/full_payment/etc).
  //   invoice_due_in_days — due_date = today + this many days (default 7).
  //   invoice_description — free-text shown on the invoice line item.
  invoice_amount_source?: 'deal_value' | 'percentage' | 'custom'
  invoice_amount_percent?: number
  invoice_amount_custom?: number
  invoice_type?: 'deposit' | 'installment' | 'full_payment' | 'meal_plan' | 'trip' | 'other'
  invoice_due_in_days?: number
  invoice_description?: string
}

export interface Automation {
  id: string
  name: string
  description: string | null
  automation_type?: AutomationType
  trigger_type?: TriggerType
  pipeline_id: string | null
  trigger_stage_id: string | null
  stop_on_stage_ids: string[]
  config?: AutomationConfig | null
  exit_on_reply?: boolean
  exit_to_stage_id?: string | null
  no_reply_stage_id?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  pipeline?: Pipeline | null
  trigger_stage?: PipelineStage | null
  stop_stages?: PipelineStage[]
  steps?: AutomationStep[]
  // Computed stats
  total_enrolled?: number
  total_completed?: number
  total_in_queue?: number
  last_run_at?: string | null
}

export interface AutomationEnrollment {
  id: string
  automation_id: string
  deal_id: string
  current_step_id: string | null
  status: 'active' | 'completed' | 'stopped' | 'paused'
  enrolled_at: string
  next_step_at: string | null
  completed_at: string | null
  stopped_reason: string | null
  // Joined data
  deal?: {
    id: string
    title: string
    contact?: {
      id: string
      first_name: string
      last_name: string
      email: string
    }
  }
}

export interface AutomationLog {
  id: string
  enrollment_id: string
  step_id: string
  deal_id: string
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  sent_at: string
  error_message: string | null
  email_message_id: string | null
  // Joined data
  automation?: Automation
  step?: AutomationStep
  deal?: {
    id: string
    title: string
    contact?: {
      id: string
      first_name: string
      last_name: string
      email: string
    }
  }
}

export interface AutomationFilters {
  workflow?: string | 'all'
  status?: 'sent' | 'failed' | 'skipped' | 'all'
  dateFrom?: string
  dateTo?: string
}

// Pre-built automation templates
export interface AutomationTemplate {
  id: string
  name: string
  description: string
  type: AutomationType
  trigger_type: TriggerType
  default_steps: {
    step_type: StepType
    delay_days?: number
    delay_hours?: number
    description: string
  }[]
  configurable: {
    emails: boolean
    wait_durations: boolean
    exit_stages: boolean
    round_robin: boolean
    final_stage: boolean
    notify_parent?: boolean
    stop_on_payment?: boolean
    create_portal_account?: boolean
    days_before_date?: boolean
  }
  // UI metadata
  icon?: 'email' | 'form' | 'invoice' | 'calendar' | 'welcome' | 'plane'
  badge?: string
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'deal_creation',
    name: 'Deal Creation',
    description:
      'Create a deal from a form submission and round-robin assign it to a recruiter. Pair with an Initial Contact automation on the landing stage if you want a first-touch email sequence — this template just gets the deal into the pipeline.',
    type: 'deal_creation',
    trigger_type: 'form_submission',
    default_steps: [
      { step_type: 'create_deal', description: 'Create deal for contact' }
    ],
    configurable: {
      // No email steps and no welcome email — the first-touch send lives
      // in the separate Initial Contact automation that runs when the
      // deal lands in the Initial Lead stage. Keeping these flags off
      // means the modal renders ONLY the round-robin + form-mapping
      // sections, which is what the recruiter actually configures here.
      emails: false,
      wait_durations: false,
      exit_stages: false,
      round_robin: true,
      final_stage: false
    }
  },
  {
    id: 'list_assignment',
    name: 'List Assignment (No Deal)',
    description: 'Add contacts to lists from form submissions without creating a deal',
    type: 'list_assignment',
    trigger_type: 'form_submission',
    default_steps: [],
    configurable: {
      emails: false,
      wait_durations: false,
      exit_stages: false,
      round_robin: false,
      final_stage: false
    },
    icon: 'form',
    badge: 'List Only'
  },
  {
    id: 'initial_contact_3',
    name: 'Initial Contact (3-Email Sequence)',
    description:
      'Send 3 follow-up emails when a deal lands in the Initial Lead stage. The sequence exits early if the contact replies (the reply-handler moves the deal to Contact Response and stops the enrollment). If no reply by the end of the third email, optionally move the deal to a configurable "no-reply" stage.',
    type: 'initial_contact',
    trigger_type: 'enters_stage',
    default_steps: [
      { step_type: 'send_email', description: 'Send Initial Email 1' },
      { step_type: 'wait', delay_days: 3, description: 'Wait 3 days' },
      { step_type: 'send_email', description: 'Send Initial Email 2' },
      { step_type: 'wait', delay_days: 5, description: 'Wait 5 days' },
      { step_type: 'send_email', description: 'Send Initial Email 3' },
      { step_type: 'wait', delay_days: 7, description: 'Wait 7 days' }
    ],
    configurable: {
      emails: true,
      wait_durations: true,
      exit_stages: true,
      round_robin: false,
      // The no-reply destination is set in the Exit Goals section
      // (Goal 3 → no_reply_stage_id) and applied automatically by the
      // move_deal_on_enrollment_exit trigger when the enrollment flips
      // to 'completed'. We DON'T want a separate move_to_stage step
      // inside the workflow editor — that produced two different
      // dropdowns asking the same question.
      final_stage: false
    }
  },
  {
    id: 'follow_up_3',
    name: 'Follow Up (3-Email Sequence)',
    description: 'Send 3 follow-up emails when a deal moves to the Follow Up stage, then update the stage',
    type: 'follow_up',
    trigger_type: 'stage_change',
    default_steps: [
      { step_type: 'send_email', description: 'Send Follow Up Email 1' },
      { step_type: 'wait', delay_days: 2, description: 'Wait 2 days' },
      { step_type: 'send_email', description: 'Send Follow Up Email 2' },
      { step_type: 'wait', delay_days: 2, description: 'Wait 2 days' },
      { step_type: 'send_email', description: 'Send Follow Up Email 3 (Predictive)' }
    ],
    configurable: {
      emails: true,
      wait_durations: true,
      exit_stages: true,
      round_robin: false,
      // No-reply destination lives in Exit Goals → Goal 3, not as an
      // inline workflow step. Keeps a single source of truth for where
      // the deal lands when nothing else triggered an exit.
      final_stage: false
    }
  },
  {
    id: 'application_received',
    name: 'Application Received',
    description: 'Send confirmation email when a deal moves to Application stage, with optional parent notification',
    type: 'application_received',
    trigger_type: 'enters_stage',
    default_steps: [
      { step_type: 'send_email', description: 'Send application confirmation to player' }
    ],
    configurable: {
      emails: true,
      wait_durations: false,
      exit_stages: false,
      round_robin: false,
      final_stage: false,
      notify_parent: true
    }
  },
  {
    id: 'meeting_scheduler',
    name: 'Meeting Scheduler',
    description: 'Send a booking link when the trigger fires, then up to 2 reminders before the meeting (hours or days before).',
    type: 'meeting_scheduler',
    trigger_type: 'enters_stage',
    default_steps: [
      { step_type: 'send_email', description: 'Send schedule-meeting link' },
      { step_type: 'wait_until_before_date', description: 'Wait until X before interview_date' },
      { step_type: 'send_email', description: 'Reminder (optional)' }
    ],
    configurable: {
      emails: true,
      wait_durations: false,
      exit_stages: true,
      round_robin: false,
      final_stage: false
    }
  },
  {
    id: 'post_interview',
    name: 'Post-Interview Follow-Up',
    description: 'Send thank-you email after interview with next steps',
    type: 'post_interview',
    trigger_type: 'stage_change',
    default_steps: [
      { step_type: 'send_email', description: 'Send post-interview thank you and next steps' }
    ],
    configurable: {
      emails: true,
      wait_durations: false,
      exit_stages: false,
      round_robin: false,
      final_stage: false
    }
  },
  {
    id: 'invoice_generation',
    name: 'Invoice Generation',
    description:
      'Automatically create an invoice when a deal enters a stage (e.g. Deposit). Reads the deal value set on the Deal Creation automation and issues an invoice for the full amount, a percentage (deposit), or a fixed custom amount. Pair with the Deposit Invoice & Reminder automation on the same pipeline to send payment-link emails — this template only creates the invoice.',
    type: 'invoice_generation',
    trigger_type: 'enters_stage',
    default_steps: [
      { step_type: 'create_invoice', description: 'Create invoice on the deal' }
    ],
    configurable: {
      // No email steps inside this automation — the invoice it creates
      // lands as status='sent' which fires the existing on_invoice_sent
      // trigger and chains into the Deposit Invoice & Reminder
      // automation. Keeps a single source of truth for "what email goes
      // out when the invoice is issued".
      emails: false,
      wait_durations: false,
      exit_stages: false,
      round_robin: false,
      final_stage: false
    },
    icon: 'invoice'
  },
  {
    id: 'deposit_invoice',
    name: 'Deposit Invoice & Reminder',
    description: 'Send deposit invoice with payment link, then follow-up reminders until paid. Fires automatically when an invoice is sent for a deal in this pipeline.',
    type: 'deposit_invoice',
    trigger_type: 'invoice_created',
    default_steps: [
      { step_type: 'send_email', description: 'Send deposit invoice with payment link' },
      { step_type: 'wait', delay_days: 3, description: 'Wait 3 days' },
      { step_type: 'send_email', description: 'Send reminder 1 (friendly)' },
      { step_type: 'wait', delay_days: 5, description: 'Wait 5 days' },
      { step_type: 'send_email', description: 'Send reminder 2 (more urgent)' },
      { step_type: 'wait', delay_days: 7, description: 'Wait 7 days' },
      { step_type: 'send_email', description: 'Send final reminder' }
    ],
    configurable: {
      emails: true,
      wait_durations: true,
      exit_stages: true,
      round_robin: false,
      final_stage: false,
      stop_on_payment: true
    }
  },
  {
    id: 'payment_overdue',
    name: 'Payment Overdue Escalation',
    description: 'Escalating reminder sequence when invoice is past due date',
    type: 'payment_overdue',
    trigger_type: 'invoice_overdue',
    default_steps: [
      { step_type: 'send_email', description: 'Send overdue notice' },
      { step_type: 'wait', delay_days: 3, description: 'Wait 3 days' },
      { step_type: 'send_email', description: 'Send urgent overdue reminder' },
      { step_type: 'wait', delay_days: 5, description: 'Wait 5 days' },
      { step_type: 'send_email', description: 'Send final overdue warning' }
    ],
    configurable: {
      emails: true,
      wait_durations: true,
      exit_stages: false,
      round_robin: false,
      final_stage: false
    }
  },
  {
    id: 'welcome_sequence',
    name: 'Welcome Sequence',
    description: 'Send welcome pack and create player portal account when deposit is paid',
    type: 'welcome_sequence',
    trigger_type: 'enters_stage',
    default_steps: [
      { step_type: 'send_email', description: 'Send welcome pack with programme details' }
    ],
    configurable: {
      emails: true,
      wait_durations: false,
      exit_stages: false,
      round_robin: false,
      final_stage: false,
      create_portal_account: true
    }
  },
  {
    id: 'pre_departure',
    name: 'Pre-Departure Sequence',
    description: 'Send preparation reminders at 30, 14, and 7 days before programme start',
    type: 'pre_departure',
    trigger_type: 'time_before_date',
    default_steps: [
      { step_type: 'send_email', delay_days: 30, description: 'Send 30-day preparation checklist' },
      { step_type: 'send_email', delay_days: 14, description: 'Send 14-day travel and accommodation details' },
      { step_type: 'send_email', delay_days: 7, description: 'Send 7-day final arrival instructions' }
    ],
    configurable: {
      emails: true,
      wait_durations: true,
      exit_stages: false,
      round_robin: false,
      final_stage: false,
      days_before_date: true
    }
  }
]
