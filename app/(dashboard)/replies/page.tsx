'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Inbox, Mail, MessageSquare, MessagesSquare, CalendarDays, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'

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

// Bulk Actions
import { BulkActionsBar } from '@/components/replies/BulkActionsBar'
import { SmartMatchModal } from '@/components/replies/SmartMatchModal'
import { useBulkProcessEmailReplies, useBulkProcessSMSMessages } from '@/lib/hooks/useBulkReplyActions'

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

  // Bulk selection state
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set())
  const [selectedSMSIds, setSelectedSMSIds] = useState<Set<string>>(new Set())

  // Smart Match modal state
  const [smartMatchOpen, setSmartMatchOpen] = useState(false)

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

  // Get selected replies for bulk processing
  const selectedEmailReplies = useMemo(
    () => emailReplies.filter((r) => selectedEmailIds.has(r.id)),
    [emailReplies, selectedEmailIds]
  )
  const selectedSMSMessages = useMemo(
    () => smsMessages.filter((m) => selectedSMSIds.has(m.id)),
    [smsMessages, selectedSMSIds]
  )

  // Bulk processing hooks
  const bulkProcessEmails = useBulkProcessEmailReplies(selectedEmailReplies)
  const bulkProcessSMS = useBulkProcessSMSMessages(selectedSMSMessages)

  // Count positive intent in selection
  const selectedPositiveEmailCount = selectedEmailReplies.filter(
    (r) => r.ai_intent === 'positive'
  ).length
  const selectedPositiveSMSCount = selectedSMSMessages.filter(
    (m) => m.ai_intent === 'positive'
  ).length

  // Handle email selection change
  const handleEmailSelectChange = (reply: EmailReply, selected: boolean) => {
    setSelectedEmailIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(reply.id)
      } else {
        next.delete(reply.id)
      }
      return next
    })
  }

  // Handle SMS selection change
  const handleSMSSelectChange = (message: SMSMessage, selected: boolean) => {
    setSelectedSMSIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(message.id)
      } else {
        next.delete(message.id)
      }
      return next
    })
  }

  // Clear selections
  const clearEmailSelection = () => setSelectedEmailIds(new Set())
  const clearSMSSelection = () => setSelectedSMSIds(new Set())

  // Apply bulk recommendations for emails
  const handleApplyEmailRecommendations = async (pipelineId: string) => {
    if (!userId) return
    try {
      const result = await bulkProcessEmails.mutateAsync({ pipelineId, userId })
      toast({
        title: 'Recommendations applied',
        description: `Processed ${result.processed} replies. ${result.dealsCreated} deals created, ${result.contactsCreated} contacts created, ${result.contactsMatched} contacts matched.`,
      })
      clearEmailSelection()
    } catch (error) {
      toast({
        title: 'Error applying recommendations',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  // Apply bulk recommendations for SMS
  const handleApplySMSRecommendations = async (pipelineId: string) => {
    if (!userId) return
    try {
      const result = await bulkProcessSMS.mutateAsync({ pipelineId, userId })
      toast({
        title: 'Recommendations applied',
        description: `Processed ${result.processed} messages. ${result.dealsCreated} deals created, ${result.contactsCreated} contacts created, ${result.contactsMatched} contacts matched.`,
      })
      clearSMSSelection()
    } catch (error) {
      toast({
        title: 'Error applying recommendations',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Email Tab Trigger as Card */}
          <button
            onClick={() => setActiveTab('email')}
            className={`
              relative overflow-hidden rounded-xl border-2 p-6 text-left transition-all
              ${activeTab === 'email' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' 
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-600'
              }
            `}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${activeTab === 'email' ? 'bg-blue-500 text-white' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'}`}>
                  <Inbox className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Email Replies</h3>
                  <p className="text-sm text-muted-foreground">Review inbound email responses</p>
                </div>
              </div>
              {emailCounts && emailCounts.unmatched > 0 && (
                <div className="bg-red-500 text-white text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <span className="text-xs uppercase tracking-wide">Unmatched</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded">{emailCounts.unmatched}</span>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <CalendarDays className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Today</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{emailCounts?.today || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
                <div>
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium uppercase tracking-wide">Positive</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{emailCounts?.positive || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">✗</div>
                <div>
                  <p className="text-xs text-red-700 dark:text-red-400 font-medium uppercase tracking-wide">Negative</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{emailCounts?.negative || 0}</p>
                </div>
              </div>
            </div>
          </button>

          {/* SMS Tab Trigger as Card */}
          <button
            onClick={() => setActiveTab('sms')}
            className={`
              relative overflow-hidden rounded-xl border-2 p-6 text-left transition-all
              ${activeTab === 'sms' 
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30' 
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-600'
              }
            `}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${activeTab === 'sms' ? 'bg-purple-500 text-white' : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'}`}>
                  <MessagesSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white">SMS Replies</h3>
                  <p className="text-sm text-muted-foreground">Review inbound text messages</p>
                </div>
              </div>
              {smsCounts && smsCounts.unmatched > 0 && (
                <div className="bg-red-500 text-white text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <span className="text-xs uppercase tracking-wide">Unmatched</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded">{smsCounts.unmatched}</span>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <CalendarDays className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Today</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{smsCounts?.today || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
                <div>
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium uppercase tracking-wide">Positive</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{smsCounts?.positive || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">✗</div>
                <div>
                  <p className="text-xs text-red-700 dark:text-red-400 font-medium uppercase tracking-wide">Negative</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{smsCounts?.negative || 0}</p>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-6 mt-0">
          <div className="flex items-center justify-between gap-4">
            <EmailReplyTabs activeTab={emailTab} onTabChange={setEmailTab} counts={emailCounts || { unmatched: 0, matched: 0, spam: 0 }} />
            {emailTab === 'unmatched' && emailReplies.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allIds = new Set(emailReplies.map(r => r.id))
                    setSelectedEmailIds(allIds)
                  }}
                  className="shrink-0"
                >
                  Select All ({emailReplies.length})
                </Button>
                <Button
                  onClick={() => setSmartMatchOpen(true)}
                  disabled={selectedEmailIds.size === 0}
                  className="bg-purple-600 hover:bg-purple-700 text-white shrink-0 disabled:opacity-50"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Smart Match {selectedEmailIds.size > 0 && `(${selectedEmailIds.size})`}
                </Button>
              </div>
            )}
          </div>

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
            selectable={emailTab !== 'spam'}
            selectedIds={selectedEmailIds}
            onSelectChange={handleEmailSelectChange}
          />

          {/* Bulk Actions Bar for Emails */}
          <BulkActionsBar
            selectedCount={selectedEmailIds.size}
            positiveCount={selectedPositiveEmailCount}
            onApplyRecommendations={handleApplyEmailRecommendations}
            onClearSelection={clearEmailSelection}
            isProcessing={bulkProcessEmails.isPending}
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
        <TabsContent value="sms" className="space-y-6 mt-0">
          <div className="flex items-center justify-between gap-4">
            <SMSReplyTabs activeTab={smsTab} onTabChange={setSmsTab} counts={smsCounts || { unmatched: 0, matched: 0, spam: 0 }} />
            {smsTab === 'unmatched' && smsMessages.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allIds = new Set(smsMessages.map(m => m.id))
                    setSelectedSMSIds(allIds)
                  }}
                  className="shrink-0"
                >
                  Select All ({smsMessages.length})
                </Button>
                <Button
                  onClick={() => setSmartMatchOpen(true)}
                  disabled={selectedSMSIds.size === 0}
                  className="bg-purple-600 hover:bg-purple-700 text-white shrink-0 disabled:opacity-50"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Smart Match {selectedSMSIds.size > 0 && `(${selectedSMSIds.size})`}
                </Button>
              </div>
            )}
          </div>

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
            selectable={smsTab !== 'spam'}
            selectedIds={selectedSMSIds}
            onSelectChange={handleSMSSelectChange}
          />

          {/* Bulk Actions Bar for SMS */}
          <BulkActionsBar
            selectedCount={selectedSMSIds.size}
            positiveCount={selectedPositiveSMSCount}
            onApplyRecommendations={handleApplySMSRecommendations}
            onClearSelection={clearSMSSelection}
            isProcessing={bulkProcessSMS.isPending}
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

      {/* Smart Match Modal */}
      {userId && (
        <SmartMatchModal
          isOpen={smartMatchOpen}
          onClose={() => {
            setSmartMatchOpen(false)
            // Clear selections after closing (matches have been applied)
            if (activeTab === 'email') {
              clearEmailSelection()
            } else {
              clearSMSSelection()
            }
          }}
          type={activeTab}
          replies={activeTab === 'email' ? selectedEmailReplies : undefined}
          messages={activeTab === 'sms' ? selectedSMSMessages : undefined}
          userId={userId}
        />
      )}
    </div>
  )
}
