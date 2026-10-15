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
  useMailThreads, useFolderCounts, useMailboxOwners,
  type MailThread, type MailboxScope,
} from '@/lib/hooks/useMailbox'
import { AUDIENCE_FIXED, type MailAudience, type MailFolder } from '@/lib/outlook/classify-sender'
import { OutlookBanner } from '@/components/outlook/OutlookBanner'
import { useOutlookStatus } from '@/lib/hooks/useOutlook'
import { toast } from '@/lib/hooks/use-toast'
import { MailRail } from '@/components/outlook/MailRail'
import { MailList } from '@/components/outlook/MailList'
import { MailboxSelector } from '@/components/outlook/MailboxSelector'
import { ConversationView } from '@/components/outlook/ConversationView'
import { ConnectDialog, type ConnectResult } from '@/components/outlook/ConnectDialog'
import { usePrefetchSuggestions } from '@/lib/hooks/useSuggestions'
import { ComposeWindow } from '@/components/outlook/ComposeWindow'
import { ComposeDealPrompt } from '@/components/outlook/ComposeDealPrompt'

/**
 * The intent filters, each carrying the colour its rows are tagged with, so
 * the chip you press and the label you then see are the same colour. They were
 * all the same blue, which made the filter and the rows look unrelated.
 */
const INTENTS: { id: string; label: string; on: string }[] = [
  { id: 'all', label: 'All intents', on: 'bg-blue-600 text-white' },
  { id: 'positive', label: 'Positive', on: 'bg-green-500/25 text-green-200 ring-1 ring-green-500/40' },
  { id: 'question', label: 'Question', on: 'bg-violet-500/25 text-violet-200 ring-1 ring-violet-500/40' },
  { id: 'negative', label: 'Negative', on: 'bg-red-500/25 text-red-200 ring-1 ring-red-500/40' },
  { id: 'neutral', label: 'Neutral', on: 'bg-slate-500/30 text-slate-200 ring-1 ring-slate-400/40' },
]

/** Who the conversation is with. CRM contacts by default — see MailAudience. */
const AUDIENCES: { id: MailAudience; label: string; hint: string }[] = [
  { id: 'crm', label: 'Matched', hint: 'Players, parents and their other addresses' },
  { id: 'unmatched', label: 'Mismatched', hint: 'Addresses not linked to a contact' },
  { id: 'all', label: 'Everything', hint: 'Both' },
]

