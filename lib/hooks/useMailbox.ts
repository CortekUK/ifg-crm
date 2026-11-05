'use client'

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  AUDIENCE_CATEGORIES, AUDIENCE_FIXED, FOLDER_CATEGORIES, HIDDEN_CATEGORIES,
  type MailAudience, type MailFolder, type SenderKind,
} from '@/lib/outlook/classify-sender'

/**
 * Data for the Outlook mailbox screen.
 *
 * Everything is paged with .range() and counted in the database. An unbounded
 * PostgREST select silently stops at 1,000 rows with no error — the trap that
 * has already cost this project exports, tag filtering and reports, and which
 * a mailbox would hit faster than any of them.
 */

export interface MailThread {
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
  category: SenderKind
  latest_intent: string | null
  participants: { email: string; name: string | null }[]
  mailbox_user_id: string | null
  /** Filled from profiles so the row can show whose mailbox it is. */
  mailbox_owner_name?: string | null
}

const PAGE_SIZE = 50

/**
 * What each folder holds.
 *
 * Every folder hides the categories in HIDDEN_CATEGORIES — currently internal
 * mail between colleagues, which this screen is not for.
 */
const FOLDER_FILTER: Record<MailFolder, (q: ReturnType<typeof baseQuery>) => ReturnType<typeof baseQuery>> = {
  // Everything that arrived, whatever it turned out to be, the way an inbox
  // works. The only filtering is the hidden categories.
  inbox: (q) => q,
  // The last message came in and nobody has answered it. This is the folder
  // that answers "what do I owe a reply to".
  waiting: (q) => q.eq('last_message_direction', 'inbound'),
  unmatched: (q) => q.in('category', FOLDER_CATEGORIES.unmatched),
  matched: (q) => q.in('category', FOLDER_CATEGORIES.matched),
  // Threads whose newest message we sent.
  sent: (q) => q.eq('last_message_direction', 'outbound'),
}

/**
 * Which number the rail badge shows, per folder.
 *
 * 'unread' is the mail-client meaning and renders blue. 'all' is a queue of
 * work and renders amber — every row in it needs a person, read or not. The
 * two were previously one rule (unread, everywhere) while the folder header
 * showed the total, so the same folder read 30 in one place and 33 in the
 * other with nothing saying why.
 */
/**
 * Narrow a folder to who the conversation is with.
 *
 * A folder that already means one audience ignores it — filtering Contacts
 * down to "unmatched" would always be empty, and offering that is worse than
 * not offering it.
 */
function applyAudience<T extends { in: (c: string, v: unknown[]) => T }>(
  query: T,
  folder: MailFolder,
  audience: MailAudience,
): T {
  const effective = AUDIENCE_FIXED[folder] ?? audience
  if (effective === 'all') return query
  return query.in('category', AUDIENCE_CATEGORIES[effective])
}

export const FOLDER_BADGE: Record<MailFolder, 'unread' | 'all' | 'none'> = {
  inbox: 'unread',
  waiting: 'all',
  unmatched: 'all',
  matched: 'unread',
  sent: 'none',
}

function baseQuery() {
  return createClient()
    .from('email_threads')
    .select('*', { count: 'exact' })
    .not('category', 'in', `(${HIDDEN_CATEGORIES.join(',')})`)
}

/**
 * One mailbox at a time — your own, or a recruiter's if you are a super admin
 * (272). Never several merged into one list: opening on everyone's mail at
 * once is what made Nathan disconnect in October.
 *
 * This used to take a scope — all mailboxes, all recruiters, or one named
 * person — which the screen defaulted to 'all' for admins. A mailbox is now
 * private to whoever connected it (265), so there is nothing to choose. The
 * filter is kept rather than left to RLS alone: belt and braces on a query
 * that would otherwise be one policy edit away from returning the lot.
 */
function onlyThisMailbox<T extends { eq: (c: string, v: unknown) => T }>(
  query: T,
  mailboxUserId: string,
): T {
  return query.eq('mailbox_user_id', mailboxUserId)
}

/**
 * One folder's conversations, newest first, a page at a time.
 *
 * Infinite rather than a single query: the screen used to ask for page 0 and
 * nothing else, so a mailbox with 300 conversations showed 50 rows under a
 * header reading 300 — which looks exactly like mail going missing.
 */
