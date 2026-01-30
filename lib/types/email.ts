import type { Contact } from './contacts'
import type { Campaign } from './campaigns'
import type { Profile } from './pipelines'

export type EmailIntent = 'positive' | 'negative' | 'neutral' | 'unknown'
export type EmailMatchStatus = 'auto_matched' | 'manually_matched' | 'unmatched' | 'spam'
export type EmailFollowUpStatus = 'open' | 'in_progress' | 'completed'

export interface EmailReply {
  id: string
  contact_id: string | null
  from_email: string
  from_name: string | null
  subject: string | null
  body_preview: string | null
  body_full: string | null
  campaign_id: string | null
  ai_intent: EmailIntent | null
  match_status: EmailMatchStatus
  matched_by_id: string | null
  matched_at: string | null
  follow_up_status: EmailFollowUpStatus
  created_at: string
  // Joined data
  contact?: Contact | null
  campaign?: Campaign | null
  matched_by?: Profile | null
}

export interface EmailReplyCounts {
  unmatched: number
  matched: number
  spam: number
  today: number
  positive: number
  negative: number
}
