import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { EmailReply, EmailMatchStatus, EmailReplyCounts } from '@/lib/types/email'

export function useEmailReplies(matchStatus: 'unmatched' | 'matched' | 'spam') {
  const supabase = createClient()

  return useQuery<EmailReply[]>({
    queryKey: ['email-replies', matchStatus],
    queryFn: async () => {
      let query = supabase
        .from('email_replies')
        .select(`
          *,
          contact:contacts(*),
          campaign:campaigns(*),
          matched_by:profiles(*)
        `)
        .order('created_at', { ascending: false })

      if (matchStatus === 'unmatched') {
        query = query.eq('match_status', 'unmatched')
      } else if (matchStatus === 'spam') {
        query = query.eq('match_status', 'spam')
      } else {
        // 'matched' includes both auto and manually matched
        query = query.in('match_status', ['auto_matched', 'manually_matched'])
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
  })
}

export function useEmailReplyCounts() {
  const supabase = createClient()

  return useQuery<EmailReplyCounts>({
    queryKey: ['email-reply-counts'],
    queryFn: async () => {
      // Get unmatched count
      const { count: unmatchedCount } = await supabase
        .from('email_replies')
        .select('*', { count: 'exact', head: true })
        .eq('match_status', 'unmatched')

      // Get matched count
      const { count: matchedCount } = await supabase
        .from('email_replies')
        .select('*', { count: 'exact', head: true })
        .in('match_status', ['auto_matched', 'manually_matched'])

      // Get spam count
      const { count: spamCount } = await supabase
        .from('email_replies')
        .select('*', { count: 'exact', head: true })
        .eq('match_status', 'spam')

      // Get today's count
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const { count: todayCount } = await supabase
        .from('email_replies')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString())

      // Get positive intent count
      const { count: positiveCount } = await supabase
        .from('email_replies')
        .select('*', { count: 'exact', head: true })
        .eq('ai_intent', 'positive')
        .eq('match_status', 'unmatched')

      // Get negative intent count
      const { count: negativeCount } = await supabase
        .from('email_replies')
        .select('*', { count: 'exact', head: true })
        .eq('ai_intent', 'negative')
        .eq('match_status', 'unmatched')

      return {
        unmatched: unmatchedCount || 0,
        matched: matchedCount || 0,
        spam: spamCount || 0,
        today: todayCount || 0,
        positive: positiveCount || 0,
        negative: negativeCount || 0,
      }
    },
  })
}

export function useMatchEmailReply() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      replyId,
      contactId,
      matchedById,
    }: {
      replyId: string
      contactId: string
      matchedById: string
    }) => {
      const { error } = await supabase
        .from('email_replies')
        .update({
          contact_id: contactId,
          match_status: 'manually_matched' as EmailMatchStatus,
          matched_by_id: matchedById,
          matched_at: new Date().toISOString(),
        })
        .eq('id', replyId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-replies'] })
      queryClient.invalidateQueries({ queryKey: ['email-reply-counts'] })
    },
  })
}

export function useMarkEmailAsSpam() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      replyId,
      matchedById,
    }: {
      replyId: string
      matchedById: string
    }) => {
      const { error } = await supabase
        .from('email_replies')
        .update({
          match_status: 'spam' as EmailMatchStatus,
          matched_by_id: matchedById,
          matched_at: new Date().toISOString(),
        })
        .eq('id', replyId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-replies'] })
      queryClient.invalidateQueries({ queryKey: ['email-reply-counts'] })
    },
  })
}
