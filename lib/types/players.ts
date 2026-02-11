import type { Contact, ContactOwner } from './contacts'

// Players are contacts with graduation_year set
export type Player = Contact

// Re-export for convenience
export type { ContactOwner }

export interface PlayerFilters {
  search?: string
  graduationYear?: number | 'all'
  gender?: 'male' | 'female' | 'all'
  country?: string | 'all'
  position?: string | 'all'
  status?: 'active' | 'unsubscribed' | 'all'
  ownerId?: string | 'all'
  tagId?: string | 'all'
  page?: number
  pageSize?: number
}

export interface PlayerStats {
  totalPlayers: number
  activeInPipeline: number
  graduatingThisYear: number
  usPlayers: number
}

export interface PlayerDeal {
  id: string
  title: string
  deal_value: number
  pipeline: {
    id: string
    name: string
  }
  stage: {
    id: string
    name: string
    color: string
  }
  owner: {
    id: string
    full_name: string
  }
  created_at: string
}