const FOLDER_COPY: Record<MailFolder, { title: string; blurb: string; empty: string; hint: string }> = {
  inbox: {
    title: 'Inbox',
    blurb: 'Every email that reaches your Outlook, newest first.',
    empty: 'Nothing in the inbox yet.',
    hint: 'Once a mailbox is connected, every email that arrives in Outlook appears here automatically.',
  },
  waiting: {
    title: 'Replies',
    blurb: 'They wrote last and nobody has answered. Clear this and you owe nobody a reply.',
    empty: 'Nothing waiting for a reply.',
    hint: 'Every conversation has had an answer.',
  },
  unmatched: {
    title: 'Mismatched',
    blurb: "Addresses we couldn't match to a contact. Link each one so the history sits on the right player.",
    empty: 'Nothing to link.',
    hint: 'Every email received so far was matched to a contact automatically.',
  },
  matched: {
    title: 'Contacts',
    blurb: 'Conversations with players, parents and their other addresses.',
    empty: 'No conversations with contacts yet.',
    hint: 'Replies from people already in the CRM appear here.',
  },
  sent: {
    title: 'Sent',
    blurb: 'Messages sent from the CRM, which also appear in your Outlook Sent Items.',
    empty: 'Nothing sent yet.',
    hint: 'Use Compose to write to a contact.',
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
  // CRM contacts by default: the Inbox is for conversations with people, not
  // for GoDaddy security alerts sitting between a parent and a player.
  const [audience, setAudience] = useState<MailAudience>('crm')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [openThread, setOpenThread] = useState<MailThread | null>(null)
  const [connectThread, setConnectThread] = useState<MailThread | null>(null)
  const [dealContact, setDealContact] = useState<{ id: string; name: string; pipelineId?: string } | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? '')
      setUserEmail(data.user?.email ?? '')
    })
  }, [])

  // The address mail actually goes out from. NOT the CRM login: Compose
  // showed superadmin@theinternationalfootballgroup.com while every message
  // left from the connected mailbox, so the window named a sender it had
  // never sent from.
  const { data: outlook } = useOutlookStatus()
  const mailboxEmail = outlook?.connected ? outlook.mailboxEmail ?? '' : ''

  const { data: owners = [] } = useMailboxOwners(!!isAdmin)
  const recruiterIds = useMemo(() => owners.filter((o) => o.role === 'recruiter').map((o) => o.id), [owners])

  const threadsQuery = useMailThreads({ folder, scope, myUserId: userId, recruiterIds, intent, search: debouncedSearch, audience })
  const { data: counts = {} } = useFolderCounts({ scope, myUserId: userId, recruiterIds, audience })

  const threads = useMemo(
    () => threadsQuery.data?.pages.flatMap((p) => p.threads) ?? [],
    [threadsQuery.data],
  )
  const total = threadsQuery.data?.pages[0]?.total ?? 0

  // Whose mailbox a row belongs to is only worth saying when more than one is
  // actually on screen. "All mailboxes" with a single connected account was
  // stamping the same name down every row.
  const ownersInView = useMemo(
    () => new Set(threads.map((t) => t.mailbox_user_id).filter(Boolean)).size,
    [threads],
  )

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

    // Linking a stranger to a contact is the moment they become a lead. If
    // they are not in a pipeline yet, that is the next thing anyone does —
    // and until now nothing offered it, so the step was simply forgotten.
    if (result.contactId && !result.hasDeal && result.category !== 'external') {
      setDealContact({
        id: result.contactId,
        name: result.contactName || result.email,
      })
    }

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

      <OutlookBanner tone="dark" />

      <div className="flex min-h-0 flex-1">
        <MailRail
          folder={folder}
          onFolderChange={(f) => { setFolder(f); setOpenThread(null) }}
          counts={counts}
          onCompose={() => {
            // Without a mailbox there is nothing to send from, and the send
            // would fail after the message was written. Say so first.
            if (!mailboxEmail) {
              toast({
                title: 'No mailbox connected',
                description: 'Connect Outlook in Settings before sending from the CRM.',
                variant: 'destructive',
              })
              return
            }
            setComposeOpen(true)
          }}
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
              currentUserEmail={mailboxEmail}
              currentUserId={userId}
            />
          ) : (
            <div className="flex h-full flex-col">
              <div className="shrink-0 px-5 pb-3 pt-4">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-lg font-semibold text-white">{copy.title}</h1>
                  {/* Both numbers, in words. The rail badge and this used to
                      be a bare 30 and a bare 33 for the same folder, with
                      nothing saying one was unread and the other the total. */}
                  <span className="text-sm text-slate-500">
                    {total} conversation{total === 1 ? '' : 's'}
                    {(counts[folder]?.unread ?? 0) > 0 && (
                      <span className="text-blue-300"> · {counts[folder]?.unread} unread</span>
                    )}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{copy.blurb}</p>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {/* Hidden where the folder already answers it — filtering
                      Contacts down to "outside the CRM" is always empty. */}
                  {!AUDIENCE_FIXED[folder] && (
                    <>
                      <div className="flex rounded-full border border-slate-700 p-0.5">
                        {AUDIENCES.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setAudience(a.id)}
                            title={a.hint}
                            className={cn(
                              'rounded-full px-3 py-1 text-xs transition-colors',
                              audience === a.id
                                ? 'bg-slate-700 font-medium text-white'
                                : 'text-slate-400 hover:text-slate-200',
                            )}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                      <span className="mx-1 h-5 w-px bg-slate-800" />
                    </>
                  )}

                  {INTENTS.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => setIntent(i.id)}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs transition-colors',
                        intent === i.id
                          ? `font-medium ${i.on}`
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
                  showMailboxOwner={!!isAdmin && scope !== 'mine' && ownersInView > 1}
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

      {composeOpen && mailboxEmail && (
        <ComposeWindow
          fromEmail={mailboxEmail}
          onClose={() => setComposeOpen(false)}
          onDealOpportunity={setDealContact}
        />
      )}

      {dealContact && userId && (
        <ComposeDealPrompt
          contactId={dealContact.id}
          contactName={dealContact.name}
          initialPipelineId={dealContact.pipelineId}
          userId={userId}
          onDone={() => setDealContact(null)}
        />
      )}
    </div>
  )
}
