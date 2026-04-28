import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { User, UserInvite, UserOrInvite, UpdateUserInput } from '@/lib/types/users'

type AuthStatus = {
  last_sign_in_at: string | null
  email_confirmed_at: string | null
}

export function useUsers() {
  const supabase = createClient()

  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const [profilesResult, authStatusResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false }),
        fetch('/api/users/last-login').then(r => r.ok ? r.json() : null).catch(() => null),
      ])

      if (profilesResult.error) throw profilesResult.error

      const authStatusMap: Record<string, AuthStatus> = authStatusResult || {}

      return (profilesResult.data || []).map(user => {
        const auth = authStatusMap[user.id]
        return {
          ...user,
          last_login_at: auth?.last_sign_in_at || null,
          email_confirmed_at: auth?.email_confirmed_at || null,
          // password_set_at comes through from the profile row as-is; it's
          // the bullet-proof activation signal we maintain ourselves.
        }
      })
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

  // Emails with pending invites — used to hide the auto-created profile row
  const pendingEmails = new Set(
    (invitesQuery.data || []).map((i) => i.email.toLowerCase())
  )

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
    // Then existing users (excluding those with a pending invite to avoid duplicates)
    ...(usersQuery.data || [])
      .filter((user) => !pendingEmails.has(user.email.toLowerCase()))
      .map((user): UserOrInvite => {
        // Players are surfaced as pending invites until profiles.password_set_at
        // is stamped. That bit is set ONLY by /api/auth/mark-password-set,
        // which runs immediately after supabase.auth.updateUser({password})
        // succeeds — the only place we can confidently say a real password
        // was saved. Supabase's email_confirmed_at / last_sign_in_at /
        // identities all flip earlier (on magic-link click) and lie to us.
        const isUnconfirmedPlayer =
          user.role === 'player' && !user.password_set_at

        if (isUnconfirmedPlayer) {
          // Default expiry matches player_invites table (created_at + 7 days)
          const expiresAt = new Date(
            new Date(user.created_at).getTime() + 7 * 24 * 60 * 60 * 1000
          ).toISOString()
          return {
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
            created_at: user.created_at,
            is_invite: true,
            invite_status: 'pending',
            expires_at: expiresAt,
            email_confirmed_at: null,
            contact_id: user.contact_id ?? null,
            guardian_for_contact_id: user.guardian_for_contact_id ?? null,
            pipeline_assignments: user.pipeline_assignments || [],
          }
        }

        return {
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
          email_confirmed_at: user.email_confirmed_at,
          contact_id: user.contact_id ?? null,
          guardian_for_contact_id: user.guardian_for_contact_id ?? null,
          is_invite: false,
          pipeline_assignments: user.pipeline_assignments || [],
        }
      }),
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
      // Filter out undefined values
      const dbUpdates: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          dbUpdates[key] = value
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update(dbUpdates)
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
