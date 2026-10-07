'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: string | null
  avatar_url: string | null
  calendly_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export function useCurrentUser() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['current-user'],
    queryFn: async (): Promise<UserProfile | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error || !profile) return null

      return profile
    },
    // The signed-in user's role does not change while they are using the CRM,
    // and everything role-gated (drag permissions, admin-only screens) reads
    // this. Re-fetching it on every window focus meant those gates briefly
    // re-evaluated against undefined.
    staleTime: 5 * 60 * 1000,
  })
}
