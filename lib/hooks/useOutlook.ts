'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface OutlookConnectionStatus {
  configured: boolean
  connected: boolean
  status: 'connected' | 'reconnect_needed' | 'disconnected'
  statusDetail?: string | null
  mailboxEmail?: string | null
  mailboxDisplayName?: string | null
  connectedAt?: string | null
  lastSyncedAt?: string | null
  lastSyncError?: string | null
  notificationsActive?: boolean
}

/**
 * The mailbox queries to refresh after mail has moved.
 *
 * These used to invalidate 'outlook-threads', a key belonging to an earlier
 * version of this screen. Nothing has written to it since the mailbox was
 * rebuilt on useMailbox, so sending a reply refreshed nothing and the message
 * only appeared after a manual reload.
 */
const MAILBOX_KEYS = ['mail-threads', 'mail-folder-counts', 'mail-thread-messages', 'mail-today']

function refreshMailbox(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of MAILBOX_KEYS) queryClient.invalidateQueries({ queryKey: [key] })
}

export function useOutlookStatus() {
  return useQuery<OutlookConnectionStatus>({
    queryKey: ['outlook-status'],
    queryFn: async () => {
      const res = await fetch('/api/outlook/status', { cache: 'no-store' })
      if (!res.ok) throw new Error('Could not read the Outlook connection status.')
      return res.json()
    },
    // A connection can flip to reconnect_needed at any time (a password
    // change), and the banner is the only thing that tells the user.
    staleTime: 60_000,
  })
}

export function useDisconnectOutlook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/outlook/status', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not disconnect Outlook.')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlook-status'] })
      refreshMailbox(queryClient)
    },
  })
}

export function useSyncOutlook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/outlook/sync', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Sync failed.')
      return data as { inserted: number; duplicates: number; errors: string[] }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlook-status'] })
      queryClient.invalidateQueries({ queryKey: ['email-replies'] })
      refreshMailbox(queryClient)
    },
  })
}

export function useSendOutlookMail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { to: string; subject: string; body: string }) => {
      const res = await fetch('/api/outlook/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send the message.')
      return data as {
        success: true
        conversationId: string | null
        contact: { id: string; name: string; hasDeal: boolean } | null
      }
    },
    onSuccess: () => {
      refreshMailbox(queryClient)
    },
  })
}

export function useReplyToThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { replyId: string; body: string; replyAll?: boolean }) => {
      const res = await fetch('/api/outlook/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send the reply.')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-replies'] })
      refreshMailbox(queryClient)
    },
  })
}
