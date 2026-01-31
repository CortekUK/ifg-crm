export type CalendlyEventStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface CalendlyEvent {
  id: string
  contact_id: string | null
  user_id: string | null
  deal_id: string | null
  
  event_type: string
  event_name: string
  start_time: string
  end_time: string
  duration_minutes: number | null
  
  location: string | null
  join_url: string | null
  
  status: CalendlyEventStatus
  cancelled_at: string | null
  cancellation_reason: string | null
  
  calendly_event_id: string | null
  calendly_invitee_id: string | null
  calendly_event_uri: string | null
  
  invitee_email: string | null
  invitee_name: string | null
  invitee_timezone: string | null
  
  created_at: string
  updated_at: string
  
  // Joined data
  contact?: {
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
  user?: {
    id: string
    full_name: string | null
    email: string
  } | null
}

export interface CalendlyEventFilters {
  contact_id?: string
  user_id?: string
  deal_id?: string
  status?: CalendlyEventStatus | 'all'
  upcoming_only?: boolean
  past_only?: boolean
}

export interface CalendlyConnectionStatus {
  connected: boolean
  user_uri?: string
  connected_at?: string
}
