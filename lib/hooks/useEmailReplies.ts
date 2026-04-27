import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
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

// Hook for fetching email replies by tab/status (for email-replies page)
export function useEmailReplies(tab: 'unmatched' | 'matched' | 'spam' = 'unmatched') {
  const supabase = createClient()

  return useInfiniteQuery<EmailReplyType[]>({
    queryKey: ['email-replies', tab],
    queryFn: async ({ pageParam }) => {
      const page = (pageParam as number) ?? 0
      let query = supabase
        .from('email_replies')
        .select(`
          *,
          contact:contacts(*),
          campaign:campaigns(*, pipeline:pipelines(id, name, programme_id, programme:programmes(id, name))),
          pipeline:pipelines!email_replies_pipeline_id_fkey(id, name, programme_id, programme:programmes(id, name)),
          matched_by:profiles(*)
        `)
        .order('received_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (tab === 'unmatched') {
        query = query.eq('match_status', 'unmatched')
      } else if (tab === 'matched') {
        query = query.in('match_status', ['auto_matched', 'manually_matched'])
      } else if (tab === 'spam') {
        query = query.eq('match_status', 'spam')
      }

      const { data, error } = await query

      if (error) throw error
      return (data || []) as EmailReplyType[]
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined
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
        { count: unmatched },
        { count: matched },
        { count: spam },
        { count: todayCount },
        { count: positive },
        { count: negative },
        { count: question },
      ] = await Promise.all([
        scoped().eq('match_status', 'unmatched'),
        scoped().in('match_status', ['auto_matched', 'manually_matched']),
        scoped().eq('match_status', 'spam'),
        scoped().gte('created_at', today.toISOString()),
        scoped().eq('ai_intent', 'positive'),
        scoped().eq('ai_intent', 'negative'),
        scoped().eq('ai_intent', 'question'),
      ])

      return {
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
      queryClient.invalidateQueries({ queryKey: ['email-replies'] })
      queryClient.invalidateQueries({ queryKey: ['email-reply-counts'] })
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
      queryClient.invalidateQueries({ queryKey: ['email-replies'] })
      queryClient.invalidateQueries({ queryKey: ['email-reply-counts'] })
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['email-replies', data.contact_id] })
      queryClient.invalidateQueries({ queryKey: ['contact-automations'] })
      queryClient.invalidateQueries({ queryKey: ['email-reply-counts'] })
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
      queryClient.invalidateQueries({ queryKey: ['email-replies'] })
      queryClient.invalidateQueries({ queryKey: ['unmatched-email-replies'] })
      queryClient.invalidateQueries({ queryKey: ['email-reply-counts'] })
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
