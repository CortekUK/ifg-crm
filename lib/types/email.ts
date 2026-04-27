import type { Contact } from './contacts'
import type { Campaign } from './campaigns'
import type { Profile, Pipeline } from './pipelines'

export type EmailIntent = 'positive' | 'negative' | 'neutral' | 'question' | 'unknown'
export type EmailMatchStatus = 'auto_matched' | 'manually_matched' | 'unmatched' | 'spam' | 'deal_created'
export type EmailFollowUpStatus = 'open' | 'in_progress' | 'completed'

export interface EmailReply {
  id: string
  contact_id: string | null
  from_email: string
  from_name: string | null
  subject: string | null
  body_preview: string | null
  body: string | null
  html_body: string | null
  campaign_id: string | null
  pipeline_id: string | null
  ai_intent: EmailIntent | null
  match_status: EmailMatchStatus
  matched_by_id: string | null
  matched_at: string | null
  follow_up_status: EmailFollowUpStatus
  received_at?: string
  created_at: string
  // Joined data
  contact?: Contact | null
  campaign?: Campaign | null
  matched_by?: Profile | null
  pipeline?: Pipeline | null
}

export interface EmailReplyCounts {
  unmatched: number
  matched: number
  spam: number
  today: number
  positive: number
  negative: number
  question: number
}
