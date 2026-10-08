import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { orderByIds } from '@/lib/contacts/search'
import type { EmailReply as EmailReplyType, EmailReplyCounts } from '@/lib/types/email'

// Re-export for backwards compatibility
export type { EmailReply as EmailReplyFromDb } from '@/lib/types/email'

export interface EmailReplyInput {
  id: string
  email_send_id: string | null
  contact_id: string
  received_at: string
  subject: string | null
  body_preview: string | null
  from_email: string | null
  message_id: string | null
  in_reply_to: string | null
  processed: boolean
  processed_at: string | null
  created_at: string
}

export interface CreateEmailReplyInput {
  contact_id: string
  email_send_id?: string | null
  subject?: string
  body_preview?: string
  from_email?: string
  received_at?: string
}

const PAGE_SIZE = 20

/** The columns and embeds the Replies screen needs for a row. */
const REPLY_SELECT = `
  *,
  contact:contacts(*),
  campaign:campaigns(*, pipeline:pipelines(id, name, programme_id, programme:programmes(id, name))),
  pipeline:pipelines!email_replies_pipeline_id_fkey(id, name, programme_id, programme:programmes(id, name)),
  matched_by:profiles(*),
  deal:deals(id, title, status, stage:pipeline_stages!deals_current_stage_id_fkey(id, name))
`

export type EmailReplyTab = 'all' | 'unmatched' | 'matched' | 'spam'

export interface EmailReplyFilters {
  /** 'all' or one of the intent buckets. */
  intent?: string
  /** Free text across sender, subject, body and the matched contact. */
  search?: string
  /** 'all' | 'none' | campaign uuid. */
  campaign?: string
  /** 'all' | 'none' | pipeline uuid. */
  pipeline?: string
  /** Deep-link from the automation detail sheet. */
  contactId?: string | null
}

/**
 * Everything that has to be refetched after a reply changes.
 *
 * The tab badges, the intent chips and the filter options are three separate
 * queries off the same table. Each mutation used to list the ones its author
 * remembered, which is how the chip counts could sit stale behind a
 * mark-as-read while the tab badge updated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function invalidateReplyViews(queryClient: any) {
  for (const key of [
    ['email-replies'],
    ['email-reply-counts'],
    ['email-reply-intent-counts'],
    ['email-reply-filter-options'],
    ['unmatched-email-replies'],
  ]) {
    queryClient.invalidateQueries({ queryKey: key })
  }
}

/** Normalised RPC arguments, so every hook below filters identically. */
function rpcArgs(tab: EmailReplyTab, f: EmailReplyFilters = {}) {
  return {
    p_tab: tab,
    p_search: f.search?.trim() || null,
    p_campaign: f.campaign || 'all',
    p_pipeline: f.pipeline || 'all',
    p_contact_id: f.contactId || null,
  }
}

/**
 * Email replies for a tab, filtered in the database.
 *
 * QA-33 bug 1: the tab filter was applied server-side but intent, search,
 * campaign and pipeline were all applied in the browser to the pages loaded so
 * far. The Matched tab therefore read 30 while its chips read "All 20", and
 * filtering by Positive only searched those 20 rows — older positive replies
 * stayed hidden behind Load More.
 *
 * `email_replies_page` (migration 210) returns the matching ids for one page
 * plus the total the filter matches. Rows are then fetched by id, which keeps
 * the column list and the embeds here rather than duplicated in SQL — the same
 * split lib/contacts/search.ts uses for contacts.
 *
 * 'all' returns every reply regardless of match_status — including
 * 'deal_created' replies promoted via Smart Deal, which the other tabs
 * intentionally exclude.
 */
export function useEmailReplies(
  tab: EmailReplyTab = 'unmatched',
  filters: EmailReplyFilters = {},
) {
  const supabase = createClient()
  const args = rpcArgs(tab, filters)
  const intent = filters.intent && filters.intent !== 'all' ? filters.intent : null

  return useInfiniteQuery<EmailReplyType[]>({
    queryKey: ['email-replies', tab, intent, args.p_search, args.p_campaign, args.p_pipeline, args.p_contact_id],
    queryFn: async ({ pageParam }) => {
      const page = (pageParam as number) ?? 0

      const { data: idRows, error: idError } = await supabase.rpc('email_replies_page', {
        ...args,
        p_intent: intent,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      })
      if (idError) throw idError

      const ids = ((idRows ?? []) as { id: string }[]).map((r) => r.id)
      if (ids.length === 0) return []

      const { data, error } = await supabase.from('email_replies').select(REPLY_SELECT).in('id', ids)
      if (error) throw error

      // PostgREST returns rows in planner order, which would throw away the
      // newest-first ordering the RPC established.
      return orderByIds((data || []) as EmailReplyType[], ids)
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined
    },
  })
}

