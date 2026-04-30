'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Inbox, MessagesSquare, Sparkles, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// Email Replies Components
import { EmailReplyTabs } from '@/components/email/EmailReplyTabs'
import { EmailReplyList } from '@/components/email/EmailReplyList'
import { IntentFilterChips } from '@/components/email/IntentFilterChips'
import { EmailDetailSheet } from '@/components/email/EmailDetailSheet'
import { MatchEmailModal } from '@/components/email/MatchEmailModal'
import { useEmailReplies, useEmailReplyCounts } from '@/lib/hooks/useEmailReplies'
import { useContact } from '@/lib/hooks/useContacts'

// SMS Replies Components
import { SMSReplyTabs } from '@/components/sms/SMSReplyTabs'
import { SMSReplyList } from '@/components/sms/SMSReplyList'
import { SMSDetailSheet } from '@/components/sms/SMSDetailSheet'
import { MatchContactModal } from '@/components/sms/MatchContactModal'
import { useSMSMessages, useSMSMessageCounts } from '@/lib/hooks/useSMSMessages'

// Smart Match & Smart Deal
import { SmartMatchModal } from '@/components/replies/SmartMatchModal'
import { SmartDealModal } from '@/components/replies/SmartDealModal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useMarkEmailAsSpam, useUnmarkEmailSpam } from '@/lib/hooks/useEmailReplies'
import { useMarkSMSAsSpam } from '@/lib/hooks/useSMSMessages'

import { PageHeader } from '@/components/shared/PageHeader'
import type { EmailReply } from '@/lib/types/email'
import type { SMSMessage } from '@/lib/types/sms'

