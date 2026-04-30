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
    description: 'Automatically create deals when contacts submit a form, with round-robin assignment to recruiters',
    type: 'deal_creation',
    trigger_type: 'form_submission',
    default_steps: [
      { step_type: 'create_deal', description: 'Create deal for contact' }
    ],
    configurable: {
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
    description: 'Send 3 follow-up emails when a deal enters the Initial Contact stage',
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
      { step_type: 'send_email', description: 'Send Follow Up Email 3 (Predictive)' },
      { step_type: 'move_to_stage', description: 'Move to next stage' }
    ],
    configurable: {
      emails: true,
      wait_durations: true,
      exit_stages: true,
      round_robin: false,
      final_stage: true
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
