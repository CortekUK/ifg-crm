'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { EmailRepliesPageHeader } from '@/components/email/EmailRepliesPageHeader'
import { EmailReplyTabs } from '@/components/email/EmailReplyTabs'
import { EmailReplyStats } from '@/components/email/EmailReplyStats'
import { EmailReplyList } from '@/components/email/EmailReplyList'
import { MatchEmailModal } from '@/components/email/MatchEmailModal'
import { EmailDetailSheet } from '@/components/email/EmailDetailSheet'
import {
  useEmailReplies,
  useEmailReplyCounts,
  useMarkEmailAsSpam,
} from '@/lib/hooks/useEmailReplies'
import { createClient } from '@/lib/supabase/client'
import type { EmailReply } from '@/lib/types/email'

export default function EmailRepliesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'unmatched' | 'matched' | 'spam'>('unmatched')
  const [selectedReply, setSelectedReply] = useState<EmailReply | null>(null)
  const [viewingReply, setViewingReply] = useState<EmailReply | null>(null)

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    fetchUser()
  }, [])

  // Fetch data with infinite query
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useEmailReplies(activeTab)
  
  // Flatten pages into single array
  const replies = useMemo(() => {
    return data?.pages.flat() || []
  }, [data])

  const { data: counts, isLoading: countsLoading } = useEmailReplyCounts()
  const markAsSpam = useMarkEmailAsSpam()

  const handleMatchClick = (reply: EmailReply) => {
    setSelectedReply(reply)
  }

  const handleViewContact = (contactId: string) => {
    router.push(`/contacts?id=${contactId}`)
  }

  const handleMarkSpam = async (reply: EmailReply) => {
    if (!userId) return
    if (confirm('Are you sure you want to mark this email as spam?')) {
      try {
        await markAsSpam.mutateAsync({
          replyId: reply.id,
          matchedById: userId,
        })
      } catch (error) {
        console.error('Failed to mark as spam:', error)
      }
    }
  }

  const handleViewFull = (reply: EmailReply) => {
    setViewingReply(reply)
  }

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'unmatched':
        return 'All email replies have been matched to contacts.'
      case 'matched':
        return 'No matched emails yet.'
      case 'spam':
        return 'No spam emails.'
      default:
        return 'No emails to display.'
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <EmailRepliesPageHeader unmatchedCount={counts?.unmatched || 0} />

      {/* Stats */}
      <EmailReplyStats
        today={counts?.today || 0}
        positive={counts?.positive || 0}
        negative={counts?.negative || 0}
        needsReview={counts?.unmatched || 0}
        isLoading={countsLoading}
      />

      {/* Tabs */}
      <EmailReplyTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{
          unmatched: counts?.unmatched || 0,
          matched: counts?.matched || 0,
          spam: counts?.spam || 0,
        }}
      />

      {/* Email List */}
      <EmailReplyList
        replies={replies}
        isLoading={isLoading}
        onMatchClick={handleMatchClick}
        onViewContact={handleViewContact}
        onMarkSpam={handleMarkSpam}
        onViewFull={handleViewFull}
        emptyMessage={getEmptyMessage()}
        hasNextPage={hasNextPage}
        onLoadMore={fetchNextPage}
        isLoadingMore={isFetchingNextPage}
      />

      {/* Match Contact Modal */}
      {userId && (
        <MatchEmailModal
          reply={selectedReply}
          isOpen={!!selectedReply}
          onClose={() => setSelectedReply(null)}
          userId={userId}
        />
      )}

      {/* Email Detail Sheet */}
      <EmailDetailSheet
        reply={viewingReply}
        isOpen={!!viewingReply}
        onClose={() => setViewingReply(null)}
      />
    </div>
  )
}
