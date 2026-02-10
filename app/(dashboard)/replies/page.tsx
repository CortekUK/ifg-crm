'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Inbox, MessagesSquare, Sparkles, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

// Smart Match & Smart Deal
import { SmartMatchModal } from '@/components/replies/SmartMatchModal'
import { SmartDealModal } from '@/components/replies/SmartDealModal'

import { useMarkEmailAsSpam } from '@/lib/hooks/useEmailReplies'
import { useMarkSMSAsSpam } from '@/lib/hooks/useSMSMessages'

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

  // Smart Match & Smart Deal modal state
  const [smartMatchOpen, setSmartMatchOpen] = useState(false)
  const [smartDealOpen, setSmartDealOpen] = useState(false)

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

  // Mutations
  const markEmailSpam = useMarkEmailAsSpam()
  const markSMSSpam = useMarkSMSAsSpam()

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

  // Clear selections when switching tabs
  useEffect(() => {
    setSelectedEmailIds(new Set())
  }, [emailTab])

  useEffect(() => {
    setSelectedSMSIds(new Set())
  }, [smsTab])

  // Clear selections
  const clearEmailSelection = () => setSelectedEmailIds(new Set())
  const clearSMSSelection = () => setSelectedSMSIds(new Set())

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

  const handleMarkEmailSpam = (reply: EmailReply) => {
    if (!userId) return
    markEmailSpam.mutate({ replyId: reply.id, matchedById: userId })
  }

  const handleMarkSMSSpam = (message: SMSMessage) => {
    if (!userId) return
    markSMSSpam.mutate({ messageId: message.id, matchedById: userId })
  }

  return (
    <div className="space-y-6">
      {/* Main Tabs - Email vs SMS */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'email' | 'sms')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Email Tab Trigger */}
          <button
            onClick={() => setActiveTab('email')}
            className={cn(
              'rounded-xl border p-5 text-left transition-all',
              activeTab === 'email'
                ? 'border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900/50'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn('p-2 rounded-lg', activeTab === 'email' ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-slate-100 dark:bg-slate-800')}>
                  <Inbox className={cn('h-4 w-4', activeTab === 'email' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500')} />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Email Replies</h3>
              </div>
              {emailCounts && emailCounts.unmatched > 0 && (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-full">
                  {emailCounts.unmatched} Unmatched
                </span>
              )}
            </div>
            <div className="flex items-center gap-6 mt-4">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{emailCounts?.today || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Received Today</p>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">{emailCounts?.positive || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Positive Intent</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-red-500 dark:text-red-400">{emailCounts?.negative || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Negative Intent</p>
              </div>
            </div>
          </button>

          {/* SMS Tab Trigger */}
          <button
            onClick={() => setActiveTab('sms')}
            className={cn(
              'rounded-xl border p-5 text-left transition-all',
              activeTab === 'sms'
                ? 'border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-purple-100 dark:ring-purple-900/50'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn('p-2 rounded-lg', activeTab === 'sms' ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-slate-100 dark:bg-slate-800')}>
                  <MessagesSquare className={cn('h-4 w-4', activeTab === 'sms' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500')} />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">SMS Replies</h3>
              </div>
              {smsCounts && smsCounts.unmatched > 0 && (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-full">
                  {smsCounts.unmatched} Unmatched
                </span>
              )}
            </div>
            <div className="flex items-center gap-6 mt-4">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{smsCounts?.today || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Received Today</p>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">{smsCounts?.positive || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Positive Intent</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-red-500 dark:text-red-400">{smsCounts?.negative || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Negative Intent</p>
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
                  size="sm"
                  className="shrink-0 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white shadow-sm"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Smart Match{selectedEmailIds.size > 0 ? ` (${selectedEmailIds.size})` : ''}
                </Button>
              </div>
            )}
            {emailTab === 'matched' && emailReplies.length > 0 && (
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
                  onClick={() => setSmartDealOpen(true)}
                  disabled={selectedEmailIds.size === 0}
                  size="sm"
                  className="shrink-0 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-500 disabled:cursor-not-allowed text-white shadow-sm"
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  Smart Deal{selectedEmailIds.size > 0 ? ` (${selectedEmailIds.size})` : ''}
                </Button>
              </div>
            )}
          </div>

          <EmailReplyList
            replies={emailReplies}
            isLoading={emailRepliesQuery.isLoading}
            onMatchClick={handleMatchEmail}
            onViewContact={handleViewContact}
            onMarkSpam={handleMarkEmailSpam}
            onViewFull={setSelectedEmail}
            hasNextPage={emailRepliesQuery.hasNextPage}
            onLoadMore={() => emailRepliesQuery.fetchNextPage()}
            isLoadingMore={emailRepliesQuery.isFetchingNextPage}
            selectable={emailTab !== 'spam'}
            selectedIds={selectedEmailIds}
            onSelectChange={handleEmailSelectChange}
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
                  size="sm"
                  className="shrink-0 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white shadow-sm"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Smart Match{selectedSMSIds.size > 0 ? ` (${selectedSMSIds.size})` : ''}
                </Button>
              </div>
            )}
            {smsTab === 'matched' && smsMessages.length > 0 && (
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
                  onClick={() => setSmartDealOpen(true)}
                  disabled={selectedSMSIds.size === 0}
                  size="sm"
                  className="shrink-0 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-500 disabled:cursor-not-allowed text-white shadow-sm"
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  Smart Deal{selectedSMSIds.size > 0 ? ` (${selectedSMSIds.size})` : ''}
                </Button>
              </div>
            )}
          </div>

          <SMSReplyList
            messages={smsMessages}
            isLoading={smsMessagesQuery.isLoading}
            onMatchClick={handleMatchSMS}
            onViewContact={handleViewContact}
            onMarkSpam={handleMarkSMSSpam}
            onViewFull={setSelectedSMS}
            hasNextPage={smsMessagesQuery.hasNextPage}
            onLoadMore={() => smsMessagesQuery.fetchNextPage()}
            isLoadingMore={smsMessagesQuery.isFetchingNextPage}
            selectable={smsTab !== 'spam'}
            selectedIds={selectedSMSIds}
            onSelectChange={handleSMSSelectChange}
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

      {/* Smart Deal Modal */}
      {userId && (
        <SmartDealModal
          isOpen={smartDealOpen}
          onClose={() => {
            setSmartDealOpen(false)
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
