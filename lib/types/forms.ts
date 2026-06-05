export type FormSource = 'gravity_forms' | 'wpforms' | 'contact_form_7' | 'elementor_forms' | 'generic' | 'activecampaign' | 'website'

export type FormSubmissionStatus = 'pending' | 'processed' | 'failed' | 'skipped'

export interface FormSubmission {
  id: string
  form_id: string
  form_source: FormSource | null
  payload: Record<string, unknown>
  contact_id: string | null
  deal_id: string | null
  automation_id: string | null
  assigned_user_id: string | null
  status: FormSubmissionStatus
  error_message: string | null
  processing_time_ms: number | null
  created_at: string
  processed_at: string | null
  // Joined data
  contact?: {
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
  deal?: {
    id: string
    title: string
  } | null
  automation?: {
    id: string
    name: string
  } | null
  assigned_user?: {
    id: string
    full_name: string
    email: string
  } | null
}

export interface FormSubmissionFilters {
  form_id?: string
  status?: FormSubmissionStatus | 'all'
  automation_id?: string
  dateFrom?: string
  dateTo?: string
}

export interface RoundRobinState {
  id: string
  automation_id: string
  last_assigned_user_id: string | null
  last_assigned_at: string
  created_at: string
  updated_at: string
  // Joined data
  last_assigned_user?: {
    id: string
    full_name: string
    email: string
  } | null
}
