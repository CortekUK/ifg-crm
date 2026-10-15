'use client'

import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Link2, Loader2, Mail } from 'lucide-react'
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

/** Tag colours. Plain text on a tinted pill — the mockups' vocabulary. */
const TAG_TONE: Record<string, string> = {
  Player: 'bg-blue-500/15 text-blue-300',
  Parent: 'bg-indigo-500/15 text-indigo-300',
  'Secondary email': 'bg-amber-500/15 text-amber-300',
  Internal: 'bg-slate-500/20 text-slate-300',
  External: 'bg-teal-500/15 text-teal-300',
  Unmatched: 'bg-amber-500/15 text-amber-300',
  Positive: 'bg-green-500/15 text-green-300',
  Question: 'bg-violet-500/15 text-violet-300',
  Negative: 'bg-red-500/15 text-red-300',
  Neutral: 'bg-slate-500/20 text-slate-300',
}

function Tag({ children }: { children: string }) {
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap', TAG_TONE[children] ?? 'bg-slate-500/20 text-slate-300')}>
      {children}
    </span>
  )
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
        const intentTag = thread.latest_intent
          ? thread.latest_intent[0].toUpperCase() + thread.latest_intent.slice(1)
          : null
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
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', unread ? 'bg-blue-400' : 'bg-transparent')} />

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
                {categoryTag && <Tag>{categoryTag}</Tag>}
                {intentTag && TAG_TONE[intentTag] && <Tag>{intentTag}</Tag>}
                {showMailboxOwner && thread.mailbox_owner_name && (
                  <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[11px] text-slate-400 whitespace-nowrap">
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
