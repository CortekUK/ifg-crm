'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { SMSRepliesPageHeader } from '@/components/sms/SMSRepliesPageHeader'
import { SMSReplyTabs } from '@/components/sms/SMSReplyTabs'
import { SMSReplyStats } from '@/components/sms/SMSReplyStats'
import { SMSReplyList } from '@/components/sms/SMSReplyList'
import { MatchContactModal } from '@/components/sms/MatchContactModal'
import { SMSDetailSheet } from '@/components/sms/SMSDetailSheet'
import {
  useSMSMessages,
  useSMSMessageCounts,
  useMarkSMSAsSpam,
} from '@/lib/hooks/useSMSMessages'
import { createClient } from '@/lib/supabase/client'
import type { SMSMessage } from '@/lib/types/sms'

export default function SMSRepliesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'unmatched' | 'matched' | 'spam'>('unmatched')
  const [selectedMessage, setSelectedMessage] = useState<SMSMessage | null>(null)
  const [viewingMessage, setViewingMessage] = useState<SMSMessage | null>(null)

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
  } = useSMSMessages(activeTab)
  
  // Flatten pages into single array
  const messages = useMemo(() => {
    return data?.pages.flat() || []
  }, [data])

  const { data: counts, isLoading: countsLoading } = useSMSMessageCounts()
  const markAsSpam = useMarkSMSAsSpam()

  const handleMatchClick = (message: SMSMessage) => {
    setSelectedMessage(message)
  }

  const handleViewFull = (message: SMSMessage) => {
    setViewingMessage(message)
  }

  const handleViewContact = (contactId: string) => {
    router.push(`/contacts?id=${contactId}`)
  }

  const handleMarkSpam = async (message: SMSMessage) => {
    if (!userId) return
    if (confirm('Are you sure you want to mark this message as spam?')) {
      try {
        await markAsSpam.mutateAsync({
          messageId: message.id,
          matchedById: userId,
        })
      } catch (error) {
        console.error('Failed to mark as spam:', error)
      }
    }
  }

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'unmatched':
        return 'All SMS messages have been matched to contacts.'
      case 'matched':
        return 'No matched messages yet.'
      case 'spam':
        return 'No spam messages.'
      default:
        return 'No messages to display.'
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <SMSRepliesPageHeader unmatchedCount={counts?.unmatched || 0} />

      {/* Stats */}
      <SMSReplyStats
        today={counts?.today || 0}
        positive={counts?.positive || 0}
        negative={counts?.negative || 0}
        needsReview={counts?.unmatched || 0}
        isLoading={countsLoading}
      />

      {/* Tabs */}
      <SMSReplyTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{
          unmatched: counts?.unmatched || 0,
          matched: counts?.matched || 0,
          spam: counts?.spam || 0,
        }}
      />

      {/* Message List */}
      <SMSReplyList
        messages={messages}
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
        <MatchContactModal
          message={selectedMessage}
          isOpen={!!selectedMessage}
          onClose={() => setSelectedMessage(null)}
          userId={userId}
        />
      )}

      {/* SMS Detail Sheet */}
      <SMSDetailSheet
        message={viewingMessage}
        isOpen={!!viewingMessage}
        onClose={() => setViewingMessage(null)}
      />
    </div>
  )
}
