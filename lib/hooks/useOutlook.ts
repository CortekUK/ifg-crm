'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

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

export interface EmailThread {
  id: string
  conversation_id: string
  subject: string | null
  last_message_at: string | null
  last_message_preview: string | null
  last_message_from: string | null
  last_message_direction: 'inbound' | 'outbound' | null
  unread_count: number
  message_count: number
  contact_id: string | null
  deal_id: string | null
  pipeline_id: string | null
  counterparty_email: string | null
  counterparty_name: string | null
  is_crm_related: boolean
  mailbox_user_id: string | null
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
      queryClient.invalidateQueries({ queryKey: ['outlook-threads'] })
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
      queryClient.invalidateQueries({ queryKey: ['outlook-threads'] })
      queryClient.invalidateQueries({ queryKey: ['outlook-status'] })
      queryClient.invalidateQueries({ queryKey: ['email-replies'] })
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
      queryClient.invalidateQueries({ queryKey: ['outlook-threads'] })
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
      queryClient.invalidateQueries({ queryKey: ['outlook-threads'] })
      queryClient.invalidateQueries({ queryKey: ['email-replies'] })
    },
  })
}

const PAGE_SIZE = 50

/**
 * Conversation list.
 *
 * Paged with .range() rather than fetched whole. PostgREST silently caps an
 * unbounded select at 1,000 rows with no error — the trap that has already
 * cost this project exports, tag filtering and reports, and which the spec
 * flags again for exactly this screen.
 */
export function useOutlookThreads(params: {
  scope: 'mine' | 'everyone'
  filter: 'all' | 'matched' | 'unmatched'
  search?: string
  page?: number
}) {
  const { scope, filter, search = '', page = 0 } = params

  return useQuery({
    queryKey: ['outlook-threads', scope, filter, search, page],
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return { threads: [] as EmailThread[], total: 0 }

      let query = supabase
        .from('email_threads')
        .select('*', { count: 'exact' })
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      // 'mine' is an explicit filter on top of RLS, not a substitute for it.
      // RLS already stops a recruiter seeing anyone else's mail; this is the
      // super admin's mine/everyone toggle.
      if (scope === 'mine') query = query.eq('mailbox_user_id', user.id)
      if (filter === 'matched') query = query.eq('is_crm_related', true)
      if (filter === 'unmatched') query = query.eq('is_crm_related', false)

      if (search.trim()) {
        const term = `%${search.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`
        query = query.or(
          `subject.ilike.${term},counterparty_email.ilike.${term},counterparty_name.ilike.${term},last_message_preview.ilike.${term}`,
        )
      }

      const { data, error, count } = await query
      if (error) throw error
      return { threads: (data ?? []) as EmailThread[], total: count ?? 0 }
    },
  })
}

/** Every message in one conversation, oldest first, both directions. */
export function useThreadMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['outlook-thread-messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      if (!conversationId) return []
      const supabase = createClient()

      const [{ data: replies }, { data: sends }] = await Promise.all([
        supabase
          .from('email_replies')
          .select('id, from_email, from_name, subject, body, html_body, received_at, created_at, graph_message_id, read, ai_intent, match_status')
          .eq('conversation_id', conversationId)
          .order('received_at', { ascending: true })
          .limit(200),
        supabase
          .from('email_sends')
          .select('id, recipient_email, subject, body_text, body_html, sent_at, from_email')
          .eq('conversation_id', conversationId)
          .order('sent_at', { ascending: true })
          .limit(200),
      ])

      type Message = {
        id: string
        direction: 'inbound' | 'outbound'
        address: string | null
        name: string | null
        subject: string | null
        body: string | null
        html: string | null
        at: string | null
        graphMessageId: string | null
        intent: string | null
      }

      const inbound: Message[] = (replies ?? []).map((r) => ({
        id: r.id as string,
        direction: 'inbound',
        address: r.from_email as string | null,
        name: r.from_name as string | null,
        subject: r.subject as string | null,
        body: r.body as string | null,
        html: r.html_body as string | null,
        at: (r.received_at ?? r.created_at) as string | null,
        graphMessageId: r.graph_message_id as string | null,
        intent: (r.ai_intent ?? null) as string | null,
      }))

      const outbound: Message[] = (sends ?? []).map((s) => ({
        id: s.id as string,
        direction: 'outbound',
        address: s.recipient_email as string | null,
        name: null,
        subject: s.subject as string | null,
        body: s.body_text as string | null,
        html: s.body_html as string | null,
        at: s.sent_at as string | null,
        graphMessageId: null,
        intent: null,
      }))

      // Oldest to newest, the way a mail client shows a conversation.
      return [...inbound, ...outbound].sort(
        (a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime(),
      )
    },
  })
}
