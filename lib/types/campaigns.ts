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
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed'
  email_template_id: string | null
  sms_content: string | null
  // Email-specific fields
  subject: string | null
  body_text: string | null
  body_html: string | null
  from_name: string | null
  from_email: string | null
  reply_to: string | null
  preview_text: string | null
  // User references
  from_user_id: string
  thumbnail_url: string | null
  scheduled_at: string | null
  sent_at: string | null
  created_by_id: string
  created_at: string
  updated_at: string
  recipient_list_ids: string[] | null
  // Pipeline link (null = generic campaign, set = programme-specific)
  pipeline_id: string | null
  // Progress tracking fields
  total_recipients?: number
  processed_recipients?: number
  last_processed_at?: string | null
  error_message?: string | null
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
  // Pipeline join data
  pipeline?: {
    id: string
    name: string
    programme_id: string | null
    programme?: {
      id: string
      name: string
    } | null
  } | null
  // Aggregated stats (from campaign_recipients)
  recipient_count?: number
  delivered_count?: number
  open_count?: number
  click_count?: number
  bounce_count?: number
  unsubscribe_count?: number
}

export interface CreateCampaignInput {
  name: string
  type: 'email' | 'sms'
  status: 'draft' | 'scheduled'
  // Email fields
  email_template_id?: string
  subject?: string
  body_text?: string
  body_html?: string
  from_name?: string
  from_email?: string
  reply_to?: string
  preview_text?: string
  // SMS fields
  sms_content?: string
  // Common fields
  from_user_id: string
  created_by_id: string
  scheduled_at?: string
  recipient_list_ids?: string[]
  // Pipeline link (null = generic campaign)
  pipeline_id?: string | null
}

export interface UpdateCampaignInput {
  id: string
  name?: string
  status?: Campaign['status']
  // Email fields
  email_template_id?: string
  subject?: string
  body_text?: string
  body_html?: string
  from_name?: string
  from_email?: string
  reply_to?: string
  preview_text?: string
  // SMS fields
  sms_content?: string
  // Common fields
  scheduled_at?: string | null
  recipient_list_ids?: string[]
  // Pipeline link (null = generic campaign)
  pipeline_id?: string | null
}

export interface CampaignFilters {
  search?: string
  type?: 'email' | 'sms' | 'all'
  status?: Campaign['status'] | 'all'
  pipelineId?: string | 'all'
}
