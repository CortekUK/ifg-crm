'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Mail, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Email Replies Components
import { EmailReplyStats } from '@/components/email/EmailReplyStats'
import { EmailReplyTabs } from '@/components/email/EmailReplyTabs'
import { EmailReplyList } from '@/components/email/EmailReplyList'
import { EmailDetailSheet } from '@/components/email/EmailDetailSheet'
import { MatchEmailModal } from '@/components/email/MatchEmailModal'
import { useEmailReplies, useEmailReplyCounts } from '@/lib/hooks/useEmailReplies'

// SMS Replies Components
import { SMSReplyStats } from '@/components/sms/SMSReplyStats'
import { SMSReplyTabs } from '@/components/sms/SMSReplyTabs'
import { SMSReplyList } from '@/components/sms/SMSReplyList'
import { SMSDetailSheet } from '@/components/sms/SMSDetailSheet'
import { MatchContactModal } from '@/components/sms/MatchContactModal'
import { useSMSMessages, useSMSMessageCounts } from '@/lib/hooks/useSMSMessages'

import type { EmailReply } from '@/lib/types/email'
import type { SMSMessage } from '@/lib/types/sms'

export default function RepliesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email')
  const [userId, setUserId] = useState<string | null>(null)

  // Email state
  const [emailTab, setEmailTab] = useState<'unmatched' | 'matched' | 'spam'>('unmatched')
  const [selectedEmail, setSelectedEmail] = useState<EmailReply | null>(null)
  const [matchEmailModalOpen, setMatchEmailModalOpen] = useState(false)
  const [emailToMatch, setEmailToMatch] = useState<EmailReply | null>(null)

  // SMS state
  const [smsTab, setSmsTab] = useState<'unmatched' | 'matched' | 'spam'>('unmatched')
  const [selectedSMS, setSelectedSMS] = useState<SMSMessage | null>(null)
  const [matchSMSModalOpen, setMatchSMSModalOpen] = useState(false)
  const [smsToMatch, setSmsToMatch] = useState<SMSMessage | null>(null)

  // Get current user
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

  // Fetch data
  const emailRepliesQuery = useEmailReplies(emailTab)
  const { data: emailCounts } = useEmailReplyCounts()
  const smsMessagesQuery = useSMSMessages(smsTab)
  const { data: smsCounts } = useSMSMessageCounts()

  const emailReplies = emailRepliesQuery.data?.pages?.flat() || []
  const smsMessages = smsMessagesQuery.data?.pages?.flat() || []

  const handleMatchEmail = (reply: EmailReply) => {
    setEmailToMatch(reply)
    setMatchEmailModalOpen(true)
  }

  const handleMatchSMS = (message: SMSMessage) => {
    setSmsToMatch(message)
    setMatchSMSModalOpen(true)
  }

  const handleViewContact = (contactId: string) => {
    router.push(`/contacts?id=${contactId}`)
  }

  return (
    <div className="space-y-6">
      {/* Unified Header */}
      <div className="banner-gradient rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-white/90 text-base">
              Manage all inbound communications in one place - email replies and SMS messages
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs - Email vs SMS */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'email' | 'sms')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Replies
            {emailCounts && emailCounts.unmatched > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {emailCounts.unmatched}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS Replies
            {smsCounts && smsCounts.unmatched > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {smsCounts.unmatched}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-6 mt-6">
          <EmailReplyStats
            today={emailCounts?.today || 0}
            positive={emailCounts?.positive || 0}
            negative={emailCounts?.negative || 0}
            needsReview={emailReplies.filter((r) => !r.ai_intent || r.ai_intent === 'unknown').length}
            isLoading={emailRepliesQuery.isLoading}
          />

          <EmailReplyTabs activeTab={emailTab} onTabChange={setEmailTab} counts={emailCounts || { unmatched: 0, matched: 0, spam: 0 }} />

          <EmailReplyList
            replies={emailReplies}
            isLoading={emailRepliesQuery.isLoading}
            onMatchClick={handleMatchEmail}
            onViewContact={handleViewContact}
            onMarkSpam={() => {}}
            onViewFull={setSelectedEmail}
            hasNextPage={emailRepliesQuery.hasNextPage}
            onLoadMore={() => emailRepliesQuery.fetchNextPage()}
            isLoadingMore={emailRepliesQuery.isFetchingNextPage}
          />

          <EmailDetailSheet
            reply={selectedEmail}
            isOpen={!!selectedEmail}
            onClose={() => setSelectedEmail(null)}
          />

          {userId && (
            <MatchEmailModal
              reply={emailToMatch}
              isOpen={matchEmailModalOpen}
              onClose={() => {
                setMatchEmailModalOpen(false)
                setEmailToMatch(null)
              }}
              userId={userId}
            />
          )}
        </TabsContent>

        {/* SMS Tab */}
        <TabsContent value="sms" className="space-y-6 mt-6">
          <SMSReplyStats
            today={smsCounts?.today || 0}
            positive={smsCounts?.positive || 0}
            negative={smsCounts?.negative || 0}
            needsReview={smsMessages.filter((m) => !m.ai_intent || m.ai_intent === 'unknown').length}
            isLoading={smsMessagesQuery.isLoading}
          />

          <SMSReplyTabs activeTab={smsTab} onTabChange={setSmsTab} counts={smsCounts || { unmatched: 0, matched: 0, spam: 0 }} />

          <SMSReplyList
            messages={smsMessages}
            isLoading={smsMessagesQuery.isLoading}
            onMatchClick={handleMatchSMS}
            onViewContact={handleViewContact}
            onMarkSpam={() => {}}
            onViewFull={setSelectedSMS}
            hasNextPage={smsMessagesQuery.hasNextPage}
            onLoadMore={() => smsMessagesQuery.fetchNextPage()}
            isLoadingMore={smsMessagesQuery.isFetchingNextPage}
          />

          <SMSDetailSheet
            message={selectedSMS}
            isOpen={!!selectedSMS}
            onClose={() => setSelectedSMS(null)}
          />

          {userId && (
            <MatchContactModal
              message={smsToMatch}
              isOpen={matchSMSModalOpen}
              onClose={() => {
                setMatchSMSModalOpen(false)
                setSmsToMatch(null)
              }}
              userId={userId}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
