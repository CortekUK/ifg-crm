export interface ContactOwner {
  id: string
  full_name: string | null
  email: string
  calendly_url?: string | null
}

export interface ContactTag {
  id: string
  name: string
  color: string
  category: 'tournament' | 'skill' | 'priority' | 'other' | null
}

export interface Contact {
  id: string
  email: string
  phone: string | null
  first_name: string
  last_name: string
  date_of_birth: string | null
  graduation_year: number | null
  gender: 'male' | 'female' | null
  country: string | null
  state: string | null
  city: string | null
  club_name: string | null
  position: string | null
  gpa: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  source: 'website_form' | 'sms_reply' | 'email_reply' | 'manual' | 'csv_import' | 'referral' | 'google_ads' | 'instagram' | 'facebook' | 'email_campaign' | 'event' | null
  source_detail: string | null
  sport: 'football' | 'basketball'
  subscription_status: 'subscribed' | 'unsubscribed'
  email_subscribed: boolean
  sms_subscribed: boolean
  notes: string | null
  football_background: string | null
  academic_background: string | null
  degree_choice: string | null
  football_highlights: string | null
  preferred_programme: string | null
  job_title: string | null
  custom_fields: Record<string, string> | null
  owner_id: string | null
  owner?: ContactOwner | null
  tags?: ContactTag[]
  created_at: string
  updated_at: string
  last_activity_at: string | null
}

export interface UseContactsParams {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  filters?: {
    subscription_status?: string
    graduation_year?: number
    gender?: string
    country?: string
    source?: string
    pipeline_id?: string
    recruiter_id?: string
    tag_id?: string
    position?: string
    owner_id?: string
  }
}

export interface ContactsResponse {
  contacts: Contact[]
  total: number | null
}
