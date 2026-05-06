import type { Contact } from './contacts'

export interface List {
  id: string
  name: string
  description: string | null
  sport: 'football' | 'basketball'
  is_dynamic: boolean
  rules: Record<string, unknown> | null
  // When this list mirrors a pipeline (auto-populated by the
  // sync_deal_to_pipeline_list trigger), source_pipeline_id points at
  // the pipeline. NULL for ordinary user-created lists.
  source_pipeline_id: string | null
  created_at: string
  updated_at: string
  // Computed fields
  contact_count?: number
}

export interface ListContact {
  contact_id: string
  list_id: string
  added_at: string
  // Joined data
  contact?: Contact
}

export interface ListWithContacts extends List {
  contacts: ListContact[]
}

export interface ListFilters {
  search?: string
  sport?: 'football' | 'basketball' | 'all'
}

export interface CreateListInput {
  name: string
  description?: string
  sport?: 'football' | 'basketball'
  is_dynamic?: boolean
}

export interface UpdateListInput {
  id: string
  name?: string
  description?: string
  is_dynamic?: boolean
}

export interface ListStats {
  totalLists: number
  totalContacts: number
  largestListName: string
  largestListCount: number
}
