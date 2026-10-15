'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import {
  useMailThreads, useFolderCounts, useTodaySummary, useMailboxOwners,
  type MailThread, type MailboxScope,
} from '@/lib/hooks/useMailbox'
import type { MailFolder } from '@/lib/outlook/classify-sender'
import { OutlookBanner } from '@/components/outlook/OutlookBanner'
import { MailRail } from '@/components/outlook/MailRail'
import { MailList } from '@/components/outlook/MailList'
import { MailboxSelector } from '@/components/outlook/MailboxSelector'
import { ConversationView } from '@/components/outlook/ConversationView'
import { ConnectDialog, type ConnectResult } from '@/components/outlook/ConnectDialog'
import { usePrefetchSuggestions } from '@/lib/hooks/useSuggestions'
import { ComposeWindow } from '@/components/outlook/ComposeWindow'
import { ComposeDealPrompt } from '@/components/outlook/ComposeDealPrompt'

const INTENTS = [
  { id: 'all', label: 'All intents' },
  { id: 'positive', label: 'Positive' },
  { id: 'question', label: 'Question' },
  { id: 'negative', label: 'Negative' },
  { id: 'neutral', label: 'Neutral' },
]

const FOLDER_COPY: Record<MailFolder, { title: string; blurb: string; empty: string; hint: string }> = {
  inbox: {
    title: 'Inbox',
    blurb: 'Everything that lands in Outlook — player replies, internal mail and external bookings.',
    empty: 'Nothing in the inbox yet.',
    hint: 'Once a mailbox is connected, every email that arrives in Outlook appears here automatically.',
  },
  unmatched: {
    title: 'Unmatched',
    blurb: "Emails from addresses we couldn't link to a contact. Connect each one so the history sits on the right player.",
    empty: 'Nothing to connect.',
    hint: 'Every email received so far was matched to a contact automatically.',
  },
  matched: {
    title: 'Matched',
    blurb: 'Conversations linked to a player or a parent.',
    empty: 'No matched conversations yet.',
    hint: 'Replies from people already in the CRM appear here.',
  },
  sent: {
    title: 'Sent',
    blurb: 'Messages sent from the CRM, which also appear in your Outlook Sent Items.',
    empty: 'Nothing sent yet.',
    hint: 'Use Compose to write to a contact.',
  },
  internal: {
    title: 'Internal',
    blurb: 'Mail between IFG staff.',
    empty: 'No internal mail.',
    hint: 'Messages from colleagues on a connected mailbox appear here.',
  },
  external: {
    title: 'External',
    blurb: 'Suppliers, bookings and other non-contact senders.',
    empty: 'No external mail.',
    hint: 'Booking confirmations and supplier emails land here.',
  },
}

