import type { Pipeline, PipelineStage } from './pipelines'
import type { Template } from './templates'

export type AutomationType = 'deal_creation' | 'initial_contact' | 'follow_up' | 'custom'
export type TriggerType = 'form_submission' | 'enters_stage' | 'stage_change'

export interface AutomationStepStats {
  sent: number
  delivered: number
  opened: number
  clicked: number
  open_rate: number
  click_rate: number
  in_queue: number
}

export interface AutomationStep {
  id: string
  automation_id: string
  step_order: number
  step_type: 'send_email' | 'wait' | 'send_sms' | 'move_to_stage' | 'create_deal'
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
}

export interface AutomationConfig {
  // For deal creation
  round_robin_users?: string[]
  form_id?: string
  // For sequences
  emails?: {
    step: number
    template_id: string
    use_predictive_send?: boolean
  }[]
  wait_days?: number[]
  // Exit conditions
  exit_on_reply?: boolean
  // Final action
  final_stage_id?: string
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
  config: AutomationConfig | null
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
  status: 'sent' | 'failed' | 'skipped'
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
    step_type: AutomationStep['step_type']
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
  }
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
  }
]
