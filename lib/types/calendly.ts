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

/**
 * The three states a recruiter's Calendly can be in, kept apart on purpose.
 *
 * `connected` used to be `!!profiles.calendly_url`, i.e. "has a booking link
 * pasted into their profile" — so the settings screen showed a green
 * "Connected" badge for an account that had never been linked to Calendly at
 * all. Bookings were therefore never arriving, interview dates were never
 * filled in, and the only thing on screen said everything was fine.
 *
 *   booking_link_saved  — the {{deal_owner_calendly}} merge tag will resolve.
 *                         Outbound emails work. Nothing comes back.
 *   connected           — a Personal Access Token is stored, so the account is
 *                         genuinely linked.
 *   webhook_registered  — the booking webhook exists, which is the only state
 *                         where a booked meeting actually reaches the CRM and
 *                         sets the deal's interview date. Calendly restricts
 *                         webhook subscriptions to paid plans.
 */
export interface CalendlyConnectionStatus {
  connected: boolean
  booking_link_saved: boolean
  webhook_registered: boolean
  user_uri?: string
  connected_at?: string
}