export function useMailThreads(params: {
  folder: MailFolder
  mailboxUserId: string
  intent?: string
  search?: string
  audience?: MailAudience
}) {
  const { folder, mailboxUserId, intent = 'all', search = '', audience = 'crm' } = params

  return useInfiniteQuery({
    // mailboxUserId is part of what the query asks for, so it belongs in the
    // key. Without them a cached page survives the roster
    // arriving a moment later, and the list shows somebody else's mail.
    queryKey: ['mail-threads', folder, intent, search, audience, mailboxUserId],
    enabled: !!mailboxUserId,
    initialPageParam: 0,
    getNextPageParam: (last: { nextPage: number | null }) => last.nextPage,
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number
      let query = baseQuery()
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      query = FOLDER_FILTER[folder](query)
      query = applyAudience(query, folder, audience)
      query = onlyThisMailbox(query, mailboxUserId)
      if (intent !== 'all') query = query.eq('latest_intent', intent)

      if (search.trim()) {
        const term = `%${search.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`
        query = query.or(
          `subject.ilike.${term},counterparty_email.ilike.${term},counterparty_name.ilike.${term},last_message_preview.ilike.${term}`,
        )
      }

      const { data, error, count } = await query
      if (error) throw error

      const threads = (data ?? []) as MailThread[]

      const total = count ?? 0
      return {
        threads,
        total,
        nextPage: (page + 1) * PAGE_SIZE < total ? page + 1 : null,
      }
    },
  })
}

/**
 * The number beside each folder, and the folder's own totals.
 *
 * Both are computed in the database. The rail badge follows FOLDER_BADGE —
 * unread where unread is the useful number, the whole queue where every row
 * needs a person — and the header states both figures in words, so no folder
 * can show two numbers again without saying which is which.
 */
export function useFolderCounts(params: {
  mailboxUserId: string
  audience?: MailAudience
}) {
  const { mailboxUserId, audience = 'crm' } = params

  return useQuery({
    queryKey: ['mail-folder-counts', audience, mailboxUserId],
    enabled: !!mailboxUserId,
    queryFn: async () => {
      const folders: MailFolder[] = ['inbox', 'waiting', 'unmatched', 'matched', 'sent']
      const out: Record<string, { total: number; unread: number; badge: number }> = {}

      await Promise.all(
        folders.map(async (folder) => {
          const scoped = () => {
            let q = createClient()
              .from('email_threads')
              .select('id', { count: 'exact', head: true })
              .not('category', 'in', `(${HIDDEN_CATEGORIES.join(',')})`)
            q = FOLDER_FILTER[folder](q as never) as never
            q = applyAudience(q as never, folder, audience) as never
            return onlyThisMailbox(q as never, mailboxUserId) as never as ReturnType<typeof baseQuery>
          }

          const [{ count: total }, { count: unread }] = await Promise.all([
            scoped(),
            scoped().gt('unread_count', 0),
          ])

          const badge = FOLDER_BADGE[folder]
          out[folder] = {
            total: total ?? 0,
            unread: unread ?? 0,
            badge: badge === 'all' ? total ?? 0 : badge === 'unread' ? unread ?? 0 : 0,
          }
        }),
      )
      return out
    },
  })
}

/**
 * Mark a conversation read or unread.
 *
 * Goes through the API rather than writing unread_count from here: the count
 * is derived from the messages, and the real Outlook mailbox has to be told
 * as well. Setting the counter directly from the browser left the messages
 * untouched, so the next sync recounted them and silently undid it.
 */
export function useSetThreadRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ threadId, read }: { threadId: string; read: boolean }) => {
      const res = await fetch('/api/outlook/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, read }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not update the conversation.')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mail-threads'] })
      qc.invalidateQueries({ queryKey: ['mail-folder-counts'] })
    },
  })
}

export interface ReadableMailbox {
  user_id: string
  full_name: string | null
  mailbox_email: string | null
  is_mine: boolean
}

/**
 * The mailboxes this person may open: their own, plus every recruiter's for a
 * super admin. Decided by the database (readable_mailboxes, 272), not here.
 */
export function useReadableMailboxes(enabled: boolean) {
  return useQuery<ReadableMailbox[]>({
    queryKey: ['readable-mailboxes'],
    enabled,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('readable_mailboxes')
      if (error) throw error
      return (data ?? []) as ReadableMailbox[]
    },
  })
}

export interface MailMessage {
  id: string
  direction: 'inbound' | 'outbound'
  senderKind: SenderKind
  fromEmail: string | null
  fromName: string | null
  toEmail: string | null
  cc: string[]
  subject: string | null
  body: string | null
  /**
   * The message as the recipient saw it. Preferred over `body` for display:
   * outbound mail is a designed document and 24 of 35 sent messages have no
   * text part at all, so text-only rendering showed them as empty.
   */
  html: string | null
  at: string | null
  graphMessageId: string | null
  intent: string | null
}

