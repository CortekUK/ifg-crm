export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body_html: string
  body_json: Record<string, unknown> | null
  category: 'automation' | 'campaign' | 'transactional'
  from_name_type: 'deal_owner' | 'fixed'
  fixed_from_name: string | null
  fixed_from_email: string | null
  attachments: unknown[]
  created_by_id: string | null
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  name: string
  type: 'email' | 'sms'
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
  email_template_id: string | null
  sms_content: string | null
  from_user_id: string
  thumbnail_url: string | null
  scheduled_at: string | null
  sent_at: string | null
  created_by_id: string
  created_at: string
  updated_at: string
  recipient_list_ids: string[] | null
  template?: EmailTemplate | null
  from_user?: {
    id: string
    email: string
    full_name: string | null
  }
  created_by?: {
    id: string
    email: string
    full_name: string | null
  }
  // Computed/joined data
  recipient_lists?: {
    id: string
    name: string
    contact_count?: number
  }[]
  // Aggregated stats (from campaign_recipients)
  recipient_count?: number
  open_count?: number
  click_count?: number
}

export interface CreateCampaignInput {
  name: string
  type: 'email' | 'sms'
  status: 'draft' | 'scheduled'
  email_template_id?: string
  sms_content?: string
  from_user_id: string
  created_by_id: string
  scheduled_at?: string
  recipient_list_ids?: string[]
}

export interface UpdateCampaignInput {
  id: string
  name?: string
  status?: Campaign['status']
  email_template_id?: string
  sms_content?: string
  scheduled_at?: string | null
  recipient_list_ids?: string[]
}

export interface CampaignFilters {
  search?: string
  type?: 'email' | 'sms' | 'all'
  status?: Campaign['status'] | 'all'
}
