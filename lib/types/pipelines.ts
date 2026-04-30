export interface Programme {
  id: string
  name: string
  type: 'university' | 'gap_year' | 'residency' | 'camp' | 'trial'
  sport: 'football' | 'basketball'
  description: string | null
  default_deposit_amount: number | null
  default_total_cost: number | null
  university_partner: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Pipeline {
  id: string
  name: string
  programme_id: string | null
  sport: 'football' | 'basketball'
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
  programme?: Programme | null
}

export interface PipelineStage {
  id: string
  pipeline_id: string
  name: string
  stage_type: 'lead' | 'contact' | 'meeting' | 'follow_up' | 'documents' | 'applied' | 'offer' | 'payment' | 'completed' | 'lost' | 'dormant'
  triggers_automation: boolean
  automation_id: string | null
  display_order: number
  color: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'super_admin' | 'admin' | 'recruiter'
  avatar_url: string | null
  calendly_url?: string | null
}

export interface Deal {
  id: string
  contact_id: string
  pipeline_id: string
  current_stage_id: string
  deal_owner_id: string
  deal_value: number
  title: string
  notes: string | null
  source: string | null
  created_at: string
  updated_at: string
  won_at: string | null
  lost_at: string | null
  lost_reason: string | null
  last_activity_at: string | null
  stage_changed_at?: string | null
  stage_entered_at?: string | null
  // New fields
  win_probability?: number | null // 0-100 percentage
  forecasted_close_date?: string | null // ISO date string
  description?: string | null // Additional notes/description
  // Programme date fields — used by the time_before_date automation trigger
  // (Pre-Departure template) to know when each milestone is.
  programme_start_date?: string | null // ISO date string (YYYY-MM-DD)
  interview_date?: string | null
  arrival_date?: string | null
  contact?: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
    graduation_year: number | null
  }
  stage?: PipelineStage
  owner?: Profile
  pipeline?: Pipeline
  status?: 'active' | 'won' | 'lost'
  closed_at?: string | null
  // Latest classified reply intent (positive | negative | question |
  // neutral | unsubscribe | unknown). Set by the resend-inbound edge
  // function when a matched reply is classified.
  intent?: string | null
  // Computed fields
  time_in_stage?: number // days in current stage
  last_contacted_at?: string | null // when last email was sent
  has_active_automation?: boolean // whether deal has an active automation enrollment
}