export default function OutlookPage() {
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [folder, setFolder] = useState<MailFolder>('inbox')
  // A recruiter can only ever look at their own mailbox, so the scope is
  // derived rather than stored. Holding it in state and syncing it from an
  // effect meant the first render used 'all', fired a query that returns
  // nothing for them, and made an empty list look like a fault.
  const [adminScope, setAdminScope] = useState<MailboxScope>('all')
  const scope: MailboxScope = isAdmin ? adminScope : 'mine'
  const setScope = setAdminScope
  const [intent, setIntent] = useState('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [openThread, setOpenThread] = useState<MailThread | null>(null)
  const [connectThread, setConnectThread] = useState<MailThread | null>(null)
  const [dealContact, setDealContact] = useState<{ id: string; name: string } | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? '')
      setUserEmail(data.user?.email ?? '')
    })
  }, [])

  const { data: owners = [] } = useMailboxOwners(!!isAdmin)
  const recruiterIds = useMemo(() => owners.filter((o) => o.role === 'recruiter').map((o) => o.id), [owners])

  const threadsQuery = useMailThreads({ folder, scope, myUserId: userId, recruiterIds, intent, search: debouncedSearch })
  const { data: counts = {} } = useFolderCounts({ scope, myUserId: userId, recruiterIds })
  const { data: today = { received: 0, positive: 0, negative: 0 } } = useTodaySummary({ scope, myUserId: userId, recruiterIds })

  const threads = useMemo(
    () => threadsQuery.data?.pages.flatMap((p) => p.threads) ?? [],
    [threadsQuery.data],
  )
  const total = threadsQuery.data?.pages[0]?.total ?? 0

  /**
   * An email has been connected (or filed as external).
   *
   * Refetching the list alone was not enough: the open conversation is held in
   * component state, so after connecting it still showed "Unmatched sender"
   * and a Connect button until the page was reloaded. The rail counts were
   * stale for the same reason.
   *
   * So the open thread is updated in place first — the banner flips
   * immediately — and then every query that depends on it is invalidated.
   */
  const handleConnected = useCallback((result: ConnectResult) => {
    setConnectThread(null)

    setOpenThread((current) => {
      if (!current || current.counterparty_email?.toLowerCase() !== result.email.toLowerCase()) return current
      return {
        ...current,
        category: result.category,
        contact_id: result.contactId,
        is_crm_related: result.category !== 'external',
      }
    })

    for (const key of [
      'mail-threads',          // the list this row sits in
      'mail-folder-counts',    // Unmatched drops by one, Matched gains one
      'mail-thread-contact',   // the banner's contact details
      'mail-thread-messages',  // sender tags on each message
      'contact-suggestions',   // this address is no longer a question
      'email-replies',         // the old Replies screen counts the same rows
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }, [queryClient])

  // Rank the unmatched senders while the list is being read, so pressing
  // Connect opens a dialog that already has its answer instead of a spinner.
  // Only for Unmatched: it is the only folder where Connect is the next thing
  // anyone does, and prefetching the others would be work nobody asked for.
  const prefetchSuggestions = usePrefetchSuggestions()
  useEffect(() => {
    if (folder === 'unmatched' && threads.length) prefetchSuggestions(threads)
  }, [folder, threads, prefetchSuggestions])

  // Also warm it for a single unmatched conversation opened from anywhere
  // else — Inbox, or a search result. Without this the list prefetch only
  // helped people who happened to arrive via the Unmatched folder, and
  // everyone else still waited on a spinner.
  useEffect(() => {
    if (openThread?.category === 'unknown') prefetchSuggestions([openThread])
  }, [openThread, prefetchSuggestions])
  const openIndex = openThread ? threads.findIndex((t) => t.id === openThread.id) : -1
  const copy = FOLDER_COPY[folder]

  return (
    <div className="flex h-full flex-col">
      {/* ── top bar ───────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center gap-4 border-b border-slate-800 px-4 py-2.5">
        <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1.5 text-slate-300">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            CRM
          </Link>
        </Button>
        <span className="shrink-0 text-lg font-bold tracking-wide text-white">OUTLOOK</span>

        {/* One search box. The CRM's global search is deliberately absent:
            two search fields on one screen means half the time people search
            the wrong one and conclude the mail is missing. */}
        <div className="relative mx-auto w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mail — name, email, subject or message"
            className="h-9 border-slate-800 bg-slate-900/60 pl-9 text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <MailboxSelector isAdmin={!!isAdmin} scope={scope} onChange={setScope} owners={owners} />

        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-blue-600 text-xs text-white">
            {(currentUser?.full_name ?? userEmail ?? '?').split(/[\s@.]/).filter(Boolean).slice(0, 2)
              .map((w: string) => w[0]?.toUpperCase()).join('')}
          </AvatarFallback>
        </Avatar>
      </header>

      <OutlookBanner />

      <div className="flex min-h-0 flex-1">
        <MailRail
          folder={folder}
          onFolderChange={(f) => { setFolder(f); setOpenThread(null) }}
          counts={counts}
          today={today}
          onCompose={() => setComposeOpen(true)}
        />

        <main className="m-3 ml-0 min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/20">
          {openThread ? (
            <ConversationView
              thread={openThread}
              index={openIndex < 0 ? 0 : openIndex}
              total={threads.length}
              onBack={() => setOpenThread(null)}
              onPrev={() => openIndex > 0 && setOpenThread(threads[openIndex - 1])}
              onNext={() => openIndex < threads.length - 1 && setOpenThread(threads[openIndex + 1])}
              onConnect={setConnectThread}
              onSmartDeal={(t) =>
                t.contact_id && setDealContact({ id: t.contact_id, name: t.counterparty_name || t.counterparty_email || 'this contact' })
              }
              currentUserEmail={userEmail}
              currentUserId={userId}
            />
          ) : (
            <div className="flex h-full flex-col">
              <div className="shrink-0 px-5 pb-3 pt-4">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-lg font-semibold text-white">{copy.title}</h1>
                  <span className="text-sm text-slate-500">{total}</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{copy.blurb}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {INTENTS.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => setIntent(i.id)}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs transition-colors',
                        intent === i.id
                          ? 'bg-blue-600 font-medium text-white'
                          : 'border border-slate-700 text-slate-400 hover:bg-slate-800',
                      )}
                    >
                      {i.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <MailList
                  threads={threads}
                  isLoading={threadsQuery.isLoading}
                  showMailboxOwner={isAdmin && scope !== 'mine'}
                  showConnect={folder === 'unmatched'}
                  onOpen={setOpenThread}
                  onConnect={setConnectThread}
                  emptyTitle={copy.empty}
                  emptyHint={copy.hint}
                  total={total}
                  hasMore={!!threadsQuery.hasNextPage}
                  loadingMore={threadsQuery.isFetchingNextPage}
                  onLoadMore={() => threadsQuery.fetchNextPage()}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {connectThread && (
        <ConnectDialog
          thread={connectThread}
          onClose={() => setConnectThread(null)}
          onConnected={handleConnected}
        />
      )}

      {composeOpen && userId && (
        <ComposeWindow fromEmail={userEmail} onClose={() => setComposeOpen(false)} />
      )}

      {dealContact && userId && (
        <ComposeDealPrompt
          contactId={dealContact.id}
          contactName={dealContact.name}
          userId={userId}
          onDone={() => setDealContact(null)}
        />
      )}
    </div>
  )
}
