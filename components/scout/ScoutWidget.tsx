'use client'

// Floating "Scout" assistant — bottom-right glass-morphism panel for
// super_admin users. Closed: a single round button with the Scout mascot.
// Open: a card sized to fit the viewport (never overflows), with a header,
// message stream, tool-call trail under each assistant message, and an input.
//
// Visibility is gated via `userRole` prop (passed from the dashboard layout)
// so the widget never even renders for non-super_admins — no flash of UI.

import { useEffect, useRef, useState } from 'react'
import { X, Send, History, Plus, Trash2, Loader2, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScoutChat } from '@/lib/hooks/useScoutChat'
import type { ScoutMessage } from '@/lib/hooks/useScoutChat'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ScoutBallIcon, ScoutMascot } from './ScoutMascot'
import { ScoutMarkdown } from './ScoutMarkdown'

interface ScoutWidgetProps {
  userRole: string | null | undefined
}

export function ScoutWidget({ userRole }: ScoutWidgetProps) {
  const [open, setOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const {
    messages,
    conversations,
    sending,
    error,
    send,
    newConversation,
    loadConversation,
    deleteConversation,
  } = useScoutChat()

  // Auto-scroll the message list to the latest content while it streams in.
  //
  // Two key tweaks vs. a naive scrollIntoView({ behavior: 'smooth' }):
  //   1. Use direct scrollTop = scrollHeight, INSTANT. Smooth scrolls stack
  //      up when tokens arrive 30+ times a second, fighting each other and
  //      producing the up/down jitter the user reported.
  //   2. Only stick to bottom if the user already IS at the bottom. If they
  //      scrolled up to re-read something, we leave them alone instead of
  //      yanking them down on every token. The "isAtBottom" check is
  //      maintained by the onScroll handler attached to the scroll viewport.
  useEffect(() => {
    if (!stickToBottomRef.current) return
    const root = scrollRootRef.current
    if (!root) return
    const viewport = root.querySelector<HTMLDivElement>(
      '[data-radix-scroll-area-viewport]',
    )
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [messages])

  // Auto-grow the textarea so the user never sees browser scroll arrows
  // for a couple of lines of text. We reset to auto first so shrinking
  // works as the user deletes content. Capped at 128px (matches max-h-32).
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [input])

  // Hard gate: render nothing for non-super_admins. Belt-and-braces with the
  // server-side route check.
  if (userRole !== 'super_admin') return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input
    setInput('')
    // A new turn always wants to follow the response, even if the user had
    // scrolled up while reading the previous one.
    stickToBottomRef.current = true
    await send(text)
  }

  return (
    <>
      {/* Floating launcher — always rendered so the open/close transition
          stays smooth and the icon doesn't flash. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close Scout' : 'Open Scout'}
        className={cn(
          'fixed bottom-5 right-5 z-[60] grid h-14 w-14 place-items-center rounded-full',
          'bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500',
          'text-white shadow-[0_8px_30px_rgba(99,102,241,0.45)]',
          'ring-2 ring-white/40 dark:ring-white/10',
          'transition-all duration-300 hover:scale-105 hover:shadow-[0_12px_40px_rgba(99,102,241,0.6)]',
          open && 'scale-95',
        )}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <ScoutBallIcon className="h-7 w-7 drop-shadow-sm" />
        )}
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
          </span>
        )}
      </button>

      {/* Panel — capped at viewport height minus the launcher footprint, so it
          never overflows even on small screens. */}
      <div
        className={cn(
          'fixed bottom-24 right-5 z-50 flex w-[400px] max-w-[calc(100vw-2.5rem)] flex-col',
          'h-[min(640px,calc(100vh-7rem))]',
          'overflow-hidden rounded-2xl border border-white/30 dark:border-white/10',
          'bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl',
          'shadow-2xl shadow-indigo-900/30',
          'origin-bottom-right transition-all duration-300 ease-out',
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-4 scale-95 opacity-0',
        )}
      >
        <ScoutHeader
          showHistory={showHistory}
          onToggleHistory={() => setShowHistory((v) => !v)}
          onNew={() => {
            newConversation()
            setShowHistory(false)
          }}
          onClose={() => setOpen(false)}
        />

        {showHistory ? (
          <HistoryList
            conversations={conversations}
            onLoad={(id) => {
              loadConversation(id)
              setShowHistory(false)
            }}
            onDelete={deleteConversation}
          />
        ) : (
          <>
            <div ref={scrollRootRef} className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea
                className="h-full"
                onScrollCapture={(e) => {
                  // The user moved the scrollbar themselves. Update our
                  // "stick to bottom?" flag based on whether they're within
                  // ~40px of the bottom — if so, keep auto-scrolling on new
                  // tokens; if not, let them read in peace.
                  const t = e.target as HTMLElement
                  if (!t.scrollHeight) return
                  const distanceFromBottom = t.scrollHeight - t.clientHeight - t.scrollTop
                  stickToBottomRef.current = distanceFromBottom < 40
                }}
              >
                <div className="px-4 py-4">
                  {messages.length === 0 ? (
                    <EmptyState onPick={(s) => send(s)} />
                  ) : (
                    <div className="space-y-4">
                      {messages.map((m) => (
                        <Bubble key={m.id} message={m} />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {error && (
              <div className="mx-4 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="shrink-0 border-t border-slate-200/70 bg-white/60 p-3 dark:border-slate-700/50 dark:bg-slate-900/60"
            >
              {/* Outer wrapper holds a soft gradient focus glow so the field
                  itself can stay clean. Pointer-events:none on the glow so
                  it never intercepts clicks. */}
              <div className="group relative">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-indigo-500/0 via-violet-500/0 to-fuchsia-500/0 opacity-0 blur transition-opacity duration-300 group-focus-within:from-indigo-500/40 group-focus-within:via-violet-500/40 group-focus-within:to-fuchsia-500/40 group-focus-within:opacity-100"
                />
                <div className="relative flex items-end gap-2 rounded-2xl border border-slate-200 bg-white py-2 pl-4 pr-2 shadow-sm transition-colors focus-within:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-indigo-500/60">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit(e)
                      }
                    }}
                    rows={1}
                    placeholder="Ask Scout anything…"
                    spellCheck={false}
                    autoComplete="off"
                    className="scrollbar-hide flex-1 resize-none self-center overflow-hidden bg-transparent py-1 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                    style={{ height: 'auto' }}
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    aria-label="Send"
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center self-end rounded-xl text-white transition-all',
                      'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/30',
                      'hover:from-indigo-600 hover:to-violet-700 hover:shadow-lg hover:shadow-indigo-500/40',
                      'disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:cursor-not-allowed',
                      'dark:disabled:from-slate-700 dark:disabled:to-slate-700',
                    )}
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 -translate-x-px translate-y-px" />
                    )}
                  </button>
                </div>
              </div>
              <p className="mt-2 px-1 text-[10px] text-slate-400 dark:text-slate-500">
                Scout reads live data — answers reflect the platform right now.
              </p>
            </form>
          </>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function ScoutHeader({
  showHistory,
  onToggleHistory,
  onNew,
  onClose,
}: {
  showHistory: boolean
  onToggleHistory: () => void
  onNew: () => void
  onClose: () => void
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-slate-200/70 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 px-4 py-3 dark:border-slate-700/50">
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-md ring-1 ring-white/30">
          <ScoutBallIcon className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Scout</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            super_admin assistant
          </p>
        </div>
      </div>
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onNew}
                className="h-8 w-8 text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New chat</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleHistory}
                className={cn(
                  'h-8 w-8 text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
                  showHistory && 'bg-white/70 text-slate-900 dark:bg-slate-800 dark:text-white',
                )}
              >
                <History className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{showHistory ? 'Back to chat' : 'History'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state with starter prompts
// ---------------------------------------------------------------------------

const STARTER_PROMPTS = [
  'How are we doing this week?',
  'Who is in the Summer Residency pipeline?',
  'Show me unpaid invoices over £1,000.',
  'What automations are running on Masters 2025?',
  "Who's stuck in interview stage longer than 7 days?",
]

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center pb-2 pt-4 text-center">
      <ScoutMascot className="h-16 w-16" />
      <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
        Hi, I&apos;m Scout.
      </h3>
      <p className="mt-1 max-w-[280px] text-xs text-slate-500 dark:text-slate-400">
        Ask me anything about contacts, deals, invoices, automations, or platform metrics.
      </p>
      <div className="mt-4 flex w-full flex-col gap-1.5">
        <p className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Try one of these
        </p>
        {STARTER_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-left text-xs text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/70 hover:text-indigo-900 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-100"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
            <span className="flex-1">{p}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Message bubble + tool trail
// ---------------------------------------------------------------------------

function Bubble({ message }: { message: ScoutMessage }) {
  const isUser = message.role === 'user'
  const isEmpty = !message.content && message.pending
  // Tool calls are intentionally NOT rendered — the user just sees Scout's
  // final answer. Tool events still flow through useScoutChat so we can
  // surface a typing indicator while data is being fetched, but the
  // "Searched X" / "Read pipeline state" reference cards stay hidden.
  return (
    <div className={cn('flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[92%] px-3.5 py-2 text-sm leading-relaxed shadow-sm',
          isUser
            ? 'rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-500/20 whitespace-pre-wrap'
            : 'rounded-2xl rounded-bl-md border border-slate-200/70 bg-white text-slate-800 dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-100',
        )}
      >
        {isUser ? (
          message.content
        ) : isEmpty ? (
          <TypingDots />
        ) : (
          <ScoutMarkdown text={message.content} />
        )}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// History list
// ---------------------------------------------------------------------------

function HistoryList({
  conversations,
  onLoad,
  onDelete,
}: {
  conversations: { id: string; title: string | null; updated_at: string }[]
  onLoad: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-1 p-2">
          {conversations.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              No saved conversations yet.
            </p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className="group flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 transition hover:border-slate-200 hover:bg-white/70 dark:hover:border-slate-700 dark:hover:bg-slate-800/50"
              >
                <button
                  type="button"
                  onClick={() => onLoad(c.id)}
                  className="flex-1 truncate text-left text-xs text-slate-700 dark:text-slate-200"
                >
                  {c.title || 'Untitled chat'}
                  <span className="ml-2 text-[10px] text-slate-400 dark:text-slate-500">
                    {new Date(c.updated_at).toLocaleDateString()}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(c.id)}
                  className="h-7 w-7 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
