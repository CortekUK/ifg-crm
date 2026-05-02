'use client'

// Full-page Scout — Claude-style layout. Two panes:
//
//   Left sidebar (~280px, collapsible): brand bar + "+ New chat" button +
//     scrollable list of recent conversations. Click to load.
//
//   Main pane (flex-1): chat thread + sticky input at the bottom. The
//     thread is centred at a comfortable reading width on big screens.
//
// All state comes from useScoutChat — same hook the old floating widget
// used, so we keep one source of truth for chat / history / streaming.

import { useEffect, useRef, useState } from 'react'
import {
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Loader2,
  Sparkles,
  Trash2,
  ArrowLeft,
  MessageSquareText,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useScoutChat } from '@/lib/hooks/useScoutChat'
import type { ScoutMessage } from '@/lib/hooks/useScoutChat'
import { ScoutBallIcon } from './ScoutMascot'
import { ScoutMarkdown } from './ScoutMarkdown'

const STARTER_PROMPTS = [
  'How are we doing this week?',
  'Who is in the Summer Residency pipeline?',
  'Show me unpaid invoices over £1,000.',
  'What automations are running on Masters 2025?',
  "Who's stuck in interview stage longer than 7 days?",
]

export function ScoutChatPage() {
  const {
    messages,
    conversations,
    conversationId,
    sending,
    error,
    send,
    newConversation,
    loadConversation,
    deleteConversation,
  } = useScoutChat()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)

  // Sticky-bottom autoscroll while streaming, lifted from the old widget.
  useEffect(() => {
    if (!stickToBottomRef.current) return
    const root = scrollRootRef.current
    if (!root) return
    root.scrollTop = root.scrollHeight
  }, [messages])

  // Auto-grow textarea up to 7 lines; resets to 1 row after submit.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    stickToBottomRef.current = true
    await send(text)
    inputRef.current?.focus()
  }

  return (
    <div className="flex h-full w-full">
      {/* Sidebar */}
      <aside
        className={cn(
          'relative flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900',
          sidebarOpen ? 'w-[280px]' : 'w-0',
        )}
      >
        <div
          className={cn(
            'flex h-full flex-col overflow-hidden transition-opacity duration-300',
            sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          {/* Brand row */}
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3 dark:border-slate-800">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-sm">
                <ScoutBallIcon className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Scout
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  super_admin assistant
                </p>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              title="Hide sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>

          {/* New chat */}
          <div className="px-3 py-3">
            <Button
              onClick={newConversation}
              className="w-full justify-start bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm hover:from-indigo-600 hover:to-violet-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              New chat
            </Button>
          </div>

          {/* History list */}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Recent
            </p>
            {conversations.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
                No chats yet — your conversations will appear here.
              </p>
            ) : (
              <div className="space-y-0.5">
                {conversations.map((c) => {
                  const active = c.id === conversationId
                  return (
                    <div
                      key={c.id}
                      onClick={() => loadConversation(c.id)}
                      className={cn(
                        'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 transition',
                        active
                          ? 'bg-indigo-50 dark:bg-indigo-900/30'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/60',
                      )}
                    >
                      <MessageSquareText
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          active
                            ? 'text-indigo-600 dark:text-indigo-300'
                            : 'text-slate-400',
                        )}
                      />
                      <span className="truncate flex-1 text-xs font-medium text-slate-800 dark:text-slate-100">
                        {c.title || 'Untitled chat'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteConversation(c.id)
                        }}
                        className="opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer link back to the dashboard */}
          <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to dashboard
            </Link>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="relative flex h-full flex-1 flex-col">
        {/* Top bar — only shown when sidebar is collapsed, otherwise the
            sidebar's own brand row covers branding. */}
        {!sidebarOpen && (
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              title="Show sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5">
              <ScoutBallIcon className="h-4 w-4" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Scout
              </span>
            </div>
          </div>
        )}

        {/* Thread */}
        <div ref={scrollRootRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {messages.length === 0 ? (
              <EmptyState onPick={(s) => send(s)} />
            ) : (
              <div className="space-y-6">
                {messages.map((m) => (
                  <Bubble key={m.id} message={m} />
                ))}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-auto w-full max-w-3xl px-4">
            <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex w-full max-w-3xl items-end gap-2"
          >
            <div className="group relative flex-1">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-indigo-500/0 via-violet-500/0 to-fuchsia-500/0 opacity-0 blur transition-opacity duration-300 group-focus-within:from-indigo-500/30 group-focus-within:via-violet-500/30 group-focus-within:to-fuchsia-500/30 group-focus-within:opacity-100"
              />
              <div className="relative flex items-end gap-2 rounded-2xl border border-slate-200 bg-white py-2 pl-4 pr-2 shadow-sm transition-colors focus-within:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-indigo-500/60">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  rows={1}
                  placeholder="Ask Scout anything about your platform…"
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
          </form>
          <p className="mx-auto mt-2 w-full max-w-3xl px-1 text-[10px] text-slate-400 dark:text-slate-500">
            Scout reads live data — answers reflect the platform right now.
            Enter to send, Shift+Enter for a new line.
          </p>
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 shadow-sm dark:from-indigo-900/40 dark:to-violet-900/40">
        <Sparkles className="h-7 w-7 text-indigo-600 dark:text-indigo-300" />
      </div>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        Hi, I&apos;m Scout.
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        Ask me anything about contacts, deals, invoices, automations, lists,
        communications, or platform metrics. I read live data.
      </p>
      <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {STARTER_PROMPTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-900/20"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function Bubble({ message }: { message: ScoutMessage }) {
  const isUser = message.role === 'user'
  const isEmpty = !message.content && message.pending
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-md shadow-indigo-500/20">
          {message.content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-sm">
        <ScoutBallIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-100">
        {isEmpty ? <TypingDots /> : <ScoutMarkdown text={message.content} />}
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
