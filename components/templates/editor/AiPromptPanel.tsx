'use client'

// Left-pane chat-style AI builder. The first message generates a fresh
// template (and replaces any existing canvas content); subsequent messages
// enhance the current canvas. The thread is local to this session — a
// "+ new chat" button at the top wipes both the conversation history and
// the canvas, just like opening a fresh tab in Claude / ChatGPT.
//
// Chosen UX, not a planning artefact:
//   * single input + thread view (no separate "create" and "enhance" boxes)
//   * mode is auto-detected: empty canvas → create, otherwise → enhance
//   * AI replies as short status cards in the thread ("Generated 6 blocks",
//     "Made it warmer — 7 blocks now") so the conversation reads naturally
//   * canvas + right-side preview write themselves block-by-block at a
//     deliberate pace (300–550ms per block, weighted by block weight)

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sparkles,
  Loader2,
  Send,
  Plus,
  CircleAlert,
  CheckCircle2,
  WandSparkles,
  History,
  Trash2,
  MessageSquareText,
  ChevronLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { EditorBlock, TemplateSettings } from '@/lib/templates/editor-types'

interface AiPromptPanelProps {
  blocks: EditorBlock[]
  settings: TemplateSettings
  onApply: (
    blocks: EditorBlock[],
    partialSettings: Partial<TemplateSettings>,
  ) => void
  onGenerationStart: () => void
  onGenerationEnd: () => void
}

interface ThreadMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  variant?: 'success' | 'error' | 'info'
  pending?: boolean
}

interface ChatSummary {
  id: string
  title: string | null
  updated_at: string
}

interface PersistedMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  blocks_snapshot: EditorBlock[] | null
  subject_snapshot: string | null
  preheader_snapshot: string | null
}

const STARTER_SUGGESTIONS = [
  'Welcome email for a player joining Summer Residency. Include next steps and a Calendly link.',
  'Interview confirmation with the recruiter — friendly tone.',
  'Deposit invoice reminder — polite but firm.',
  'Re-engagement email for a contact who went quiet for 2 weeks.',
]

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'msg-' + Math.random().toString(36).slice(2)
}