/**
 * Every message in one conversation, oldest first, both directions.
 *
 * Scoped to the thread's mailbox: Outlook gives the same conversation id to
 * every mailbox on a thread, so once a super admin can read a recruiter's
 * mail, an unscoped lookup would mix the two copies together. Rows with no
 * mailbox (14 sends from an older path) belong to whichever thread holds them.
 */
export function useThreadMessages(conversationId: string | null, mailboxUserId: string | null) {
  const inMailbox = mailboxUserId
    ? `mailbox_user_id.eq.${mailboxUserId},mailbox_user_id.is.null`
    : 'mailbox_user_id.is.null'
  return useQuery<MailMessage[]>({
    queryKey: ['mail-thread-messages', conversationId, mailboxUserId],
    enabled: !!conversationId,
    queryFn: async () => {
      const supabase = createClient()
      const [{ data: replies }, { data: sends }] = await Promise.all([
        supabase
          .from('email_replies')
          .select('id, from_email, from_name, to_email, subject, body, html_body, received_at, created_at, graph_message_id, ai_intent, sender_kind')
          .eq('conversation_id', conversationId)
          .or(inMailbox)
          .order('received_at', { ascending: true })
          .limit(200),
        supabase
          .from('email_sends')
          .select('id, recipient_email, subject, body_text, body_html, sent_at, from_email')
          .eq('conversation_id', conversationId)
          .or(inMailbox)
          .order('sent_at', { ascending: true })
          .limit(200),
      ])

      const inbound: MailMessage[] = (replies ?? []).map((r) => ({
        id: r.id as string,
        direction: 'inbound',
        senderKind: (r.sender_kind ?? 'unknown') as SenderKind,
        fromEmail: r.from_email as string | null,
        fromName: r.from_name as string | null,
        toEmail: r.to_email as string | null,
        cc: [],
        subject: r.subject as string | null,
        body: r.body as string | null,
        html: r.html_body as string | null,
        at: (r.received_at ?? r.created_at) as string | null,
        graphMessageId: r.graph_message_id as string | null,
        intent: (r.ai_intent ?? null) as string | null,
      }))

      const outbound: MailMessage[] = (sends ?? []).map((s) => ({
        id: s.id as string,
        direction: 'outbound',
        senderKind: 'internal',
        fromEmail: s.from_email as string | null,
        fromName: null,
        toEmail: s.recipient_email as string | null,
        cc: [],
        subject: s.subject as string | null,
        body: s.body_text as string | null,
        html: s.body_html as string | null,
        at: s.sent_at as string | null,
        graphMessageId: null,
        intent: null,
      }))

      return [...inbound, ...outbound].sort(
        (a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime(),
      )
    },
  })
}

export interface ThreadContact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  parent_email: string | null
  date_of_birth: string | null
  country: string | null
  position: string | null
  secondaryEmails: string[]
  deals: { id: string; pipeline: string | null; stage: string | null }[]
}

/** The contact behind a matched thread, for the banner above the messages. */
export function useThreadContact(contactId: string | null) {
  return useQuery<ThreadContact | null>({
    queryKey: ['mail-thread-contact', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const supabase = createClient()
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, parent_email, date_of_birth, country, position')
        .eq('id', contactId)
        .maybeSingle()
      if (!contact) return null

      const [{ data: extra }, { data: deals }] = await Promise.all([
        supabase.from('contact_emails').select('email').eq('contact_id', contactId),
        supabase
          .from('deals')
          .select('id, pipeline:pipelines(name), stage:pipeline_stages!deals_current_stage_id_fkey(name)')
          .eq('contact_id', contactId)
          .eq('status', 'active'),
      ])

      const c = contact as unknown as Omit<ThreadContact, 'secondaryEmails' | 'deals'>
      return {
        ...c,
        secondaryEmails: (extra ?? []).map((e) => e.email as string),
        // PostgREST types an embed as an array even on a to-one relationship,
        // so each is normalised rather than cast — a cast here compiles and
        // then reads `undefined` at runtime.
        deals: (deals ?? []).map((d) => {
          const row = d as unknown as {
            id: string
            pipeline: { name: string } | { name: string }[] | null
            stage: { name: string } | { name: string }[] | null
          }
          const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)
          return {
            id: row.id,
            pipeline: one(row.pipeline)?.name ?? null,
            stage: one(row.stage)?.name ?? null,
          }
        }),
      }
    },
  })
}
