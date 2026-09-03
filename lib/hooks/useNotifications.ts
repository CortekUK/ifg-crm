import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'
import { showBrowserNotification } from '@/lib/notifications/browser'

export interface Notification {
  id: string
  user_id: string
  type: 'email_reply' | 'sms_reply' | 'payment' | 'new_lead' | 'deal_won' | 'deal_lost' | 'deal_stage' | 'form_submission' | 'general'
  title: string
  message: string
  href: string | null
  is_read: boolean
  metadata: Record<string, unknown>
  created_at: string
}

interface NotificationsResponse {
  notifications: Notification[]
  unreadCount: number
}

export function useNotifications(limit = 20) {
  const queryClient = useQueryClient()

  const query = useQuery<NotificationsResponse>({
    queryKey: ['notifications', limit],
    queryFn: async () => {
      const res = await fetch(`/api/notifications?limit=${limit}`)
      if (!res.ok) throw new Error('Failed to fetch notifications')
      return res.json()
    },
    refetchInterval: 60000, // Poll every 60s as fallback
  })

  // Realtime subscription for instant updates.
  //
  // An INSERT also raises a desktop notification when the user has opted
  // in on this browser — that is what the "Desktop notifications" toggle
  // in Settings switches on.
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            // RLS already scopes this stream to the signed-in user. The
            // filter is belt and braces: a desktop notification renders
            // whatever arrives, so it must never carry a colleague's row.
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })

            if (payload.eventType === 'INSERT') {
              const row = payload.new as Partial<Notification>
              showBrowserNotification(
                row.title || 'New activity',
                row.message || '',
                row.href ?? null,
              )
            }
          },
        )
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [queryClient])

  return query
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', notificationId }),
      })
      if (!res.ok) throw new Error('Failed to mark as read')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to mark all as read (HTTP ${res.status})`)
      }
    },
    // Optimistic update — flip every cached notification to is_read=true
    // and zero the unread count immediately. The realtime invalidation +
    // server refetch will reconcile if anything diverges.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      const previous = queryClient.getQueriesData({ queryKey: ['notifications'] })
      queryClient.setQueriesData<{ notifications: { is_read: boolean }[]; unreadCount: number }>(
        { queryKey: ['notifications'] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            notifications: old.notifications.map((n) => ({ ...n, is_read: true })),
            unreadCount: 0,
          }
        },
      )
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      // Roll back the optimistic update and surface the failure.
      if (ctx?.previous) {
        ctx.previous.forEach(([key, data]) => queryClient.setQueryData(key, data))
      }
      toast({
        title: 'Could not mark notifications as read',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useClearAllNotifications() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to clear notifications (HTTP ${res.status})`)
      }
    },
    // Optimistic clear — empty the list immediately. If the API errors,
    // we restore the previous list from the snapshot.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      const previous = queryClient.getQueriesData({ queryKey: ['notifications'] })
      queryClient.setQueriesData(
        { queryKey: ['notifications'] },
        { notifications: [], unreadCount: 0 },
      )
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) {
        ctx.previous.forEach(([key, data]) => queryClient.setQueryData(key, data))
      }
      toast({
        title: 'Could not clear notifications',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
