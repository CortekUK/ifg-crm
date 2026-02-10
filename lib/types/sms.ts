import type { Contact } from './contacts'
import type { Pipeline } from './pipelines'
import type { Profile } from './pipelines'

export type SMSDirection = 'inbound' | 'outbound'
export type SMSIntent = 'positive' | 'negative' | 'neutral' | 'question' | 'unknown'
export type SMSMatchStatus = 'auto_matched' | 'manually_matched' | 'unmatched' | 'spam' | 'deal_created'
export type SMSFollowUpStatus = 'open' | 'in_progress' | 'completed'

export interface SMSMessage {
  id: string
  contact_id: string | null
  phone_number: string
  direction: SMSDirection
  content: string
  campaign_id: string | null
  click_send_number: string | null
  pipeline_id: string | null
  ai_intent: SMSIntent | null
  ai_intent_confidence: number | null
  match_status: SMSMatchStatus
  matched_by_id: string | null
  matched_at: string | null
  follow_up_status: SMSFollowUpStatus
  created_at: string
  // Joined data
  contact?: Contact | null
  pipeline?: Pipeline | null
  matched_by?: Profile | null
}

export interface SMSMessageCounts {
  unmatched: number
  matched: number
  spam: number
  today: number
  positive: number
  negative: number
  question: number
}
