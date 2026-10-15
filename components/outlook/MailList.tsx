'use client'

import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { CornerDownLeft, Link2, Loader2, Mail } from 'lucide-react'
import { senderLabel } from '@/lib/outlook/classify-sender'
import type { MailThread } from '@/lib/hooks/useMailbox'

interface MailListProps {
  threads: MailThread[]
  isLoading: boolean
  showMailboxOwner: boolean
  showConnect: boolean
  onOpen: (thread: MailThread) => void
  onConnect?: (thread: MailThread) => void
  emptyTitle: string
  emptyHint: string
  /** How many conversations the folder holds, against how many are loaded. */
  total: number
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

/**
 * How a row is tagged.
 *
 * Rows used to carry up to four pills — category, intent, mailbox owner, plus
 * the time — in a palette of six colours, which is how a list stops being
 * scannable. At most ONE pill now survives, and only when it means a job:
 * "Not linked". Everything else moved to quieter signals.
 */

/**
 * Intent, as a dot rather than a word.
 *
 * The classifier's answer is a hint, not a headline. A coloured dot before
 * the sender reads at a glance and costs no horizontal room; the word is in
 * the title attribute for anyone who wants it.
 */
const INTENT_DOT: Record<string, { tone: string; label: string }> = {
  positive: { tone: 'bg-green-400', label: 'Positive reply' },
  question: { tone: 'bg-violet-400', label: 'They asked something' },
  negative: { tone: 'bg-red-400', label: 'Negative reply' },
}

/**
 * "me, Westin, Sarah 4" — who is on the conversation, the way Gmail writes it.
 * The count only appears on a real thread, because "1" next to a single
 * message is noise.
 */
function participantLine(thread: MailThread): { text: string; count: number | null } {
  const names = (thread.participants ?? [])
    .map((p) => (p.name ? p.name.split(' ')[0] : p.email?.split('@')[0]))
    .filter(Boolean) as string[]

  const unique = [...new Set(names)]
  const hasOutbound = thread.last_message_direction === 'outbound' || thread.message_count > 1
  const parts = hasOutbound ? ['me', ...unique] : unique.length ? unique : [thread.counterparty_name || thread.counterparty_email || 'Unknown']

  return {
    text: parts.slice(0, 3).join(', '),
    count: thread.message_count > 1 ? thread.message_count : null,
  }
}

function timeLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const days = (now.getTime() - d.getTime()) / 86_400_000
  if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function MailList({
  threads, isLoading, showMailboxOwner, showConnect, onOpen, onConnect, emptyTitle, emptyHint,
  total, hasMore, loadingMore, onLoadMore,
}: MailListProps) {
  if (isLoading) {
    return (
      <div className="space-y-px">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse bg-slate-900/40" />
        ))}
      </div>
    )
  }

  if (!threads.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Mail className="mb-3 h-8 w-8 text-slate-700" />
        <p className="font-medium text-slate-300">{emptyTitle}</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">{emptyHint}</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-slate-800/60">
      {threads.map((thread) => {
        const unread = thread.unread_count > 0
        const { text, count } = participantLine(thread)
        const categoryTag = senderLabel(thread.category)
        const intent = thread.latest_intent ? INTENT_DOT[thread.latest_intent] : null
        // A thread whose newest message came in is one you owe an answer.
        const awaitingReply = thread.last_message_direction === 'inbound'
        const initials =
          (thread.counterparty_name || thread.counterparty_email || '?')
            .split(/[\s@.]/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'

        return (
          <li key={thread.id}>
            {/* The whole row opens the conversation — Gmail's behaviour, and
                the reason there is no separate "open" affordance. */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpen(thread)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(thread) } }}
              className={cn(
                'flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors',
                unread ? 'bg-slate-900/50 hover:bg-slate-800/60' : 'hover:bg-slate-900/40',
              )}
            >
              {/* One dot, two jobs: unread is blue, and the classifier's
                  read on the message tints it instead when there is one.
                  Previously that was a second coloured pill competing with
                  the category pill for the same glance. */}
              <span
                title={intent ? intent.label : unread ? 'Unread' : ''}
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  intent ? intent.tone : unread ? 'bg-blue-400' : 'bg-transparent',
                )}
              />

              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-slate-700 text-[10px] text-slate-200">{initials}</AvatarFallback>
              </Avatar>

              <div className="flex w-44 shrink-0 items-center gap-1.5 truncate">
                <span className={cn('truncate text-sm', unread ? 'font-semibold text-white' : 'text-slate-300')}>
                  {text}
                </span>
                {count && <span className="text-xs text-slate-500">{count}</span>}
              </div>

              {/* Subject then preview on one line, Gmail-style: the subject
                  carries the weight, the message trails off in muted grey. */}
              <div className="min-w-0 flex-1 truncate">
                <span className={cn('text-sm', unread ? 'font-semibold text-white' : 'text-slate-200')}>
                  {thread.subject || '(no subject)'}
                </span>
                {thread.last_message_preview && (
                  <span className="text-sm text-slate-500"> — {thread.last_message_preview}</span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {/* An arrow, not a pill: it says "they spoke last, you owe a
                    reply" in four pixels instead of a word. */}
                {awaitingReply && (
                  <CornerDownLeft
                    className="h-3.5 w-3.5 text-slate-500"
                    aria-label="Waiting on your reply"
                  />
                )}
                {categoryTag && (
                  <span className="whitespace-nowrap rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-300">
                    {categoryTag}
                  </span>
                )}
                {/* Only while more than one mailbox is actually in view —
                    the same name repeated down every row of your own mailbox
                    was pure noise. */}
                {showMailboxOwner && thread.mailbox_owner_name && (
                  <span className="whitespace-nowrap text-[11px] text-slate-500">
                    {thread.mailbox_owner_name}
                  </span>
                )}
                {showConnect && onConnect && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 border-amber-500/40 px-2 text-[11px] text-amber-300 hover:bg-amber-500/10"
                    onClick={(e) => { e.stopPropagation(); onConnect(thread) }}
                  >
                    <Link2 className="mr-1 h-3 w-3" />
                    Connect
                  </Button>
                )}
                <span className={cn('w-14 text-right text-[11px]', unread ? 'font-medium text-blue-300' : 'text-slate-500')}>
                  {timeLabel(thread.last_message_at)}
                </span>
              </div>
            </div>
          </li>
        )
      })}

      {/* The count in the header is the folder's real total, so without this
          the list silently stopped at 50 under a header saying 300. */}
      {hasMore && (
        <li className="flex items-center justify-center gap-3 px-4 py-4 text-sm">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Load more
          </Button>
          <span className="text-xs text-slate-500">
            {threads.length} of {total}
          </span>
        </li>
      )}
    </ul>
  )
}
