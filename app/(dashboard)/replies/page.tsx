'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Inbox, MessagesSquare, Sparkles, Briefcase, Check, Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// Email Replies Components
import { EmailReplyTabs } from '@/components/email/EmailReplyTabs'
import { EmailReplyList } from '@/components/email/EmailReplyList'
import { IntentFilterChips } from '@/components/email/IntentFilterChips'
import { EmailDetailSheet } from '@/components/email/EmailDetailSheet'
import { MatchEmailModal } from '@/components/email/MatchEmailModal'
import {
  useEmailReplies,
  useEmailReplyCounts,
  useEmailReplyIntentCounts,
  useEmailReplyFilterOptions,
} from '@/lib/hooks/useEmailReplies'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { Input } from '@/components/ui/input'
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

import { useMarkEmailAsSpam, useUnmarkEmailSpam, useMarkEmailRepliesRead, useUnmatchEmailReply } from '@/lib/hooks/useEmailReplies'
import { useMarkSMSAsSpam, useMarkSMSMessagesRead } from '@/lib/hooks/useSMSMessages'

import { PageHeader } from '@/components/shared/PageHeader'
import { toast } from '@/lib/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  const [emailSearch, setEmailSearch] = useState('')
  const [emailCampaignFilter, setEmailCampaignFilter] = useState<string>('all')
  const [emailPipelineFilter, setEmailPipelineFilter] = useState<string>('all')
  const [emailTab, setEmailTab] = useState<'all' | 'unmatched' | 'matched' | 'spam'>(
    contactIdParam ? 'matched' : 'unmatched'
  )
  const [selectedEmail, setSelectedEmail] = useState<EmailReply | null>(null)
  const [matchEmailModalOpen, setMatchEmailModalOpen] = useState(false)
  const [emailToMatch, setEmailToMatch] = useState<EmailReply | null>(null)
  // QA-31 bug 5: confirm before detaching a reply from a player.
  const [emailToUnmatch, setEmailToUnmatch] = useState<EmailReply | null>(null)

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
  const markEmailRead = useMarkEmailRepliesRead()
  const markSMSRead = useMarkSMSMessagesRead()
  const unmarkEmailSpam = useUnmarkEmailSpam()
  const unmatchEmailReply = useUnmatchEmailReply()
  const markSMSSpam = useMarkSMSAsSpam()

  // Fetch data. The search is debounced so typing doesn't fire a query per
  // keystroke now that filtering is a round trip.
  const debouncedEmailSearch = useDebouncedValue(emailSearch, 300)
  // The chip counts must NOT be narrowed by the intent chip itself, or picking
  // "Positive" would leave every other chip reading 0.
  const emailFiltersWithoutIntent = useMemo(
    () => ({
      search: debouncedEmailSearch,
      campaign: emailCampaignFilter,
      pipeline: emailPipelineFilter,
      contactId: contactIdParam,
    }),
    [debouncedEmailSearch, emailCampaignFilter, emailPipelineFilter, contactIdParam],
  )
  const emailRepliesQuery = useEmailReplies(emailTab, {
    ...emailFiltersWithoutIntent,
    intent: emailIntentFilter,
  })
  const { data: emailCounts } = useEmailReplyCounts(contactIdParam)
  const { data: filteredContact } = useContact(contactIdParam)
  const smsMessagesQuery = useSMSMessages(smsTab)
  const { data: smsCounts } = useSMSMessageCounts()

  // Every email filter is applied in the database now (migration 210). It used
  // to be applied here, to the pages already loaded, so the Matched tab read 30
  // while its chips read "All 20" and filtering by Positive only searched those
  // 20 rows (QA-33 bug 1).
  const emailReplies = useMemo(
    () => emailRepliesQuery.data?.pages?.flat() || [],
    [emailRepliesQuery.data],
  )
  const { data: emailIntentCounts = { all: 0, positive: 0, question: 0, negative: 0, neutral: 0, unknown: 0 } } =
    useEmailReplyIntentCounts(emailTab, emailFiltersWithoutIntent)
  const { data: emailFilterOptions } = useEmailReplyFilterOptions(emailTab, contactIdParam)
  const campaignOptions = emailFilterOptions?.campaigns ?? []
  const pipelineOptions = emailFilterOptions?.pipelines ?? []

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

  // QA-31 bug 5: a wrong match could not be corrected or undone.
  const handleUnmatchEmail = async () => {
    const reply = emailToUnmatch
    if (!reply) return
    setEmailToUnmatch(null)
    try {
      await unmatchEmailReply.mutateAsync({ replyId: reply.id })
      toast({
        title: 'Reply unmatched',
        description: 'It is back on the Unmatched tab and can be matched again.',
      })
    } catch (error) {
      toast({
        title: 'Could not unmatch the reply',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
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
          {/* Email + SMS stat cards — tightened from p-5 / gap-6 with
              a vertical divider to p-3.5 / gap-5, dropped the divider
              and shrank the metric font sizes. The "extra space"
              feedback was the cards visually feeling like billboard
              hero panels; now they're the size of a normal stat row. */}
          <button
            onClick={() => setActiveTab('email')}
            className={cn(
              'rounded-xl border px-4 py-3 text-left transition-all',
              activeTab === 'email'
                ? 'border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900/50'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('p-1.5 rounded-md', activeTab === 'email' ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-slate-100 dark:bg-slate-800')}>
                  <Inbox className={cn('h-3.5 w-3.5', activeTab === 'email' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500')} />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Email Replies</h3>
              </div>
              {emailCounts && emailCounts.unmatched > 0 && (
                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                  {emailCounts.unmatched} Unmatched
                </span>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-5">
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{emailCounts?.today || 0}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Received Today</p>
              </div>
              <div>
                <p className="text-base font-semibold text-green-600 dark:text-green-400 leading-tight">{emailCounts?.positive || 0}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Positive Intent</p>
              </div>
              <div>
                <p className="text-base font-semibold text-red-500 dark:text-red-400 leading-tight">{emailCounts?.negative || 0}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Negative Intent</p>
              </div>
            </div>
          </button>

          {/* SMS Tab Trigger — same compact layout */}
          <button
            onClick={() => setActiveTab('sms')}
            className={cn(
              'rounded-xl border px-4 py-3 text-left transition-all',
              activeTab === 'sms'
                ? 'border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-purple-100 dark:ring-purple-900/50'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('p-1.5 rounded-md', activeTab === 'sms' ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-slate-100 dark:bg-slate-800')}>
                  <MessagesSquare className={cn('h-3.5 w-3.5', activeTab === 'sms' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500')} />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">SMS Replies</h3>
              </div>
              {smsCounts && smsCounts.unmatched > 0 && (
                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                  {smsCounts.unmatched} Unmatched
                </span>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-5">
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{smsCounts?.today || 0}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Received Today</p>
              </div>
              <div>
                <p className="text-base font-semibold text-green-600 dark:text-green-400 leading-tight">{smsCounts?.positive || 0}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Positive Intent</p>
              </div>
              <div>
                <p className="text-base font-semibold text-red-500 dark:text-red-400 leading-tight">{smsCounts?.negative || 0}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Negative Intent</p>
              </div>
            </div>
          </button>
        </div>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-6 mt-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <EmailReplyTabs activeTab={emailTab} onTabChange={setEmailTab} counts={emailCounts || { all: 0, unmatched: 0, matched: 0, spam: 0 }} />
            {emailTab === 'unmatched' && emailReplies.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
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
              <div className="flex flex-wrap items-center gap-2">
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
                {emailTab === 'matched' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const ids = Array.from(selectedEmailIds)
                      if (ids.length === 0) return
                      markEmailRead.mutate(ids, {
                        onSuccess: () => setSelectedEmailIds(new Set()),
                      })
                    }}
                    disabled={selectedEmailIds.size === 0 || markEmailRead.isPending}
                    className="shrink-0"
                  >
                    {markEmailRead.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Mark as read{selectedEmailIds.size > 0 ? ` (${selectedEmailIds.size})` : ''}
                  </Button>
                )}
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

          {/* Search. The inbox had no way to find a player at all: a recruiter
              looking for one reply had to page through the list by eye. */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
              placeholder="Search name, email or message…"
              aria-label="Search replies"
              className="h-9 pl-9 pr-9"
            />
            {emailSearch && (
              <button
                type="button"
                onClick={() => setEmailSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
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
            onChangeContact={handleMatchEmail}
            onUnmatch={setEmailToUnmatch}
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
              <div className="flex flex-wrap items-center gap-2">
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
              <div className="flex flex-wrap items-center gap-2">
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
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ids = Array.from(selectedSMSIds)
                    if (ids.length === 0) return
                    markSMSRead.mutate(ids, {
                      onSuccess: () => setSelectedSMSIds(new Set()),
                    })
                  }}
                  disabled={selectedSMSIds.size === 0 || markSMSRead.isPending}
                  className="shrink-0"
                >
                  {markSMSRead.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Mark as read{selectedSMSIds.size > 0 ? ` (${selectedSMSIds.size})` : ''}
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

      {/* QA-31 bug 5: unmatching detaches a reply from a player, so confirm
          it and say plainly what is and is not reversed. */}
      <AlertDialog
        open={!!emailToUnmatch}
        onOpenChange={(open) => !open && setEmailToUnmatch(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unmatch this reply?</AlertDialogTitle>
            <AlertDialogDescription>
              {emailToUnmatch?.contact
                ? `It will be detached from ${emailToUnmatch.contact.first_name ?? ''} ${
                    emailToUnmatch.contact.last_name ?? ''
                  }`.trim() + ' and returned to the Unmatched tab so you can match it again.'
                : 'It will be returned to the Unmatched tab so you can match it again.'}{' '}
              Anything the match already did — a stopped sequence, or a card moved
              to Contact Response — stays as it is. Move the card back yourself if
              it should not have moved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnmatchEmail}>Unmatch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