export default function RepliesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Deep-link from automation detail: /replies?contactId=<id> filters to a
  // contact and auto-opens their most recent matched reply.
  const contactIdParam = searchParams.get('contactId')

  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email')
  const [userId, setUserId] = useState<string | null>(null)

  // Email state — start on Matched tab when deep-linking from a stopped enrollment,
  // because reply-driven exits always come from already-matched replies.
  const [emailIntentFilter, setEmailIntentFilter] = useState<'all' | 'positive' | 'question' | 'negative' | 'neutral' | 'unknown'>('all')
  // Coarse filters: 'all' shows everything, 'none' shows replies with
  // no campaign/pipeline at all, otherwise a specific id is matched.
  const [emailCampaignFilter, setEmailCampaignFilter] = useState<string>('all')
  const [emailPipelineFilter, setEmailPipelineFilter] = useState<string>('all')
  const [emailTab, setEmailTab] = useState<'all' | 'unmatched' | 'matched' | 'spam'>(
    contactIdParam ? 'matched' : 'unmatched'
  )
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
  const unmarkEmailSpam = useUnmarkEmailSpam()
  const markSMSSpam = useMarkSMSAsSpam()

  // Fetch data
  const emailRepliesQuery = useEmailReplies(emailTab)
  const { data: emailCounts } = useEmailReplyCounts(contactIdParam)
  const { data: filteredContact } = useContact(contactIdParam)
  const smsMessagesQuery = useSMSMessages(smsTab)
  const { data: smsCounts } = useSMSMessageCounts()

  const allEmailReplies = emailRepliesQuery.data?.pages?.flat() || []
  // Apply contact deep-link filter first; intent filter is layered on top so
  // counts under the chips reflect the contact context too.
  const contactScopedReplies = useMemo(
    () => contactIdParam
      ? allEmailReplies.filter((r) => r.contact_id === contactIdParam)
      : allEmailReplies,
    [contactIdParam, allEmailReplies]
  )
  // Distinct campaigns + pipelines pulled from the currently-loaded
  // replies, so the filter dropdowns only offer options that actually
  // have matches in view.
  const campaignOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of contactScopedReplies) {
      if (r.campaign_id) {
        map.set(r.campaign_id, r.campaign?.name || 'Untitled campaign')
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [contactScopedReplies])
  const pipelineOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of contactScopedReplies) {
      if (r.pipeline_id) {
        map.set(r.pipeline_id, r.pipeline?.name || 'Untitled pipeline')
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [contactScopedReplies])

  // Apply campaign + pipeline filters before the intent layer so the
  // intent counts reflect only what's currently visible.
  const filteredScopedReplies = useMemo(() => {
    let rows = contactScopedReplies
    if (emailCampaignFilter !== 'all') {
      rows = rows.filter((r) =>
        emailCampaignFilter === 'none' ? !r.campaign_id : r.campaign_id === emailCampaignFilter,
      )
    }
    if (emailPipelineFilter !== 'all') {
      rows = rows.filter((r) =>
        emailPipelineFilter === 'none' ? !r.pipeline_id : r.pipeline_id === emailPipelineFilter,
      )
    }
    return rows
  }, [contactScopedReplies, emailCampaignFilter, emailPipelineFilter])

  // Counts per intent — drives the chip badges. 'unknown' bucket covers null
  // (never classified), the literal 'unknown' label, and anything else.
  const emailIntentCounts = useMemo(() => {
    const counts = { all: filteredScopedReplies.length, positive: 0, question: 0, negative: 0, neutral: 0, unknown: 0 }
    for (const r of filteredScopedReplies) {
      const k = r.ai_intent ?? 'unknown'
      if (k === 'positive' || k === 'question' || k === 'negative' || k === 'neutral') {
        counts[k]++
      } else {
        counts.unknown++
      }
    }
    return counts
  }, [filteredScopedReplies])
  const emailReplies = useMemo(
    () => emailIntentFilter === 'all'
      ? filteredScopedReplies
      : filteredScopedReplies.filter((r) => {
          const k = r.ai_intent ?? 'unknown'
          if (emailIntentFilter === 'unknown') {
            return k !== 'positive' && k !== 'question' && k !== 'negative' && k !== 'neutral'
          }
          return k === emailIntentFilter
        }),
    [emailIntentFilter, filteredScopedReplies]
  )
  const smsMessages = smsMessagesQuery.data?.pages?.flat() || []

  // Auto-open the most recent reply for a deep-linked contact. Runs once when
  // the filtered results first appear; do not re-open if the user has dismissed.
  const [hasAutoOpened, setHasAutoOpened] = useState(false)
  useEffect(() => {
    if (!contactIdParam || hasAutoOpened || selectedEmail) return
    if (emailReplies.length > 0) {
      setSelectedEmail(emailReplies[0])
      setHasAutoOpened(true)
    }
  }, [contactIdParam, emailReplies, hasAutoOpened, selectedEmail])

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

  const handleUnmarkEmailSpam = (reply: EmailReply) => {
    unmarkEmailSpam.mutate({ replyId: reply.id })
  }

  const handleMarkSMSSpam = (message: SMSMessage) => {
    if (!userId) return
    markSMSSpam.mutate({ messageId: message.id, matchedById: userId })
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <PageHeader subtitle="View and manage email and SMS responses from players. Match replies to contacts and deals." />

      {/* Contact filter banner — shown when deep-linked from automation detail */}
      {contactIdParam && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Inbox className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-blue-900 dark:text-blue-200">
              Showing replies from{' '}
              <span className="font-semibold">
                {filteredContact
                  ? `${filteredContact.first_name ?? ''} ${filteredContact.last_name ?? ''}`.trim() || filteredContact.email
                  : 'this contact'}
              </span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.replace('/replies')}
            className="text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
          >
            Show all replies
          </Button>
        </div>
      )}

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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <EmailReplyTabs activeTab={emailTab} onTabChange={setEmailTab} counts={emailCounts || { all: 0, unmatched: 0, matched: 0, spam: 0 }} />
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
            {(emailTab === 'matched' || emailTab === 'all') && emailReplies.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Smart Deal only operates on matched replies (it
                    // needs a contact_id), so on the All tab we
                    // pre-select only the matched ones to avoid a noisy
                    // selection that includes unmatched/spam rows the
                    // modal would have to filter out anyway.
                    const eligibleIds = new Set(
                      emailReplies.filter((r) => !!r.contact_id).map((r) => r.id),
                    )
                    setSelectedEmailIds(eligibleIds)
                  }}
                  className="shrink-0"
                >
                  Select All ({emailReplies.filter((r) => !!r.contact_id).length})
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

          {/* Coarse filters — campaign + pipeline. 'No campaign' /
              'No pipeline' surface the orphan replies that previously
              vanished after Smart Deal could not place them. */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={emailCampaignFilter} onValueChange={setEmailCampaignFilter}>
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue placeholder="All campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                <SelectItem value="none">No campaign</SelectItem>
                {campaignOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={emailPipelineFilter} onValueChange={setEmailPipelineFilter}>
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue placeholder="All pipelines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pipelines</SelectItem>
                <SelectItem value="none">No pipeline</SelectItem>
                {pipelineOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(emailCampaignFilter !== 'all' || emailPipelineFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => {
                  setEmailCampaignFilter('all')
                  setEmailPipelineFilter('all')
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Intent filter chips — quickly slice replies by AI-classified intent. */}
          <IntentFilterChips
            value={emailIntentFilter}
            onChange={setEmailIntentFilter}
            counts={emailIntentCounts}
          />

          <EmailReplyList
            replies={emailReplies}
            isLoading={emailRepliesQuery.isLoading}
            onMatchClick={handleMatchEmail}
            onViewContact={handleViewContact}
            onMarkSpam={handleMarkEmailSpam}
            onUnmarkSpam={handleUnmarkEmailSpam}
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
