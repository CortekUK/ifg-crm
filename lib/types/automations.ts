import type { Pipeline, PipelineStage } from './pipelines'
import type { Template } from './templates'

export interface AutomationStep {
  id: string
  automation_id: string
  step_order: number
  step_type: 'send_email' | 'wait' | 'send_sms' | 'move_to_stage'
  delay_days: number
  delay_hours: number
  email_template_id: string | null
  sms_content: string | null
  target_stage_id: string | null
  conditions: Record<string, unknown> | null
  created_at: string
  template?: Template | null
  // Joined data (when fetched with automation)
  automation?: Automation | null
}

export interface Automation {
  id: string
  name: string
  description: string | null
  pipeline_id: string | null
  trigger_stage_id: string | null
  stop_on_stage_ids: string[]
  is_active: boolean
  created_at: string
  updated_at: string
  pipeline?: Pipeline | null
  trigger_stage?: PipelineStage | null
  steps?: AutomationStep[]
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
