'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft, Briefcase, ChevronDown, ChevronLeft, ChevronRight,
  CornerUpLeft, ExternalLink, Globe, Link2, Loader2, Reply, Send, Building2, AlertTriangle, UserCheck,
} from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'
import { useThreadMessages, useThreadContact, useSetThreadRead, type MailThread, type MailMessage } from '@/lib/hooks/useMailbox'
import { useReplyToThread } from '@/lib/hooks/useOutlook'
import type { SenderKind } from '@/lib/outlook/classify-sender'

interface ConversationViewProps {
  thread: MailThread
  index: number
  total: number
  onBack: () => void
  onPrev: () => void
  onNext: () => void
  onConnect: (thread: MailThread) => void
  onSmartDeal: (thread: MailThread) => void
  currentUserEmail: string
  /** Whose mailbox the reader is. An admin looking at a colleague's thread
   *  must not clear the bold on mail that colleague has not opened. */
  currentUserId: string
}

const SENDER_TAG: Record<SenderKind, { label: string; tone: string }> = {
  player:    { label: 'Player',          tone: 'bg-blue-500/15 text-blue-300' },
  parent:    { label: 'Parent',          tone: 'bg-indigo-500/15 text-indigo-300' },
  secondary: { label: 'Secondary email', tone: 'bg-amber-500/15 text-amber-300' },
  internal:  { label: 'IFG staff',       tone: 'bg-slate-500/20 text-slate-300' },
  external:  { label: 'External',        tone: 'bg-teal-500/15 text-teal-300' },
  unknown:   { label: 'Unknown sender',  tone: 'bg-amber-500/15 text-amber-300' },
}

function when(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60_000)
  const stamp = d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  if (mins < 60) return `${stamp} (${mins} min ago)`
  return stamp
}

