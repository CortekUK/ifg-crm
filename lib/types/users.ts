export type UserRole = 'super_admin' | 'admin' | 'recruiter'
export type Sport = 'football' | 'basketball'

export interface User {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  calendly_url: string | null
  avatar_url: string | null
  phone: string | null
  email_signature: string | null
  sport: Sport
  is_active: boolean
  created_at: string
  updated_at: string
  last_login_at?: string
}

export interface CreateUserInput {
  email: string
  full_name: string
  role: UserRole
  sport: Sport
  calendly_url?: string
  phone?: string
}

export interface UpdateUserInput {
  full_name?: string
  role?: UserRole
  sport?: Sport
  calendly_url?: string
  phone?: string
  email_signature?: string
  is_active?: boolean
}
