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
      title: invite.title,
      sport: invite.sport,
      calendly_url: invite.calendly_url,
      zoom_url: invite.zoom_url,
      phone: invite.phone,
      created_at: invite.created_at,
      is_invite: true,
      invite_status: invite.status,
      expires_at: invite.expires_at,
      pipeline_assignments: invite.pipeline_ids || [],
    })),
    // Then existing users
    ...(usersQuery.data || []).map((user): UserOrInvite => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      title: user.title,
      sport: user.sport,
      calendly_url: user.calendly_url,
      zoom_url: user.zoom_url,
      phone: user.phone,
      avatar_url: user.avatar_url,
      is_active: user.is_active,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
      is_invite: false,
      pipeline_assignments: user.pipeline_assignments || [],
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
    mutationFn: async ({ userId, updates }: { userId: string; updates: Record<string, unknown> }) => {
      // Filter out undefined values and pipeline_assignments (handled separately)
      const dbUpdates: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && key !== 'pipeline_assignments') {
          dbUpdates[key] = value
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', userId)

      if (error) throw error

      // Handle pipeline assignments separately if needed
      // This would typically be stored in a junction table
      if (updates.pipeline_assignments) {
        // For now, we store in the profiles table as a JSON array
        // In a production app, this might be a separate table
        const { error: assignError } = await supabase
          .from('profiles')
          .update({ pipeline_assignments: updates.pipeline_assignments })
          .eq('id', userId)

        if (assignError) {
          console.warn('Could not update pipeline assignments:', assignError.message)
        }
      }
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
      title,
      phone,
      calendlyUrl,
      zoomUrl,
      pipelineIds,
    }: {
      email: string
      fullName: string
      role: string
      title?: string
      phone?: string
      calendlyUrl?: string
      zoomUrl?: string
      pipelineIds?: string[]
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
          title,
          sport: 'football',
          phone,
          calendlyUrl,
          zoomUrl,
          pipelineIds,
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
