import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SMSMessage, SMSMatchStatus, SMSMessageCounts } from '@/lib/types/sms'

const SMS_PAGE_SIZE = 20

export function useSMSMessages(matchStatus: 'unmatched' | 'matched' | 'spam') {
  const supabase = createClient()

  return useInfiniteQuery<SMSMessage[]>({
    queryKey: ['sms-messages', matchStatus],
    queryFn: async ({ pageParam }) => {
      const page = (pageParam as number) ?? 0
      let query = supabase
        .from('sms_messages')
        .select(`
          *,
          contact:contacts(*),
          pipeline:pipelines(*),
          matched_by:profiles(*)
        `)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .range(page * SMS_PAGE_SIZE, (page + 1) * SMS_PAGE_SIZE - 1)

      if (matchStatus === 'unmatched') {
        query = query.eq('match_status', 'unmatched')
      } else if (matchStatus === 'spam') {
        query = query.eq('match_status', 'spam')
      } else {
        // Matched only shows UNREAD inbound SMS — once acked, the
        // message is hidden from this tab; the All view (if any) keeps
        // it. Mirrors the email Matched-inbox UX.
        query = query
          .in('match_status', ['auto_matched', 'manually_matched'])
          .eq('read', false)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === SMS_PAGE_SIZE ? allPages.length : undefined
    },
  })
}

export function useSMSMessageCounts() {
  const supabase = createClient()

  return useQuery<SMSMessageCounts>({
    queryKey: ['sms-message-counts'],
    queryFn: async () => {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const [
        { count: unmatchedCount },
        { count: matchedCount },
        { count: spamCount },
        { count: todayCount },
        { count: positiveCount },
        { count: negativeCount },
        { count: questionCount },
      ] = await Promise.all([
        supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound')
          .eq('match_status', 'unmatched'),
        // Matched count reflects the unread Matched inbox the user
        // sees in the tab; read messages live in 'all' only.
        supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound')
          .in('match_status', ['auto_matched', 'manually_matched'])
          .eq('read', false),
        supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound')
          .eq('match_status', 'spam'),
        supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound')
          .gte('created_at', startOfDay.toISOString()),
        supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound')
          .eq('ai_intent', 'positive')
          .eq('match_status', 'unmatched'),
        supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound')
          .eq('ai_intent', 'negative')
          .eq('match_status', 'unmatched'),
        supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound')
          .eq('ai_intent', 'question')
          .eq('match_status', 'unmatched'),
      ])

      return {
        unmatched: unmatchedCount || 0,
        matched: matchedCount || 0,
        spam: spamCount || 0,
        today: todayCount || 0,
        positive: positiveCount || 0,
        negative: negativeCount || 0,
        question: questionCount || 0,
      }
    },
  })
}

export function useMatchSMSMessage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      messageId,
      contactId,
      matchedById,
    }: {
      messageId: string
      contactId: string
      matchedById: string
    }) => {
      const { error } = await supabase
        .from('sms_messages')
        .update({
          contact_id: contactId,
          match_status: 'manually_matched' as SMSMatchStatus,
          matched_by_id: matchedById,
          matched_at: new Date().toISOString(),
        })
        .eq('id', messageId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-messages'] })
      queryClient.invalidateQueries({ queryKey: ['sms-message-counts'] })
    },
  })
}

export function useMarkSMSAsSpam() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      messageId,
      matchedById,
    }: {
      messageId: string
      matchedById: string
    }) => {
      const { error } = await supabase
        .from('sms_messages')
        .update({
          match_status: 'spam' as SMSMatchStatus,
          matched_by_id: matchedById,
          matched_at: new Date().toISOString(),
        })
        .eq('id', messageId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-messages'] })
      queryClient.invalidateQueries({ queryKey: ['sms-message-counts'] })
    },
  })
}

// Mark one or more matched SMS messages as read. Hides them from the
// Matched tab; counts decrement so the inbox feels like a real
// inbox/archive flow.
export function useMarkSMSMessagesRead() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (messageIds: string[]) => {
      if (messageIds.length === 0) return []
      const { data, error } = await supabase
        .from('sms_messages')
        .update({ read: true })
        .in('id', messageIds)
        .select('id')
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-messages'] })
      queryClient.invalidateQueries({ queryKey: ['sms-message-counts'] })
    },
  })
}
