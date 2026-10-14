'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ComposeDealPrompt } from './ComposeDealPrompt'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  CornerUpLeft,
  Loader2,
  Mail,
  MailOpen,
  Briefcase,
  Search,
  Send,
  User as UserIcon,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { toast } from '@/lib/hooks/use-toast'
import {
  useOutlookThreads,
  useThreadMessages,
  useReplyToThread,
  type EmailThread,
} from '@/lib/hooks/useOutlook'

const PAGE_SIZE = 50

// Same vocabulary as the Replies list, so a reply does not look like one thing
// on one screen and another elsewhere.
const INTENT_STYLES: Record<string, string> = {
  positive: 'bg-green-600 text-white',
  question: 'bg-blue-600 text-white',
  negative: 'bg-red-600 text-white',
  unsubscribe: 'bg-amber-600 text-white',
  neutral: 'bg-slate-500 text-white',
}

interface OutlookMailboxProps {
  isAdmin: boolean
  /** Needed to own any deal created from a thread. */
  userId: string
  /** Matched = the thread is with a CRM contact; unmatched = it is not. */
  filter: 'all' | 'matched' | 'unmatched'
}

/**
 * The mailbox: a list of CONVERSATIONS on the left, the selected thread on the
 * right — the shape anyone who has used an email client already knows.
 *
 * The list is paged with .range() rather than loaded whole. An unbounded
 * PostgREST select silently stops at 1,000 rows with no error, which is the
 * trap that has already cost this project exports, tag filtering and reports.
 */