/** One message. Collapsed messages are a single clickable line, as in Gmail. */
function Message({
  message, expanded, onToggle, currentUserEmail, senderLabel,
}: {
  message: MailMessage
  expanded: boolean
  onToggle: () => void
  /** The connected mailbox's address — what outbound mail is actually from. */
  currentUserEmail: string
  /** What to call the mailbox owner: "You", or their name to an admin. */
  senderLabel: string
}) {
  const [showDetails, setShowDetails] = useState(false)
  const isMe = message.direction === 'outbound' ||
    (!!currentUserEmail && (message.fromEmail ?? '').toLowerCase() === currentUserEmail.toLowerCase())
  const tag = isMe ? { label: senderLabel, tone: 'bg-slate-500/20 text-slate-300' } : SENDER_TAG[message.senderKind]
  const name = isMe ? senderLabel : message.fromName || message.fromEmail || 'Unknown'
  const initials = (name || '?').split(/[\s@.]/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')

  if (!expanded) {
    return (
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-2.5 text-left hover:bg-slate-900/60"
      >
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-slate-700 text-[10px] text-slate-200">{initials}</AvatarFallback>
        </Avatar>
        <span className="shrink-0 text-sm font-medium text-slate-200">{name}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-500">{message.body?.replace(/\s+/g, ' ').trim()}</span>
        <span className="shrink-0 text-[11px] text-slate-500">{when(message.at)}</span>
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-slate-700 text-[11px] text-slate-200">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-100">{name}</span>
              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', tag.tone)}>{tag.label}</span>
              {message.fromEmail && (
                <span className="text-sm text-slate-500">&lt;{message.fromEmail}&gt;</span>
              )}
            </div>
            {/* "to…" expands to the full envelope. Collapsed by default so the
                message itself stays the thing you read first. */}
            <button
              onClick={() => setShowDetails((v) => !v)}
              className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
            >
              to {message.toEmail ? message.toEmail.split('@')[0] : 'recipients'}
              <ChevronDown className={cn('h-3 w-3 transition-transform', showDetails && 'rotate-180')} />
            </button>
            {showDetails && (
              <dl className="mt-2 space-y-0.5 rounded-lg bg-slate-950/60 p-2.5 text-xs text-slate-400">
                <div><dt className="inline text-slate-500">from: </dt><dd className="inline">{message.fromEmail}</dd></div>
                <div><dt className="inline text-slate-500">to: </dt><dd className="inline">{message.toEmail ?? '—'}</dd></div>
                {message.cc.length > 0 && (
                  <div><dt className="inline text-slate-500">cc: </dt><dd className="inline">{message.cc.join(', ')}</dd></div>
                )}
                <div><dt className="inline text-slate-500">date: </dt><dd className="inline">{when(message.at)}</dd></div>
              </dl>
            )}
          </div>
        </div>
        <span className="shrink-0 text-[11px] text-slate-500">{when(message.at)}</span>
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
        {message.body || '(no content)'}
      </p>
    </div>
  )
}

export function ConversationView({
  thread, index, total, onBack, onPrev, onNext, onConnect, onSmartDeal, currentUserEmail, currentUserId,
}: ConversationViewProps) {
  const { data: messages = [], isLoading } = useThreadMessages(thread.conversation_id)
  const { data: contact } = useThreadContact(thread.contact_id)
  const setRead = useSetThreadRead()
  const sendReply = useReplyToThread()
  const isMyMailbox = !!currentUserId && thread.mailbox_user_id === currentUserId
  // "You" only when it is your mailbox. An admin reading a recruiter's thread
  // was shown the recruiter's own messages as if they had written them.
  const senderLabel = isMyMailbox ? 'You' : thread.mailbox_owner_name || 'Mailbox owner'

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showEarlier, setShowEarlier] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyAll, setReplyAll] = useState(false)
  const [replyBody, setReplyBody] = useState('')

  // Esc returns to the list — the shortcut anyone who uses mail expects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onBack() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  // Opening a conversation reads it. Once per conversation: the thread held in
  // page state keeps its old unread count after the list refetches, so without
  // the guard this would fire again on every render, and again the moment
  // somebody pressed Mark unread.
  const markedRead = useRef<string | null>(null)
  useEffect(() => {
    if (!isMyMailbox || thread.unread_count < 1) return
    if (markedRead.current === thread.id) return
    markedRead.current = thread.id
    setRead.mutate({ threadId: thread.id, read: true })
  }, [thread.id, thread.unread_count, isMyMailbox, setRead])

  // Only the newest message is open by default, the way Gmail does it.
  const lastId = messages.length ? messages[messages.length - 1].id : null
  const isExpanded = (m: MailMessage) => expandedIds.has(m.id) || m.id === lastId

  // Long threads fold everything but the last two behind a divider.
  const FOLD_AFTER = 3
  const earlier = messages.length > FOLD_AFTER && !showEarlier ? messages.slice(0, messages.length - 2) : []
  const visible = earlier.length ? messages.slice(messages.length - 2) : messages

  const latestInbound = [...messages].reverse().find((m) => m.direction === 'inbound' && m.graphMessageId)
  const otherPeople = new Set(messages.filter((m) => m.direction === 'inbound').map((m) => m.fromEmail))

  const handleReply = async () => {
    if (!latestInbound || !replyBody.trim()) return
    try {
      await sendReply.mutateAsync({ replyId: latestInbound.id, body: replyBody, replyAll })
      setReplyBody(''); setReplyOpen(false); setReplyAll(false)
      toast({ title: replyAll ? 'Reply sent to everyone on the thread' : 'Reply sent' })
    } catch (error) {
      toast({
        title: 'Could not send the reply',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to list" className="mt-0.5 h-7 w-7 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">{thread.subject || '(no subject)'}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {thread.mailbox_owner_name && (
                <span className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-400">
                  {thread.mailbox_owner_name}&apos;s mailbox
                </span>
              )}
              {thread.latest_intent && (
                <span className="rounded bg-green-500/15 px-1.5 py-0.5 capitalize text-green-300">{thread.latest_intent}</span>
              )}
              <span className="text-slate-500">{messages.length} message{messages.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {isMyMailbox && (
            <button
              onClick={() => setRead.mutate({ threadId: thread.id, read: false })}
              disabled={setRead.isPending}
              className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              Mark unread
            </button>
          )}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>{index + 1} of {total}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onPrev} disabled={index === 0} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onNext} disabled={index >= total - 1} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {/* ── context banner ─────────────────────────────────────────── */}
        {thread.category === 'unknown' && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-amber-200">Unmatched sender</p>
                <p className="text-slate-400">
                  <span className="text-slate-300">{thread.counterparty_email}</span> isn&apos;t linked to any contact.
                </p>
              </div>
            </div>
            <Button onClick={() => onConnect(thread)} className="shrink-0 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30">
              <Link2 className="mr-1.5 h-4 w-4" />
              Connect
            </Button>
          </div>
        )}

        {thread.category === 'external' && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-teal-500/25 bg-teal-500/5 p-4">
            <div className="flex items-start gap-3">
              <Globe className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" />
              <div className="text-sm">
                <p className="font-medium text-teal-200">External sender</p>
                <p className="text-slate-400">
                  {thread.counterparty_email} · booking / supplier email, kept in the CRM mailbox but not linked to a contact.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => onConnect(thread)} className="shrink-0 border-slate-700">
              <Link2 className="mr-1.5 h-4 w-4" />
              Connect anyway
            </Button>
          </div>
        )}

        {thread.category === 'internal' && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <div>
              <p className="font-medium text-slate-200">Internal mail</p>
              <p className="text-slate-400">Between IFG staff — not a player conversation.</p>
            </div>
          </div>
        )}

        {contact && ['player', 'parent', 'secondary'].includes(thread.category) && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-amber-500/80 text-xs font-medium text-slate-900">
                  {`${(contact.first_name as string) ?? ''}${(contact.last_name as string) ?? ''}`.slice(0, 2).toUpperCase() || '??'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">
                    {`${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim()}
                  </span>
                  <span className="flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-[11px] text-green-300">
                    <UserCheck className="h-3 w-3" /> Matched contact
                  </span>
                  <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[11px] text-blue-300">
                    {thread.category === 'parent' ? 'Parent' : 'Player'}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-slate-400">
                  {[contact.email, ...(contact.secondaryEmails ?? [])].filter(Boolean).join(' · ')}
                  {contact.country ? ` · ${contact.country}` : ''}
                </p>
                {!!contact.deals?.length && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {contact.deals.map((d: { id: string; pipeline: string | null; stage: string | null }) => (
                      <span key={d.id} className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                        {d.pipeline} · {d.stage}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button asChild variant="outline" size="sm" className="border-slate-700">
                <Link href={`/contacts?contactId=${thread.contact_id}`}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View contact
                </Link>
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onSmartDeal(thread)}>
                <Briefcase className="mr-1.5 h-3.5 w-3.5" /> Smart Deal
              </Button>
            </div>
          </div>
        )}

        {/* ── messages ───────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-900/40" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {earlier.length > 0 && (
              <button
                onClick={() => setShowEarlier(true)}
                className="flex w-full items-center gap-3 py-1 text-xs text-slate-500 hover:text-slate-300"
              >
                <span className="h-px flex-1 bg-slate-800" />
                {earlier.length} earlier message{earlier.length === 1 ? '' : 's'}
                <span className="h-px flex-1 bg-slate-800" />
              </button>
            )}
            {visible.map((m) => (
              <Message
                key={`${m.direction}-${m.id}`}
                message={m}
                expanded={isExpanded(m)}
                onToggle={() => setExpandedIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(m.id)) next.delete(m.id)
                  else next.add(m.id)
                  return next
                })}
                currentUserEmail={currentUserEmail}
                senderLabel={senderLabel}
              />
            ))}
          </div>
        )}

        {/* ── reply ──────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
          {!replyOpen ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-slate-700" onClick={() => { setReplyAll(false); setReplyOpen(true) }} disabled={!latestInbound}>
                <Reply className="mr-1.5 h-3.5 w-3.5" /> Reply
              </Button>
              {/* Reply all only when there is more than one other person on the
                  thread — otherwise it does exactly what Reply does. */}
              {otherPeople.size > 1 && (
                <Button variant="outline" size="sm" className="border-slate-700" onClick={() => { setReplyAll(true); setReplyOpen(true) }} disabled={!latestInbound}>
                  <CornerUpLeft className="mr-1.5 h-3.5 w-3.5" /> Reply all
                </Button>
              )}
              {!latestInbound && (
                <span className="text-xs text-slate-500">
                  Replies can only be sent on a conversation that arrived in a connected mailbox.
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                from {currentUserEmail || thread.mailbox_owner_name || 'your mailbox'}
                {replyAll && ' · replying to everyone on the thread'}
              </p>
              <Textarea
                rows={5}
                autoFocus
                placeholder="Write your reply…"
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                className="border-slate-800 bg-slate-950/60"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Sends through Outlook · threads stay in sync</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setReplyOpen(false); setReplyAll(false); setReplyBody('') }}>Cancel</Button>
                  <Button size="sm" onClick={handleReply} disabled={!replyBody.trim() || sendReply.isPending}>
                    {sendReply.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                    Send
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