export function AiPromptPanel({
  blocks,
  settings,
  onApply,
  onGenerationStart,
  onGenerationEnd,
}: AiPromptPanelProps) {
  const [thread, setThread] = useState<ThreadMessage[]>([])
  const [input, setInput] = useState('')
  const [category, setCategory] = useState<TemplateSettings['category']>(
    settings.category ?? 'campaign',
  )
  const [isGenerating, setIsGenerating] = useState(false)
  // The active chat — null until the first message is sent. After that,
  // the API returns chat_id which we pin so subsequent turns append to
  // the same thread on the server.
  const [chatId, setChatId] = useState<string | null>(null)
  const [chats, setChats] = useState<ChatSummary[]>([])
  // Two-state inline view, mirroring Claude's UX: the panel either shows
  // the active chat ('chat') or the full-pane history list ('history').
  // No popover, no overlay — clicking History swaps the entire panel
  // content; a back arrow returns to the chat.
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [loadingChat, setLoadingChat] = useState<string | null>(null)
  const threadEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Lazy-fetch history when the view swaps to 'history'. Also pre-fetch
  // once on mount so the first open is snappy. Subsequent opens refresh
  // so newly created chats surface at the top.
  const fetchChats = async () => {
    try {
      const res = await fetch('/api/templates/ai-chats', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as { chats: ChatSummary[] }
      setChats(json.chats ?? [])
    } catch {
      // History is best-effort; silent fail is fine.
    }
  }

  useEffect(() => {
    if (view === 'history') fetchChats()
  }, [view])

  const loadChat = async (id: string) => {
    if (isGenerating) return
    setLoadingChat(id)
    try {
      const res = await fetch(`/api/templates/ai-chats/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load chat')

      const messages = (json.messages ?? []) as PersistedMessage[]

      // Hydrate the thread bubbles. AI bubbles get a "success" variant — we
      // don't keep error bubbles in history, only successful turns.
      const hydratedThread: ThreadMessage[] = messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        variant: m.role === 'assistant' ? 'success' : undefined,
      }))
      setThread(hydratedThread)

      // Restore the canvas to the latest AI snapshot in this chat.
      const latestAi = [...messages]
        .reverse()
        .find((m) => m.role === 'assistant' && Array.isArray(m.blocks_snapshot))
      if (latestAi && latestAi.blocks_snapshot) {
        onApply(latestAi.blocks_snapshot, {
          subject: latestAi.subject_snapshot ?? settings.subject,
          preheader: latestAi.preheader_snapshot ?? settings.preheader,
        })
      } else {
        // No AI turn yet (just a user message?) — leave canvas alone.
      }

      setChatId(id)
      // Loading a chat returns the user to the chat view automatically —
      // they want to see what they restored, not stay in the list.
      setView('chat')
      toast.success('Chat restored')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load chat')
    } finally {
      setLoadingChat(null)
    }
  }

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this chat?')) return
    try {
      await fetch(`/api/templates/ai-chats/${id}`, { method: 'DELETE' })
      setChats((prev) => prev.filter((c) => c.id !== id))
      if (chatId === id) {
        // Active chat deleted — wipe the panel state too.
        setThread([])
        setInput('')
        setChatId(null)
        onApply([], { subject: '', preheader: '' })
      }
    } catch {
      toast.error('Could not delete chat')
    }
  }

  // Auto-scroll the thread when new messages arrive.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [thread])

  // Auto-grow the textarea up to 7 lines.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const startNewChat = () => {
    if (isGenerating) return
    setThread([])
    setInput('')
    setChatId(null)
    // Clear the canvas + reset the subject/preheader so the next "Generate"
    // is a fresh slate. Goes through onApply so it's a single history entry,
    // i.e. the user can undo it if they hit "+ new chat" by mistake.
    onApply([], { subject: '', preheader: '' })
  }

  const submit = async () => {
    const trimmed = input.trim()
    if (!trimmed || isGenerating) return

    const mode: 'create' | 'enhance' = blocks.length === 0 ? 'create' : 'enhance'

    const userMsg: ThreadMessage = { id: newId(), role: 'user', content: trimmed }
    const pendingId = newId()
    const pendingMsg: ThreadMessage = {
      id: pendingId,
      role: 'assistant',
      content: mode === 'create' ? 'Drafting the template…' : 'Applying your changes…',
      variant: 'info',
      pending: true,
    }
    setThread((prev) => [...prev, userMsg, pendingMsg])
    setInput('')
    setIsGenerating(true)
    onGenerationStart()

    try {
      const res = await fetch('/api/templates/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          mode,
          category,
          existingBlocks: mode === 'enhance' ? blocks : undefined,
          existingSubject: mode === 'enhance' ? settings.subject : undefined,
          // Pin to the active chat if any so the server appends the turn.
          // First send returns a fresh chat_id we capture below.
          chat_id: chatId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'AI request failed')

      // Pin the chat id for subsequent turns in this conversation.
      if (typeof json.chat_id === 'string' && json.chat_id) {
        setChatId(json.chat_id)
      }
      const generated = json.blocks as EditorBlock[]
      const partial: Partial<TemplateSettings> = {
        subject: json.subject || settings.subject,
        preheader: json.preheader || settings.preheader,
      }
      // Only auto-fill the name if the user hasn't set one. We treat the
      // factory default ("Untitled Template") and an empty string as
      // unset — both should accept the AI's suggestion. A name the user
      // typed themselves is preserved untouched.
      const hasUserName =
        settings.name &&
        settings.name.trim() !== '' &&
        settings.name !== 'Untitled Template'
      if (!hasUserName && typeof json.name === 'string' && json.name.trim()) {
        partial.name = json.name.trim()
      }

      // Replace the pending bubble with a "writing…" state while the canvas
      // materialises, then flip it to a success card with the final count.
      setThread((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content:
                  mode === 'create' ? 'Writing it on the canvas…' : 'Rewriting on the canvas…',
              }
            : m,
        ),
      )

      await materialiseBlocks(generated, (slice, isFinal) => {
        onApply(slice, isFinal ? partial : {})
      })

      setThread((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                pending: false,
                variant: 'success',
                content:
                  mode === 'create'
                    ? `Done. ${generated.length} block${generated.length === 1 ? '' : 's'}. Subject: "${partial.subject ?? ''}"`
                    : `Updated — ${generated.length} block${generated.length === 1 ? '' : 's'} now.`,
              }
            : m,
        ),
      )
      toast.success(mode === 'create' ? 'Template generated' : 'Template enhanced')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'AI generation failed'
      setThread((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, pending: false, variant: 'error', content: message }
            : m,
        ),
      )
      toast.error(message, { description: 'Tweak the prompt and try again.' })
    } finally {
      setIsGenerating(false)
      onGenerationEnd()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const placeholder =
    blocks.length === 0
      ? 'Describe the email you want…'
      : 'Describe a tweak — e.g. "make it warmer"'

  return (
    <div className="flex h-full w-[340px] shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* Header — content depends on which view is active. In chat view
          the title row + History/New chat buttons sit here. In history
          view we replace the whole row with a back arrow + "Chat history"
          title so the panel reads as a separate page. */}
      {view === 'chat' ? (
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                AI Template Builder
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {blocks.length === 0 ? "Describe it. I'll write it." : 'Refine the template'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView('history')}
              disabled={isGenerating}
              title="Chat history"
              className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={startNewChat}
              disabled={isGenerating}
              title="New chat"
              className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView('chat')}
              title="Back to chat"
              className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Chat history
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              startNewChat()
              setView('chat')
            }}
            title="New chat"
            className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {view === 'history' ? (
        // Full-pane chat history list, replacing the chat thread + input.
        <ChatHistoryList
          chats={chats}
          activeChatId={chatId}
          loadingChatId={loadingChat}
          onLoad={loadChat}
          onDelete={deleteChat}
        />
      ) : (
        <>
          {/* Category selector — small, doesn't need a textarea-sized field */}
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/40">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Category
            </span>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as TemplateSettings['category'])}
              disabled={isGenerating}
            >
              <SelectTrigger className="h-7 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="campaign">Campaign</SelectItem>
                <SelectItem value="automation">Automation</SelectItem>
                <SelectItem value="transactional">Transactional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Thread */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {thread.length === 0 ? (
              <EmptyThread
                onPick={(s) => {
                  setInput(s)
                  textareaRef.current?.focus()
                }}
                isExisting={blocks.length > 0}
              />
            ) : (
              <div className="space-y-3">
                {thread.map((m) => (
                  <ThreadBubble key={m.id} message={m} />
                ))}
                <div ref={threadEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-colors focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-indigo-500/60 dark:focus-within:ring-indigo-500/20">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                rows={1}
                disabled={isGenerating}
                spellCheck={false}
                autoComplete="off"
                className="scrollbar-hide max-h-40 flex-1 resize-none self-center overflow-hidden bg-transparent py-1 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                style={{ height: 'auto' }}
              />
              <button
                type="button"
                onClick={submit}
                disabled={isGenerating || !input.trim()}
                aria-label="Send"
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center self-end rounded-lg text-white transition-all',
                  'bg-gradient-to-br from-indigo-500 to-violet-600 shadow shadow-indigo-500/30',
                  'hover:from-indigo-600 hover:to-violet-700',
                  'disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:cursor-not-allowed',
                  'dark:disabled:from-slate-700 dark:disabled:to-slate-700',
                )}
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 -translate-x-px translate-y-px" />
                )}
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[10px] text-slate-400 dark:text-slate-500">
              {isGenerating
                ? 'AI is working — watch the canvas on the right.'
                : 'Enter to send, Shift+Enter for a new line.'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty thread state
// ---------------------------------------------------------------------------

function EmptyThread({
  onPick,
  isExisting,
}: {
  onPick: (s: string) => void
  isExisting: boolean
}) {
  return (
    <div className="flex flex-col items-center pt-2 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40">
        <WandSparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
      </div>
      <h3 className="mt-2.5 text-sm font-semibold text-slate-900 dark:text-white">
        {isExisting ? 'How should I refine this?' : 'What email do you want?'}
      </h3>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        {isExisting
          ? 'Tell me how to change the current template.'
          : "I'll write it using your platform's merge tags + IFG voice."}
      </p>
      {!isExisting && (
        <div className="mt-4 flex w-full flex-col gap-1.5">
          <p className="text-left text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Try one of these
          </p>
          {STARTER_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-[11px] leading-snug text-slate-700 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/60 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-900/20"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thread bubble
// ---------------------------------------------------------------------------

function ThreadBubble({ message }: { message: ThreadMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-600 px-3 py-1.5 text-[12px] leading-relaxed text-white shadow-sm shadow-indigo-500/20">
          {message.content}
        </div>
      </div>
    )
  }
  // Assistant: a small status card with an icon based on variant.
  const Icon =
    message.variant === 'error'
      ? CircleAlert
      : message.variant === 'success'
        ? CheckCircle2
        : Sparkles
  const tone =
    message.variant === 'error'
      ? 'border-red-200 bg-red-50/70 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
      : message.variant === 'success'
        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
        : 'border-indigo-200 bg-indigo-50/60 text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200'
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-sm">
        <Sparkles className="h-2.5 w-2.5 text-white" />
      </div>
      <div
        className={cn(
          'flex-1 rounded-xl border px-2.5 py-1.5 text-[11px] leading-relaxed',
          tone,
        )}
      >
        <div className="flex items-center gap-1.5">
          {message.pending ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin opacity-70" />
          ) : (
            <Icon className="h-3 w-3 shrink-0 opacity-70" />
          )}
          <span>{message.content}</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chat history popover content
// ---------------------------------------------------------------------------

function ChatHistoryList({
  chats,
  activeChatId,
  loadingChatId,
  onLoad,
  onDelete,
}: {
  chats: ChatSummary[]
  activeChatId: string | null
  loadingChatId: string | null
  onLoad: (id: string) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}) {
  // Full-pane history view: takes the rest of the panel below the header
  // (flex-1) and scrolls internally.
  if (chats.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">
          <MessageSquareText className="h-5 w-5 text-slate-400" />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
          No chats yet
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          Start a conversation and it&apos;ll show up here so you can pick up
          where you left off.
        </p>
      </div>
    )
  }
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Recent chats
      </div>
      <div className="space-y-0.5 px-1.5 pb-3">
        {chats.map((c) => {
          const isActive = c.id === activeChatId
          const isLoading = c.id === loadingChatId
          return (
            <div
              key={c.id}
              onClick={() => onLoad(c.id)}
              className={cn(
                'group flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 transition',
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-900/30'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60',
              )}
            >
              <MessageSquareText
                className={cn(
                  'mt-0.5 h-3.5 w-3.5 shrink-0',
                  isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-900 dark:text-white">
                  {c.title || 'Untitled chat'}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                  {new Date(c.updated_at).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              {isLoading ? (
                <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-indigo-500" />
              ) : (
                <button
                  type="button"
                  onClick={(e) => onDelete(c.id, e)}
                  className="mt-0.5 h-6 w-6 shrink-0 rounded text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/40"
                  title="Delete chat"
                >
                  <Trash2 className="m-auto h-3 w-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Materialisation: reveal blocks gradually so the canvas + live preview
// "writes" the email visibly. Tuned slow (300–550ms per block, weighted by
// block weight) so the user can actually watch it happen — earlier 110ms
// per tick was so fast the preview blinked through the whole template
// before the eye could follow it.
// ---------------------------------------------------------------------------

function tickMsForBlock(b: EditorBlock): number {
  switch (b.type) {
    case 'text':
      return 550
    case 'columns':
      return 500
    case 'image':
      return 400
    case 'recruiter_signature':
      return 450
    case 'button':
      return 350
    case 'video':
    case 'social':
    case 'file':
    case 'html':
    case 'conditional':
      return 350
    case 'divider':
    case 'spacer':
      return 220
    default:
      return 350
  }
}

async function materialiseBlocks(
  blocks: EditorBlock[],
  onTick: (slice: EditorBlock[], isFinal: boolean) => void,
): Promise<void> {
  if (blocks.length === 0) {
    onTick([], true)
    return
  }
  for (let i = 1; i <= blocks.length; i++) {
    const slice = blocks.slice(0, i)
    const isFinal = i === blocks.length
    onTick(slice, isFinal)
    if (!isFinal) {
      // Pace pulled from the block we JUST revealed — text-heavy blocks
      // get more breathing room, dividers/spacers tick fast.
      const pause = tickMsForBlock(blocks[i - 1])
      await new Promise((res) => setTimeout(res, pause))
    }
  }
}
