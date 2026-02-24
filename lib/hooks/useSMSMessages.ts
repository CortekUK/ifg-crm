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
        query = query.in('match_status', ['auto_matched', 'manually_matched'])
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
        supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound')
          .in('match_status', ['auto_matched', 'manually_matched']),
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