/**
 * Chip counts for the whole tab under the current filters (QA-33 bug 1).
 *
 * Counted in the database, so the chips describe every reply in the tab rather
 * than the 20 rows that happen to be on screen, and they always sum to the
 * "All" figure.
 */
export function useEmailReplyIntentCounts(
  tab: EmailReplyTab = 'unmatched',
  filters: EmailReplyFilters = {},
) {
  const supabase = createClient()
  const args = rpcArgs(tab, filters)

  return useQuery({
    queryKey: ['email-reply-intent-counts', tab, args.p_search, args.p_campaign, args.p_pipeline, args.p_contact_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('email_replies_intent_counts', args)
      if (error) throw error

      const row = ((data ?? []) as {
        all_count: number
        positive: number
        question: number
        negative: number
        neutral: number
        unknown: number
      }[])[0]

      return {
        all: Number(row?.all_count ?? 0),
        positive: Number(row?.positive ?? 0),
        question: Number(row?.question ?? 0),
        negative: Number(row?.negative ?? 0),
        neutral: Number(row?.neutral ?? 0),
        unknown: Number(row?.unknown ?? 0),
      }
    },
  })
}

/**
 * Campaign and pipeline options for the filter dropdowns.
 *
 * Previously collected from the replies already loaded, so a campaign whose
 * replies were all on a later page was never offered as a filter.
 */
export function useEmailReplyFilterOptions(
  tab: EmailReplyTab = 'unmatched',
  contactId?: string | null,
) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['email-reply-filter-options', tab, contactId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('email_reply_filter_options', {
        p_tab: tab,
        p_contact_id: contactId || null,
      })
      if (error) throw error

      const rows = (data ?? []) as { kind: string; id: string; name: string }[]
      return {
        campaigns: rows.filter((r) => r.kind === 'campaign').map(({ id, name }) => ({ id, name })),
        pipelines: rows.filter((r) => r.kind === 'pipeline').map(({ id, name }) => ({ id, name })),
      }
    },
  })
}
// Hook for fetching email replies for a specific contact
export function useContactEmailReplies(contactId: string | null) {
  const supabase = createClient()

  return useQuery<EmailReplyInput[]>({
    queryKey: ['contact-email-replies', contactId],
    queryFn: async () => {
      if (!contactId) return []

      const { data, error } = await supabase
        .from('email_replies')
        .select('*')
        .eq('contact_id', contactId)
        .order('received_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data || []
    },
    enabled: !!contactId,
  })
}

// Hook for email reply counts. When `contactId` is set, counts are scoped to
// that contact only — used by the deep-link from the automation detail sheet
// so the tab badges match the filtered list rather than the global totals.
export function useEmailReplyCounts(contactId?: string | null) {
  const supabase = createClient()

  return useQuery<EmailReplyCounts>({
    queryKey: ['email-reply-counts', contactId ?? null],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const scoped = () => {
        const q = supabase.from('email_replies').select('*', { count: 'exact', head: true })
        return contactId ? q.eq('contact_id', contactId) : q
      }

      const [
        { count: all },
        { count: unmatched },
        { count: matched },
        { count: spam },
        { count: todayCount },
        { count: positive },
        { count: negative },
        { count: question },
      ] = await Promise.all([
        // 'all' — every reply regardless of match_status, including
        // 'deal_created' (promoted via Smart Deal), which the other
        // tabs intentionally exclude.
        scoped(),
        scoped().eq('match_status', 'unmatched'),
        // Matched count reflects the unread Matched inbox the user
        // sees in the tab — keep them aligned. Read replies still
        // surface under 'all'.
        scoped().in('match_status', ['auto_matched', 'manually_matched']).eq('read', false),
        scoped().eq('match_status', 'spam'),
        scoped().gte('created_at', today.toISOString()),
        scoped().eq('ai_intent', 'positive'),
        scoped().eq('ai_intent', 'negative'),
        scoped().eq('ai_intent', 'question'),
      ])

      return {
        all: all || 0,
        unmatched: unmatched || 0,
        matched: matched || 0,
        spam: spam || 0,
        today: todayCount || 0,
        positive: positive || 0,
        negative: negative || 0,
        question: question || 0,
      }
    },
  })
}