export function OutlookMailbox({ isAdmin, filter, userId }: OutlookMailboxProps) {
  const [scope, setScope] = useState<'mine' | 'everyone'>('mine')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<EmailThread | null>(null)

  const { data, isLoading } = useOutlookThreads({ scope, filter, search, page })
  const threads = data?.threads ?? []
  const total = data?.total ?? 0
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-4">
      {/* ── Conversation list ─────────────────────────────────────────── */}
      <div className="border rounded-lg overflow-hidden flex flex-col min-h-[32rem]">
        <div className="p-3 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search mail"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
            />
          </div>

          {/* Only a super admin has anything to switch between — a recruiter
              can only ever see their own mailbox, so the toggle would be a
              control that does nothing. */}
          {isAdmin && (
            <div className="flex gap-1">
              {(['mine', 'everyone'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => {
                    setScope(value)
                    setPage(0)
                    setSelected(null)
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors',
                    scope === value
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No conversations here yet.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {threads.map((thread) => {
                const isActive = selected?.id === thread.id
                const unread = thread.unread_count > 0
                return (
                  <li key={thread.id}>
                    <button
                      onClick={() => setSelected(thread)}
                      className={cn(
                        'w-full text-left p-3 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60',
                        isActive && 'bg-blue-50 dark:bg-blue-900/20',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            'text-sm truncate',
                            unread ? 'font-semibold' : 'font-medium',
                          )}
                        >
                          {thread.counterparty_name || thread.counterparty_email || 'Unknown'}
                        </span>
                        {thread.last_message_at && (
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {formatDate(thread.last_message_at)}
                          </span>
                        )}
                      </div>
                      <p className={cn('text-sm truncate', unread && 'font-medium')}>
                        {thread.subject || '(no subject)'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {thread.last_message_preview}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {unread && (
                          <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">
                            {thread.unread_count} new
                          </Badge>
                        )}
                        {thread.is_crm_related ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            <UserIcon className="h-2.5 w-2.5 mr-1" />
                            Matched
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Unmatched
                          </Badge>
                        )}
                        {thread.message_count > 1 && (
                          <span className="text-[10px] text-muted-foreground">
                            {thread.message_count} messages
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between p-2 border-t text-xs">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-muted-foreground">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Thread ────────────────────────────────────────────────────── */}
      <ThreadPane thread={selected} userId={userId} />
    </div>
  )
}

function ThreadPane({ thread, userId }: { thread: EmailThread | null; userId: string }) {
  const { data: messages = [], isLoading } = useThreadMessages(thread?.conversation_id ?? null)
  const [replyBody, setReplyBody] = useState('')
  const [dealOpen, setDealOpen] = useState(false)
  const sendReply = useReplyToThread()

  if (!thread) {
    return (
      <div className="border rounded-lg flex items-center justify-center min-h-[32rem] text-sm text-muted-foreground">
        <div className="text-center">
          <MailOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Select a conversation to read it.</p>
        </div>
      </div>
    )
  }

  // Replying needs the Graph id of a message we received. An outbound-only
  // thread, or one synced before this feature, has nothing to reply TO.
  const latestInbound = [...messages].reverse().find((m) => m.direction === 'inbound' && m.graphMessageId)

  const handleReply = async () => {
    if (!latestInbound || !replyBody.trim()) return
    try {
      await sendReply.mutateAsync({ replyId: latestInbound.id, body: replyBody })
      setReplyBody('')
      toast({ title: 'Reply sent' })
    } catch (error) {
      toast({
        title: 'Could not send the reply',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  // The newest intent the classifier produced for this conversation — the
  // same signal the Replies screen shows. The spec asks for the mailbox to
  // keep what was already there rather than becoming a plainer inbox.
  const latestIntent = [...messages].reverse().find((m) => m.intent)?.intent ?? null

  return (
    <div className="border rounded-lg flex flex-col min-h-[32rem]">
      <div className="p-4 border-b space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{thread.subject || '(no subject)'}</h3>
            <p className="text-sm text-muted-foreground truncate">
              {thread.counterparty_name
                ? `${thread.counterparty_name} · ${thread.counterparty_email}`
                : thread.counterparty_email}
            </p>
          </div>
          {latestIntent && INTENT_STYLES[latestIntent] && (
            <Badge className={cn('shrink-0 capitalize', INTENT_STYLES[latestIntent])}>
              {latestIntent}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {thread.contact_id ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/contacts?contactId=${thread.contact_id}`}>View contact</Link>
            </Button>
          ) : (
            <Badge variant="outline" className="text-[11px]">
              Not matched to a contact
            </Badge>
          )}

          {/* A conversation with somebody who has no deal is the exact moment
              a recruiter wants to open one — the spec's Smart Deal step, on
              the screen where the decision is actually made. */}
          {thread.contact_id && !thread.deal_id && (
            <Button variant="outline" size="sm" onClick={() => setDealOpen(true)}>
              <Briefcase className="h-3.5 w-3.5 mr-1.5" />
              Create deal
            </Button>
          )}
          {thread.deal_id && (
            <Badge variant="secondary" className="text-[11px]">
              <Briefcase className="h-3 w-3 mr-1" />
              In a pipeline
            </Badge>
          )}
        </div>
      </div>

      {dealOpen && thread.contact_id && (
        <ComposeDealPrompt
          contactId={thread.contact_id}
          contactName={thread.counterparty_name || thread.counterparty_email || 'this contact'}
          userId={userId}
          onDone={() => setDealOpen(false)}
        />
      )}

      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Oldest to newest, the way a conversation reads. */}
            {messages.map((message) => (
              <div
                key={`${message.direction}-${message.id}`}
                className={cn(
                  'rounded-lg border p-3',
                  message.direction === 'outbound'
                    ? 'bg-blue-50/60 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900'
                    : 'bg-gray-50 dark:bg-slate-900/40',
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-medium">
                    {message.direction === 'outbound'
                      ? 'You'
                      : message.name || message.address || 'Them'}
                  </span>
                  {message.at && (
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(message.at)}
                    </span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.body || '(no content)'}
                </p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-3 space-y-2">
        {latestInbound ? (
          <>
            <Textarea
              rows={3}
              placeholder="Write a reply…"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleReply}
                disabled={!replyBody.trim() || sendReply.isPending}
              >
                {sendReply.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CornerUpLeft className="h-4 w-4 mr-2" />
                )}
                Reply
              </Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Send className="h-3 w-3" />
            Replies can only be sent on a conversation that arrived through your connected mailbox.
          </p>
        )}
      </div>
    </div>
  )
}
