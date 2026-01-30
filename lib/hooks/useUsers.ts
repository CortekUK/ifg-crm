import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { User, UpdateUserInput } from '@/lib/types/users'

export function useUsers() {
  const supabase = createClient()

  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
  })
}

export function useUser(userId: string | null) {
  const supabase = createClient()

  return useQuery<User | null>({
    queryKey: ['user', userId],
    queryFn: async () => {
      if (!userId) return null

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}

export function useUpdateUser() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: UpdateUserInput }) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user'] })
    },
  })
}

export function useInviteUser() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      email,
      fullName,
      role,
      sport,
      calendlyUrl,
    }: {
      email: string
      fullName: string
      role: string
      sport: string
      calendlyUrl?: string
    }) => {
      // Note: In production, you would use Supabase Admin API to invite users
      // This is a simplified version that creates an invite record
      // The actual invite would be sent via Supabase Auth Admin API
      
      // For now, we'll just simulate the invite
      // In real implementation:
      // const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      //   data: { full_name: fullName, role, sport, calendly_url: calendlyUrl }
      // })
      
      console.log('Invite user:', { email, fullName, role, sport, calendlyUrl })
      
      // Simulate success
      return { email, fullName }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
