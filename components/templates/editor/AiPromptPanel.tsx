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
  Paperclip,
  X,
  FileText,
  FileSpreadsheet,
  ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { EditorBlock, TemplateSettings } from '@/lib/templates/editor-types'
import {
  ACCEPT_ATTRIBUTE,
  MAX_ATTACHMENTS,
  MAX_COMBINED_EXTRACTED_CHARS,
  chipBadge,
  chipKindForFile,
  readAttachment,
  type AiAttachment,
} from '@/lib/ai/attachments'

interface AiPromptPanelProps {
  // The active email template id. When set, the panel auto-resumes the
  // most recent AI chat for that template on mount — so refreshing
  // the editor doesn't lose the conversation context.
  templateId?: string
  blocks: EditorBlock[]
  settings: TemplateSettings
  // Apply the AI-generated blocks to the canvas. The optional `opts`
  // argument controls whether this update commits a new undo entry —
  // intermediate ticks of the materialise animation pass commit:false
  // so the user gets ONE undo step for the whole generation rather
  // than one per progressive write.
  onApply: (
    blocks: EditorBlock[],
    partialSettings: Partial<TemplateSettings>,
    opts?: { commit?: boolean },
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
  // Attachments the user sent with this turn. Images render as
  // inline thumbnails inside the user bubble, docs/text render as
  // small file cards. Only set on user-role messages from the live
  // session — chat-history rehydration leaves this undefined.
  attachments?: AiAttachment[]
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

// Composer-side wrapper around AiAttachment so each chip can carry an
// upload/extract status. `ready` items are what get sent to the server
// on submit; `loading` items render as skeletons; `error` items show
// the rejection inline.
type ComposerAttachment =
  | { id: string; status: 'loading'; name: string; kind: 'image' | 'doc' | 'text' }
  | { id: string; status: 'ready'; payload: AiAttachment }
  | { id: string; status: 'error'; name: string; message: string }

export function AiPromptPanel({
  templateId,
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
  // AbortController for the in-flight generation, so the user can
  // tap the Stop button and bail out of a slow turn without waiting
  // for it to complete. Mirrors Scout's stop pattern.
  const abortRef = useRef<AbortController | null>(null)
  // Attachments — same shape and lifecycle as Scout. Pasted/dropped
  // files create `loading` placeholders that render as skeletons; the
  // extractor resolves each into a `ready` chip carrying the payload
  // we send to the server.
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  // Mirror in a ref so parallel readAttachment resolutions can read the
  // running combined-text total without stale closures.
  const attachmentsRef = useRef<ComposerAttachment[]>(attachments)
  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])
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

  // Auto-resume — when the panel mounts on an existing template, find
  // the most recent chat linked to it and hydrate the thread. Without
  // this, refreshing the editor (or closing & reopening the template)
  // dropped the conversation and the user had to dig through History
  // every time. Only runs once per template, and only if there's no
  // active chat already.
  useEffect(() => {
    if (!templateId) return
    if (chatId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/templates/ai-chats?template_id=${encodeURIComponent(templateId)}`,
          { cache: 'no-store' },
        )
        if (!res.ok) return
        const json = (await res.json()) as { chats: ChatSummary[] }
        const latest = json.chats?.[0]
        if (!cancelled && latest) {
          // loadChat hydrates the thread + restores canvas state. We
          // skip the canvas restore for auto-resume to avoid stomping
          // on the user's loaded template — the template row already
          // has its own body_json that the editor opens with. The
          // chat thread is what the user wants back; the canvas is
          // already correct.
          await hydrateChatThreadOnly(latest.id)
        }
      } catch {
        /* best-effort — silent fail */
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  // Hydrate just the chat thread (no canvas restore) — used by the
  // auto-resume path on mount, where the canvas is already populated
  // by the editor's loadTemplate flow.
  const hydrateChatThreadOnly = async (id: string) => {
    try {
      const res = await fetch(`/api/templates/ai-chats/${id}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      const messages = (json.messages ?? []) as PersistedMessage[]
      const hydratedThread: ThreadMessage[] = messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        variant: m.role === 'assistant' ? 'success' : undefined,
      }))
      setThread(hydratedThread)
      setChatId(id)
    } catch {
      /* best-effort */
    }
  }

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
    setAttachments([])
    // Clear the canvas + reset the subject/preheader so the next "Generate"
    // is a fresh slate. Goes through onApply so it's a single history entry,
    // i.e. the user can undo it if they hit "+ new chat" by mistake.
    onApply([], { subject: '', preheader: '' })
  }

  // Drop placeholder chips into state immediately so the user sees a
  // skeleton for each file, then resolve all extractions in parallel and
  // patch each row by its placeholder id when it lands. Errors get an
  // `error` chip so the user can dismiss and retry without losing the
  // rest of the batch.
  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return
    const room = MAX_ATTACHMENTS - attachments.length
    if (room <= 0) {
      toast.error(`Up to ${MAX_ATTACHMENTS} attachments per message.`)
      return
    }
    if (list.length > room) {
      toast.error(`Only added the first ${room} — limit is ${MAX_ATTACHMENTS} per message.`)
    }
    const slice = list.slice(0, room)

    type LoadingAttachment = Extract<ComposerAttachment, { status: 'loading' }>
    const placeholders: LoadingAttachment[] = slice.map((f) => ({
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
      status: 'loading',
      name: f.name || 'file',
      kind: chipKindForFile(f),
    }))
    setAttachments((prev) => [...prev, ...placeholders])

    slice.forEach((file, i) => {
      const placeholder = placeholders[i]
      readAttachment(file).then(
        (payload) => {
          // Enforce the per-message combined extracted-text cap. Surface
          // a toast and mark the chip as error if adding this one
          // pushes us past the limit.
          if (payload.kind === 'text') {
            const currentTotal = attachmentsRef.current.reduce((sum, a) => {
              if (a.status === 'ready' && a.payload.kind === 'text') {
                return sum + a.payload.content.length
              }
              return sum
            }, 0)
            if (currentTotal + payload.content.length > MAX_COMBINED_EXTRACTED_CHARS) {
              const remainingKB = Math.max(
                0,
                Math.round((MAX_COMBINED_EXTRACTED_CHARS - currentTotal) / 1024),
              )
              toast.error(
                `"${payload.name}" pushes the message past the combined ${Math.round(
                  MAX_COMBINED_EXTRACTED_CHARS / 1024,
                )} KB document-text limit. ${remainingKB} KB room left.`,
              )
              setAttachments((prev) =>
                prev.map((a) =>
                  a.id === placeholder.id
                    ? {
                        id: placeholder.id,
                        status: 'error',
                        name: placeholder.name,
                        message: 'Combined size limit reached',
                      }
                    : a,
                ),
              )
              return
            }
          }
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === placeholder.id
                ? { id: placeholder.id, status: 'ready', payload }
                : a,
            ),
          )
        },
        (err) => {
          const message = typeof err === 'string' ? err : 'Could not read file'
          toast.error(message)
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === placeholder.id
                ? { id: placeholder.id, status: 'error', name: placeholder.name, message }
                : a,
            ),
          )
        },
      )
    })
  }

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id))

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it.kind === 'file') {
        const f = it.getAsFile()
        if (f) files.push(f)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      addFiles(files)
    }
  }

  const anyAttachmentLoading = attachments.some((a) => a.status === 'loading')
  const readyAttachments = attachments
    .filter((a): a is Extract<ComposerAttachment, { status: 'ready' }> => a.status === 'ready')
    .map((a) => a.payload)

  const submit = async () => {
    const trimmed = input.trim()
    // Allow attachment-only sends (e.g. "build me an email like this
    // attached PDF"). Block while extractors are still running.
    if (isGenerating || anyAttachmentLoading) return
    if (!trimmed && readyAttachments.length === 0) return

    const mode: 'create' | 'enhance' = blocks.length === 0 ? 'create' : 'enhance'

    // Attachments are stored on the message itself rather than
    // squeezed into the content string. ThreadBubble renders image
    // chips and file cards inline above the text bubble — same as
    // Claude / Scout — so the user sees what they actually sent.
    const userMsg: ThreadMessage = {
      id: newId(),
      role: 'user',
      content: trimmed,
      attachments: readyAttachments.length > 0 ? readyAttachments : undefined,
    }
    const pendingId = newId()
    const pendingMsg: ThreadMessage = {
      id: pendingId,
      role: 'assistant',
      content: 'Thinking…',
      variant: 'info',
      pending: true,
    }
    setThread((prev) => [...prev, userMsg, pendingMsg])
    setInput('')
    // Snapshot the attachments we're about to send and clear them from
    // the composer so the next message starts fresh. Errors keep the
    // user bubble in the thread but don't restore the chips.
    const sentAttachments = readyAttachments
    setAttachments([])
    setIsGenerating(true)
    onGenerationStart()

    // Fresh AbortController for this turn — the Stop button calls
    // abort() on it. The fetch's `signal` propagates the cancel to
    // the network layer; the catch below detects AbortError and
    // shows a friendly "Stopped." bubble instead of an error.
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/templates/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: trimmed,
          mode,
          category,
          existingBlocks: mode === 'enhance' ? blocks : undefined,
          existingSubject: mode === 'enhance' ? settings.subject : undefined,
          // Send the current theme so the AI knows what's already set
          // and only emits keys it actually wants to change. Without
          // this, every theme update wiped previously-set keys because
          // the OpenAI strict schema forces ALL theme keys to be
          // present and the model would fill the rest with defaults.
          existingTheme: mode === 'enhance' ? (settings.theme ?? null) : null,
          // Pin to the active chat if any so the server appends the turn.
          // First send returns a fresh chat_id we capture below.
          chat_id: chatId,
          // Pin to the active template so the chat stays linked across
          // refreshes — the panel auto-resumes this conversation on
          // mount when the same template is reopened.
          template_id: templateId,
          attachments: sentAttachments,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'AI request failed')

      // Pin the chat id for subsequent turns in this conversation.
      if (typeof json.chat_id === 'string' && json.chat_id) {
        setChatId(json.chat_id)
      }

      // The model decides intent for the turn. 'answer' means a chat-only
      // reply: render it in the bubble and DON'T touch the canvas. Every
      // turn carries a `reply` string — that's what we show as the bubble
      // body, replacing the old "Generated N blocks" status placeholder.
      const intent = (json.intent as 'answer' | 'create' | 'enhance' | undefined) ?? 'create'
      const reply = typeof json.reply === 'string' && json.reply.trim()
        ? json.reply.trim()
        : null

      if (intent === 'answer') {
        setThread((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  pending: false,
                  variant: 'info',
                  // Fallback shouldn't be needed since the schema makes
                  // reply required, but be defensive in case the model
                  // somehow returns blank.
                  content: reply ?? "I don't have anything to add — could you rephrase?",
                }
              : m,
          ),
        )
        return
      }

      const generated = json.blocks as EditorBlock[]
      const partial: Partial<TemplateSettings> = {
        subject: json.subject || settings.subject,
        preheader: json.preheader || settings.preheader,
      }
      // Theme — when the AI returned overrides, merge them into the
      // existing theme so previously-set keys aren't blown away by a
      // turn that only changed one knob (e.g. user said "change just
      // the header"; we keep their earlier footer colour).
      if (json.theme && typeof json.theme === 'object') {
        partial.theme = { ...(settings.theme ?? {}), ...json.theme }
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

      // While the canvas materialises, surface a brief "writing…" status —
      // we'll swap to the model's actual reply once it's done so the bubble
      // ends up showing the friendly natural-language explanation.
      setThread((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content:
                  intent === 'create'
                    ? 'Writing it on the canvas…'
                    : 'Applying changes to the canvas…',
              }
            : m,
        ),
      )

      await materialiseBlocks(generated, (slice, isFinal) => {
        // Only the final tick commits a history entry. Intermediate
        // ticks update the canvas without pushing — so undo treats the
        // whole AI generation as a single reversible action.
        onApply(slice, isFinal ? partial : {}, { commit: isFinal })
      })

      const blockCount = generated.length
      const fallback =
        intent === 'create'
          ? `Drafted ${blockCount} block${blockCount === 1 ? '' : 's'} — subject "${partial.subject ?? ''}". Take a look and tell me what to tweak.`
          : `Applied your changes — ${blockCount} block${blockCount === 1 ? '' : 's'} on the canvas now.`

      setThread((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                pending: false,
                variant: 'success',
                content: reply ?? fallback,
              }
            : m,
        ),
      )
      toast.success(intent === 'create' ? 'Template generated' : 'Template enhanced')
    } catch (e) {
      // Aborted by the user via the Stop button — replace the pending
      // bubble with a quiet "Stopped." marker (no toast, no destructive
      // styling). DOMException with name 'AbortError' is what fetch
      // throws when signal.aborted is set.
      const isAbort =
        (e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError')
      if (isAbort) {
        setThread((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, pending: false, variant: 'info', content: 'Stopped.' }
              : m,
          ),
        )
      } else {
        const message = e instanceof Error ? e.message : 'AI generation failed'
        setThread((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, pending: false, variant: 'error', content: message }
              : m,
          ),
        )
        toast.error(message, { description: 'Tweak the prompt and try again.' })
      }
    } finally {
      setIsGenerating(false)
      abortRef.current = null
      onGenerationEnd()
    }
  }

  // Cancel the in-flight generation. Used by the Stop button that
  // replaces Send while a turn is running.
  const stop = () => {
    abortRef.current?.abort()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const placeholder =
    blocks.length === 0 ? 'Describe the email…' : 'Describe a tweak…'

  return (
    // Slim panel chrome — width is owned by the parent (320px). The header
    // is a single short row with just the action icons; we dropped the
    // gradient avatar tile + 2-line "AI Template Builder" subtitle from the
    // earlier design because it ate ~44px of vertical space for pure
    // branding the user already understands from the mode toggle.
    <div className="flex h-full w-full shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {view === 'chat' ? (
        // Header — Sparkles icon + category dropdown (folded in here as
        // a borderless inline trigger, replacing the old dedicated
        // Category strip and the input-footer placement; both felt heavy
        // for a setting the user rarely changes). Dropdown reads as
        // text, not a form field.
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
          <div className="flex min-w-0 items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as TemplateSettings['category'])}
              disabled={isGenerating}
            >
              <SelectTrigger
                className={cn(
                  'h-6 w-auto gap-1 border-none bg-transparent px-1 shadow-none outline-none ring-0 focus:ring-0',
                  'text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700',
                  'dark:text-slate-400 dark:hover:text-slate-200',
                  '[&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60',
                )}
                aria-label="Template category"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="campaign">Campaign</SelectItem>
                <SelectItem value="automation">Automation</SelectItem>
                <SelectItem value="transactional">Transactional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView('history')}
              disabled={isGenerating}
              title="Chat history"
              className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <History className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={startNewChat}
              disabled={isGenerating}
              title="New chat"
              className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView('chat')}
              title="Back to chat"
              className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
            className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {view === 'history' ? (
        <ChatHistoryList
          chats={chats}
          activeChatId={chatId}
          loadingChatId={loadingChat}
          onLoad={loadChat}
          onDelete={deleteChat}
        />
      ) : (
        <>
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

          {/* Input — composer with chip row, drop zone, paperclip, and
              category selector folded into the footer row. */}
          <div
            className="relative border-t border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900"
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              if (e.dataTransfer.files?.length) {
                addFiles(e.dataTransfer.files)
              }
            }}
          >
            {dragOver && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-md bg-indigo-50/85 text-sm font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
                Drop to attach
              </div>
            )}

            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {attachments.map((a) => (
                  <AttachmentChip
                    key={a.id}
                    attachment={a}
                    onRemove={() => removeAttachment(a.id)}
                  />
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-colors focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-indigo-500/60 dark:focus-within:ring-indigo-500/20">
              {/* Paperclip — opens file picker. Lives inside the
                  textarea card so it reads as part of the composer. */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
                aria-label="Attach files"
                title="Attach images, PDFs, Word, Excel or text files"
                className="grid h-8 w-8 shrink-0 place-items-center self-end rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-700/60 dark:hover:text-slate-100"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                accept={ACCEPT_ATTRIBUTE}
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files)
                  e.target.value = ''
                }}
              />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                placeholder={placeholder}
                rows={1}
                disabled={isGenerating}
                spellCheck={false}
                autoComplete="off"
                className="scrollbar-hide max-h-40 flex-1 resize-none self-center overflow-hidden bg-transparent py-1 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                style={{ height: 'auto' }}
              />
              {isGenerating ? (
                <button
                  type="button"
                  onClick={stop}
                  aria-label="Stop generating"
                  title="Stop generating"
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center self-end rounded-lg transition-all',
                    'bg-slate-900 text-white hover:bg-slate-700',
                    'dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white',
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={
                    anyAttachmentLoading ||
                    (!input.trim() && readyAttachments.length === 0)
                  }
                  aria-label={anyAttachmentLoading ? 'Wait for attachments to finish' : 'Send'}
                  title={anyAttachmentLoading ? 'Reading files…' : 'Send'}
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center self-end rounded-lg text-white transition-all',
                    'bg-gradient-to-br from-indigo-500 to-violet-600 shadow shadow-indigo-500/30',
                    'hover:from-indigo-600 hover:to-violet-700',
                    'disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:cursor-not-allowed',
                    'dark:disabled:from-slate-700 dark:disabled:to-slate-700',
                  )}
                >
                  <Send className="h-3.5 w-3.5 -translate-x-px translate-y-px" />
                </button>
              )}
            </div>
            {isGenerating && (
              <p className="mt-1.5 px-1 text-right text-[10px] text-slate-400 dark:text-slate-500">
                Working…
              </p>
            )}
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
    const hasAttachments = (message.attachments?.length ?? 0) > 0
    return (
      <div className="flex flex-col items-end gap-1.5">
        {/* Attachment chips above the bubble — Claude / iMessage style.
            Images render as actual thumbnails so the user can SEE
            what they sent, not just the filename. Docs render as a
            small file card. */}
        {hasAttachments && (
          <div className="flex max-w-[88%] flex-wrap justify-end gap-1.5">
            {message.attachments!.map((a, i) => (
              <UserBubbleAttachment key={i} attachment={a} />
            ))}
          </div>
        )}
        {message.content && (
          <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-600 px-3 py-1.5 text-[12px] leading-relaxed text-white shadow-sm shadow-indigo-500/20">
            {message.content}
          </div>
        )}
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
        {/* items-start for the icon so multi-line replies don't centre-align
            against the small marker. whitespace-pre-wrap so newlines and
            indentation in answer-mode replies (numbered references, etc.)
            render the way the model wrote them. */}
        <div className="flex items-start gap-1.5">
          {message.pending ? (
            <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin opacity-70" />
          ) : (
            <Icon className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
          )}
          <span className="whitespace-pre-wrap break-words">{message.content}</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// User-bubble attachment — slim version of AttachmentChip rendered
// inside the user's chat bubble area (no remove button, no skeleton —
// payloads here are always 'ready'). Images come through as proper
// thumbnails so the user can verify what they sent.
// ---------------------------------------------------------------------------

function UserBubbleAttachment({ attachment }: { attachment: AiAttachment }) {
  if (attachment.kind === 'image') {
    return (
      <div className="overflow-hidden rounded-xl border border-indigo-300/60 bg-white shadow-sm dark:border-indigo-500/30 dark:bg-slate-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          className="block max-h-48 max-w-[220px] object-cover"
        />
      </div>
    )
  }
  // Doc / text: small card with icon + name + extension badge.
  const ext = (attachment.name.split('.').pop() || '').toLowerCase()
  const isSheet = ext === 'xlsx' || ext === 'xls' || ext === 'ods' || ext === 'csv' || ext === 'tsv'
  const Icon = isSheet ? FileSpreadsheet : FileText
  return (
    <div className="flex items-center gap-2 rounded-xl border border-indigo-300/60 bg-white px-2.5 py-1.5 shadow-sm dark:border-indigo-500/30 dark:bg-slate-800">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="max-w-[160px] truncate text-[11px] font-medium text-slate-800 dark:text-slate-200">
          {attachment.name}
        </p>
        <p className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {chipBadge(attachment.name, 'text')}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composer attachment chip — shows loading skeleton, ready preview, or
// error state. Image attachments render as a square thumbnail; docs/text
// as a file-card with an extension badge.
// ---------------------------------------------------------------------------

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: ComposerAttachment
  onRemove: () => void
}) {
  const RemoveButton = () => (
    <button
      type="button"
      onClick={onRemove}
      aria-label="Remove attachment"
      // Sits INSIDE the chip frame at the top-right corner — was
      // overlapping outside (-right-1.5 -top-1.5) which broke the
      // chip outline visually and made it look distorted. Now it's a
      // small in-bounds badge with a subtle backdrop so it reads
      // cleanly against image thumbnails.
      className="absolute right-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-slate-900/80 text-white shadow-sm backdrop-blur-sm transition hover:bg-slate-900 dark:bg-slate-100/85 dark:text-slate-900 dark:hover:bg-white"
    >
      <X className="h-3 w-3" />
    </button>
  )

  // Image chips render at 72×72 (was 56×56) so the user can actually
  // see the thumbnail. Doc / text chips stay narrow horizontally —
  // they're a name + icon, no preview to size up.
  if (attachment.status === 'loading') {
    if (attachment.kind === 'image') {
      return (
        <div className="group relative h-[72px] w-[72px] shrink-0 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700">
          <RemoveButton />
        </div>
      )
    }
    return (
      <div className="group relative flex h-[60px] min-w-[140px] max-w-[200px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
        <RemoveButton />
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-slate-700 dark:text-slate-200">
            {attachment.name}
          </p>
          <p className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Reading…
          </p>
        </div>
      </div>
    )
  }

  if (attachment.status === 'error') {
    return (
      <div className="group relative flex h-[60px] min-w-[140px] max-w-[200px] items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 dark:border-red-900/50 dark:bg-red-950/30">
        <RemoveButton />
        <CircleAlert className="h-4 w-4 shrink-0 text-red-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-red-800 dark:text-red-300">
            {attachment.name}
          </p>
          <p className="truncate text-[9px] text-red-600 dark:text-red-400">
            {attachment.message}
          </p>
        </div>
      </div>
    )
  }

  // Ready
  const payload = attachment.payload
  if (payload.kind === 'image') {
    return (
      <div
        className="group relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
        title={payload.name}
      >
        <RemoveButton />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={payload.dataUrl} alt={payload.name} className="h-full w-full object-cover" />
      </div>
    )
  }

  // Text/doc — pick an icon by extension class.
  const ext = (payload.name.split('.').pop() || '').toLowerCase()
  const isSheet = ext === 'xlsx' || ext === 'xls' || ext === 'ods' || ext === 'csv' || ext === 'tsv'
  const isImage = false
  const Icon = isSheet ? FileSpreadsheet : isImage ? ImageIcon : FileText
  const accent = isSheet
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'

  return (
    <div className="group relative flex h-14 min-w-[140px] max-w-[200px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
      <RemoveButton />
      <div className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-md', accent)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-slate-800 dark:text-slate-200">
          {payload.name}
        </p>
        <p className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {chipBadge(payload.name, 'text')}
        </p>
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