// Mark one or more matched email replies as read. Hides them from
// the Matched tab; they stay visible in All. Used by the bulk
// "Mark as read" button and the per-row dropdown action.
export function useMarkEmailRepliesRead() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (replyIds: string[]) => {
      if (replyIds.length === 0) return []
      const { data, error } = await supabase
        .from('email_replies')
        .update({ read: true })
        .in('id', replyIds)
        .select('id')

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateReplyViews(queryClient)
    },
  })
}

// Hook to mark email as spam
export function useMarkEmailAsSpam() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ replyId, matchedById }: { replyId: string; matchedById: string }) => {
      const { data, error } = await supabase
        .from('email_replies')
        .update({
          match_status: 'spam',
          matched_by_id: matchedById,
        })
        .eq('id', replyId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateReplyViews(queryClient)
    },
  })
}

// Reverse of mark-as-spam. We send the reply back through the matched/unmatched
// flow: keep contact_id if there was one (auto_matched), otherwise unmatched.
export function useUnmarkEmailSpam() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ replyId }: { replyId: string }) => {
      const { data: existing, error: fetchError } = await supabase
        .from('email_replies')
        .select('contact_id')
        .eq('id', replyId)
        .single()

      if (fetchError) throw fetchError

      const nextStatus = existing?.contact_id ? 'auto_matched' : 'unmatched'

      const { data, error } = await supabase
        .from('email_replies')
        .update({ match_status: nextStatus })
        .eq('id', replyId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateReplyViews(queryClient)
    },
  })
}

export function useCreateEmailReply() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateEmailReplyInput) => {
      const { data, error } = await supabase
        .from('email_replies')
        .insert({
          contact_id: input.contact_id,
          email_send_id: input.email_send_id || null,
          subject: input.subject || null,
          body_preview: input.body_preview || null,
          from_email: input.from_email || null,
          received_at: input.received_at || new Date().toISOString(),
          processed: false,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateReplyViews(queryClient)
      queryClient.invalidateQueries({ queryKey: ['contact-automations'] })
      // Also trigger reply processing
      queryClient.invalidateQueries({ queryKey: ['automation-enrollments'] })
    },
  })
}

export function useContactRecentEmails(contactId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['contact-recent-emails', contactId],
    queryFn: async () => {
      if (!contactId) return []

      // Get recent emails sent to this contact
      const { data, error } = await supabase
        .from('email_sends')
        .select(`
          id,
          subject,
          sent_at,
          status,
          from_name
        `)
        .eq('recipient_contact_id', contactId)
        .order('sent_at', { ascending: false })
        .limit(20)

      if (error) throw error
      return data || []
    },
    enabled: !!contactId,
  })
}

export interface MatchEmailReplyInput {
  replyId: string
  contactId: string
  matchedById: string
}

export function useMatchEmailReply() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ replyId, contactId, matchedById }: MatchEmailReplyInput) => {
      const { data, error } = await supabase
        .from('email_replies')
        .update({
          contact_id: contactId,
          match_status: 'manually_matched',
          matched_by_id: matchedById,
          matched_at: new Date().toISOString(),
        })
        .eq('id', replyId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateReplyViews(queryClient)
    },
  })
}

/**
 * Undo a match (QA-31 bug 5).
 *
 * There was no way back: a reply matched to the wrong player stayed attached
 * to them for good, and the ticket's own "Suggest if" list called that out.
 * The reply returns to the Unmatched tab so it can be matched again, by hand
 * or through Smart Match.
 *
 * deal_id is cleared along with contact_id. Leaving it would keep the reply
 * pointing at the wrong player's deal — the same split-ownership state QA-31
 * bug 6 describes — and an unmatched reply has no deal by definition.
 *
 * This does NOT undo what the match did to the deal. Stopping a sequence and
 * moving a card are real events that were acted on; silently rewinding them
 * would be a worse surprise than leaving them. The card can be dragged back,
 * which warns and clears stale intent (QA-03).
 */
export function useUnmatchEmailReply() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ replyId }: { replyId: string }) => {
      const { data, error } = await supabase
        .from('email_replies')
        .update({
          contact_id: null,
          deal_id: null,
          match_status: 'unmatched',
          matched_by_id: null,
          matched_at: null,
        })
        .eq('id', replyId)
        .select('id')
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateReplyViews(queryClient)
    },
  })
}

export function useUnmatchedEmailReplies() {
  const supabase = createClient()

  return useQuery<EmailReplyInput[]>({
    queryKey: ['unmatched-email-replies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_replies')
        .select('*')
        .is('contact_id', null)
        .eq('processed', false)
        .order('received_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return data || []
    },
  })
}
