import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { User, UserInvite, UserOrInvite, UpdateUserInput } from '@/lib/types/users'

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

export function useUserInvites() {
  const supabase = createClient()

  return useQuery<UserInvite[]>({
    queryKey: ['user-invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invites')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        // If table doesn't exist or no permissions, return empty array
        console.warn('Could not fetch invites:', error.message)
        return []
      }
      return data || []
    },
  })
}

// Combined hook that returns both users and pending invites
export function useUsersAndInvites() {
  const usersQuery = useUsers()
  const invitesQuery = useUserInvites()

  const combined: UserOrInvite[] = [
    // Map pending invites first (show at top)
    ...(invitesQuery.data || []).map((invite): UserOrInvite => ({
      id: invite.id,
      email: invite.email,
      full_name: invite.full_name,
      role: invite.role,
      sport: invite.sport,
      calendly_url: invite.calendly_url,
      created_at: invite.created_at,
      is_invite: true,
      invite_status: invite.status,
      expires_at: invite.expires_at,
    })),
    // Then existing users
    ...(usersQuery.data || []).map((user): UserOrInvite => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      sport: user.sport,
      calendly_url: user.calendly_url,
      avatar_url: user.avatar_url,
      is_active: user.is_active,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
      is_invite: false,
    })),
  ]

  return {
    data: combined,
    users: usersQuery.data || [],
    invites: invitesQuery.data || [],
    isLoading: usersQuery.isLoading || invitesQuery.isLoading,
    error: usersQuery.error || invitesQuery.error,
    refetch: () => {
      usersQuery.refetch()
      invitesQuery.refetch()
    },
  }
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
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          fullName,
          role,
          sport,
          calendlyUrl,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user-invites'] })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user')
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user-invites'] })
    },
  })
}
