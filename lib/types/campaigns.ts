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
  // Aggregated stats (from campaign_recipients)
  recipient_count?: number
  open_count?: number
  click_count?: number
}

export interface CampaignFilters {
  search?: string
  type?: 'email' | 'sms' | 'all'
  status?: Campaign['status'] | 'all'
}
