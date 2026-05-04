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
  GitBranch,
  BarChart3,
  ReceiptText,
  Zap,
  Clock,
  BookHeart,
  Star,
  Pencil,
  Check,
  X,
  MoreHorizontal,
  Paperclip,
  FileText,
  Copy,
  RotateCcw,
  CornerUpLeft,
  Quote,
  Ghost,
  MessagesSquare,
  Search,
  CheckSquare,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useScoutChat } from '@/lib/hooks/useScoutChat'
import type { ScoutMessage, ScoutAttachment } from '@/lib/hooks/useScoutChat'
import { useToast } from '@/lib/hooks/use-toast'
import { ScoutBallIcon } from './ScoutMascot'
import { ScoutMarkdown } from './ScoutMarkdown'

// ---------------------------------------------------------------------------
// Attachment helpers
// ---------------------------------------------------------------------------

const MAX_ATTACHMENTS = 6
const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB per image (gpt-4o handles bigger but we cap to keep payload sane)
const MAX_TEXT_BYTES = 256 * 1024 // 256 KB per plain-text file
const MAX_DOC_BYTES = 25 * 1024 * 1024 // 25 MB per PDF/DOCX/XLSX (pre-extraction)
const MAX_EXTRACTED_CHARS = 200_000 // Cap extracted text per doc; huge PDFs blow the prompt otherwise
// Hard cap on COMBINED extracted text across all attachments in a single
// message. Without this, the per-doc cap doesn't stop someone from stacking
// 6 maxed-out PDFs (= ~1.2 MB of prompt text). 200 KB total ≈ 50k tokens,
// which fits comfortably alongside the system prompt + tool schemas.
const MAX_COMBINED_EXTRACTED_CHARS = 200_000
// Filename extensions we treat as plain text. Anything else falls back to
// MIME-type sniffing, then is rejected if we can't classify it.
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yml', 'yaml',
  'log', 'sql', 'env', 'ini', 'toml',
  'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'kt',
  'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'php', 'sh', 'bash', 'zsh',
  'css', 'scss', 'html', 'htm',
])

function fileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

// Composer-side wrapper around ScoutAttachment so each chip can carry an
// upload/extract status. `ready` items are what get sent to the hook on
// submit; `loading` items render as skeletons; `error` items show the
// rejection message inline so the user can dismiss and retry.
type ComposerAttachment =
  | { id: string; status: 'loading'; name: string; kind: 'image' | 'doc' | 'text' }
  | { id: string; status: 'ready'; payload: ScoutAttachment }
  | { id: string; status: 'error'; name: string; message: string }

// Map a File to the chip's "kind" so the loading skeleton matches what the
// final chip will look like (image square vs file card).
function chipKindForFile(f: File): 'image' | 'doc' | 'text' {
  if (f.type.startsWith('image/')) return 'image'
  const ext = fileExt(f.name)
  if (
    ext === 'pdf' ||
    ext === 'docx' ||
    ext === 'doc' ||
    ext === 'xlsx' ||
    ext === 'xls' ||
    ext === 'ods'
  ) {
    return 'doc'
  }
  return 'text'
}

// Pretty file-type label shown on the chip footer (matches Claude: "PDF",
// "DOCX", "XLSX", "PNG", "TXT", etc).
function chipBadge(name: string, kind: 'image' | 'text'): string {
  const ext = fileExt(name).toUpperCase()
  if (ext) return ext
  return kind === 'image' ? 'IMG' : 'TXT'
}

// Trim extracted text if it's beyond MAX_EXTRACTED_CHARS so the model prompt
// stays within reasonable bounds. The user gets a "(truncated)" suffix.
function capExtracted(text: string, name: string): string {
  if (text.length <= MAX_EXTRACTED_CHARS) return text
  return (
    text.slice(0, MAX_EXTRACTED_CHARS) +
    `\n\n…(truncated — ${name} was over ${MAX_EXTRACTED_CHARS.toLocaleString()} characters)`
  )
}

// Cap PDF rasterization to keep latency + token cost sane. 6 pages × vision
// at ~1024px is a reasonable budget for the kinds of CRM exports / contracts
// the user actually pastes here.
const MAX_RASTERIZE_PAGES = 6

// Initialise pdf.js once. Both extractors below share this singleton so we
// only set the worker URL on first use.
async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
  }
  return pdfjs
}

// Lazy-load extractors so non-doc users don't pay the bundle cost. PDF.js +
// mammoth + xlsx together are ~1.5 MB; keeping them out of the main chunk
// matters for the empty state's first paint.
//
// Returns null when the PDF has no extractable text (typically a scanned /
// image-only PDF). The caller falls back to rasterising pages so the user
// still gets an answer via vision instead of a hard error.
async function extractPdfText(file: File): Promise<string | null> {
  const pdfjs = await loadPdfJs()
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const tc = await page.getTextContent()
    const pageText = tc.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (pageText) parts.push(`--- Page ${i} ---\n${pageText}`)
    // Stop early if we're already over the cap; further pages would be
    // discarded anyway and they cost CPU.
    if (parts.join('\n\n').length > MAX_EXTRACTED_CHARS) break
  }
  const out = parts.join('\n\n').trim()
  return out || null
}

// Render the first N pages of a PDF to JPEG data URLs. Used as a fallback for
// scanned / image-only PDFs where text extraction comes back empty — GPT-4o
// can still read text from these via vision.
async function rasterizePdfPages(
  file: File,
  maxPages: number,
): Promise<ScoutAttachment[]> {
  const pdfjs = await loadPdfJs()
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const total = doc.numPages
  const limit = Math.min(total, maxPages)
  const out: ScoutAttachment[] = []
  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    out.push({
      kind: 'image',
      name: `${file.name} — page ${i}${total > limit ? ` of ${total}` : ''}`,
      dataUrl,
      // Approximate decoded byte count (base64 is ~4/3 of binary).
      size: Math.round(dataUrl.length * 0.75),
    })
  }
  if (out.length === 0) {
    throw `Couldn't read any pages from "${file.name}".`
  }
  return out
}

async function extractDocxText(file: File): Promise<string> {
  // mammoth's package.json sets a `browser` entry, so bundlers pick the
  // browser-safe build automatically. Default import works for both.
  const mammoth = await import('mammoth')
  const buf = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buf })
  const text = (result?.value ?? '').trim()
  if (!text) {
    throw `Couldn't extract any text from "${file.name}".`
  }
  return text
}

async function extractSpreadsheetText(file: File): Promise<string> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const parts: string[] = []
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    // CSV per sheet — most LLM-friendly representation for tabular data.
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim()
    if (csv) parts.push(`--- Sheet: ${sheetName} ---\n${csv}`)
    if (parts.join('\n\n').length > MAX_EXTRACTED_CHARS) break
  }
  const out = parts.join('\n\n').trim()
  if (!out) {
    throw `Couldn't read any rows from "${file.name}".`
  }
  return out
}

// Read a single browser File and return one or more ScoutAttachments. Most
// files map 1:1, but a scanned PDF expands to N image attachments (one per
// page) so the model can read the content via vision.
// Throws a string error message on rejection so the caller can surface it.
async function readAttachment(file: File): Promise<ScoutAttachment[]> {
  if (file.type.startsWith('image/')) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw `Image "${file.name}" is over 8 MB`
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject('Failed to read image')
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.readAsDataURL(file)
    })
    return [{ kind: 'image', name: file.name || 'pasted-image.png', dataUrl, size: file.size }]
  }

  const ext = fileExt(file.name)

  // PDFs / Word / Excel — extract to text on the client and ship as a 'text'
  // attachment so the rest of the pipeline doesn't need to know about
  // binary formats. We bound by file size pre-extraction and by extracted
  // chars post-extraction so giant docs can't blow the prompt.
  if (ext === 'pdf' || file.type === 'application/pdf') {
    if (file.size > MAX_DOC_BYTES) throw `PDF "${file.name}" is over 25 MB`
    const raw = await extractPdfText(file)
    if (raw) {
      return [{ kind: 'text', name: file.name, content: capExtracted(raw, file.name), size: file.size }]
    }
    // No extractable text — most likely a scanned / image-only PDF. Fall
    // back to rasterising the first few pages so vision can read them.
    return rasterizePdfPages(file, MAX_RASTERIZE_PAGES)
  }
  if (ext === 'docx' || file.type.includes('officedocument.wordprocessingml')) {
    if (file.size > MAX_DOC_BYTES) throw `Doc "${file.name}" is over 25 MB`
    const text = capExtracted(await extractDocxText(file), file.name)
    return [{ kind: 'text', name: file.name, content: text, size: file.size }]
  }
  if (ext === 'doc') {
    throw `"${file.name}" is the legacy .doc format — please save as .docx and try again.`
  }
  if (
    ext === 'xlsx' ||
    ext === 'xls' ||
    ext === 'ods' ||
    file.type.includes('spreadsheetml') ||
    file.type === 'application/vnd.ms-excel'
  ) {
    if (file.size > MAX_DOC_BYTES) throw `Spreadsheet "${file.name}" is over 25 MB`
    const text = capExtracted(await extractSpreadsheetText(file), file.name)
    return [{ kind: 'text', name: file.name, content: text, size: file.size }]
  }

  const looksTexty =
    TEXT_EXTENSIONS.has(ext) ||
    file.type.startsWith('text/') ||
    file.type === 'application/json' ||
    file.type === 'application/xml'
  if (!looksTexty) {
    throw `"${file.name}" isn't a supported file type. Upload images, PDFs, Word (.docx), spreadsheets (.xlsx/.xls), or plain text/code files.`
  }
  if (file.size > MAX_TEXT_BYTES) {
    throw `Text file "${file.name}" is over 256 KB`
  }
  const content = await file.text()
  return [{ kind: 'text', name: file.name, content, size: file.size }]
}

// Claude-style starter chips — short, categorical, with a small icon. Each
// expands to a fuller question when clicked. Keep these few; long lists make
// the empty state feel busy.
const STARTER_CHIPS: { label: string; prompt: string; icon: typeof Sparkles }[] = [
  { label: 'Pipeline', prompt: 'Who is in the Summer Residency pipeline?', icon: GitBranch },
  { label: 'Weekly recap', prompt: 'How are we doing this week?', icon: BarChart3 },
  { label: 'Unpaid', prompt: 'Show me unpaid invoices over £1,000.', icon: ReceiptText },
  { label: 'Automations', prompt: 'What automations are running on Masters 2025?', icon: Zap },
  { label: 'Stuck deals', prompt: "Who's stuck in interview stage longer than 7 days?", icon: Clock },
]

export function ScoutChatPage({ firstName = '' }: { firstName?: string }) {
  const {
    messages,
    conversations,
    conversationId,
    sending,
    loadingConversationId,
    error,
    send,
    stop,
    retryFromUser,
    regenerateAssistant,
    editAndResend,
    newConversation,
    loadConversation,
    deleteConversation,
    renameConversation,
    toggleStar,
    incognito,
    setIncognito,
  } = useScoutChat()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  // Main-pane view. 'chat' is the empty-state-or-thread view we've always
  // had; 'all-chats' is the full chats-list page (search, select, bulk
  // delete) opened from the sidebar's "All chats" button. Keeping it as
  // local state instead of a separate route avoids a sidebar refactor.
  const [view, setView] = useState<'chat' | 'all-chats'>('chat')
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const { toast } = useToast()
  // Snippets the user pulled from a previous bubble via the floating "Reply"
  // button. They render as chips above the textarea and prepend the message
  // as blockquotes on submit.
  const [quotes, setQuotes] = useState<string[]>([])
  // Anchor for the floating "Reply" tooltip when the user has selected text
  // inside a chat bubble. null = no selection / no tooltip showing.
  const [selection, setSelection] = useState<{
    text: string
    x: number
    y: number
  } | null>(null)
  // When the user clicks Edit on a user bubble, we stash the message id so
  // submit knows to call editAndResend instead of send().
  const [editingId, setEditingId] = useState<string | null>(null)
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

  // Auto-grow textarea up to a soft cap; once content exceeds the cap we
  // hand off to internal scroll so the user can still navigate their own
  // long message. (Previously overflow:hidden + cap meant the top of a
  // long message was unreachable.)
  const COMPOSER_MAX_PX = 280
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, COMPOSER_MAX_PX)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_PX ? 'auto' : 'hidden'
  }, [input])

  // Watch global text selection. When the user selects text inside a chat
  // bubble (we mark them with data-scout-bubble), we anchor a floating
  // "Reply" tooltip just above the selection. Click the tooltip → quote chip.
  //
  // Why the equality guard below: `selectionchange` fires on every keystroke
  // in the textarea (cursor moves count as selection changes). Without the
  // guard, every keystroke would commit a fresh `{x, y, text}` object even
  // when the visible selection hasn't moved — and that re-render cascade
  // could feed into Recharts' ResizeObserver in the thread above (you can
  // see the "width(-1) of chart" warning right before #185 in production).
  useEffect(() => {
    const handler = () => {
      const sel = typeof window !== 'undefined' ? window.getSelection() : null
      const text = sel ? sel.toString().trim() : ''
      let next: { text: string; x: number; y: number } | null = null
      if (sel && text) {
        const node = sel.anchorNode
        const el =
          node?.nodeType === 3
            ? (node.parentElement as HTMLElement | null)
            : (node as HTMLElement | null)
        if (el?.closest?.('[data-scout-bubble]')) {
          const range = sel.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          if (rect.width !== 0 || rect.height !== 0) {
            next = { text, x: rect.left + rect.width / 2, y: rect.top }
          }
        }
      }
      setSelection((prev) => {
        if (prev === null && next === null) return prev
        if (
          prev &&
          next &&
          prev.text === next.text &&
          prev.x === next.x &&
          prev.y === next.y
        ) {
          return prev
        }
        return next
      })
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  // Block submit while any attachment is still extracting (extraction is
  // async; sending mid-flight would drop the file). Errors are sendable —
  // we just skip them silently in the payload.
  const anyAttachmentLoading = attachments.some((a) => a.status === 'loading')
  const readyAttachments = attachments
    .filter((a): a is Extract<ComposerAttachment, { status: 'ready' }> => a.status === 'ready')
    .map((a) => a.payload)

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    // Prepend any quoted snippets as blockquotes so the model sees the
    // surrounding context the user pulled from a previous bubble.
    const composed = quotes.length
      ? quotes.map((q) => `> ${q.replace(/\n/g, '\n> ')}`).join('\n\n') +
        (text ? '\n\n' + text : '')
      : text
    if ((!composed && readyAttachments.length === 0) || sending || anyAttachmentLoading) {
      return
    }
    const sentAttachments = readyAttachments
    const editTarget = editingId
    setInput('')
    setAttachments([])
    setQuotes([])
    setEditingId(null)
    stickToBottomRef.current = true
    if (editTarget) {
      await editAndResend(editTarget, composed)
    } else {
      await send(composed, sentAttachments)
    }
    inputRef.current?.focus()
  }

  return (
    <div className="flex h-full w-full">
      {/* Sidebar — hidden entirely in incognito mode for the full-screen
          ephemeral feel (Claude does the same). */}
      {!incognito && (
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
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Scout
              </p>
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
              onClick={() => {
                newConversation()
                setView('chat')
              }}
              className="w-full justify-start bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm hover:from-indigo-600 hover:to-violet-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              New chat
            </Button>
          </div>

          {/* Quick links — Memory tab + future settings. Kept above the
              recents list so it stays visible even with a long history. */}
          <div className="px-3 pb-2">
            <Link
              href="/scout/memory"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60"
            >
              <BookHeart className="h-3.5 w-3.5 text-fuchsia-500" />
              Memory
            </Link>
          </div>

          {/* History list — split into Starred + Recent. Pinning a chat
              moves it from Recent to Starred without changing its underlying
              order; both sections are sorted by updated_at desc. */}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {conversations.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
                No chats yet — your conversations will appear here.
              </p>
            ) : (
              <>
                {conversations.some((c) => c.starred) && (
                  <ConversationSection
                    label="Starred"
                    items={conversations.filter((c) => c.starred)}
                    activeId={conversationId}
                    loadingId={loadingConversationId}
                    onLoad={(id) => {
                      loadConversation(id)
                      setView('chat')
                    }}
                    onDelete={deleteConversation}
                    onRename={renameConversation}
                    onToggleStar={toggleStar}
                  />
                )}
                <ConversationSection
                  label="Recent"
                  items={conversations.filter((c) => !c.starred)}
                  activeId={conversationId}
                  loadingId={loadingConversationId}
                  onLoad={(id) => {
                    loadConversation(id)
                    setView('chat')
                  }}
                  onDelete={deleteConversation}
                  onRename={renameConversation}
                  onToggleStar={toggleStar}
                />
              </>
            )}
          </div>

          {/* "All chats" sticky entry — opens the full chats-list main view
              with search + bulk actions. Only shown once the user has more
              than a handful of chats; small histories don't need it. */}
          {conversations.length > 6 && (
            <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setView('all-chats')}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition',
                  view === 'all-chats'
                    ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60',
                )}
              >
                <MessagesSquare className="h-3.5 w-3.5 text-fuchsia-500" />
                All chats
                <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">
                  {conversations.length}
                </span>
              </button>
            </div>
          )}

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
      )}

      {/* Main */}
      <main
        className={cn(
          'relative flex h-full flex-1 flex-col',
          // Incognito gives the main pane a deeper, almost-black background
          // so it visually contrasts with the lighter banner above (mirrors
          // Claude's full-screen incognito layout).
          incognito && 'bg-slate-950',
        )}
      >
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

        {/* Incognito banner — full-width top strip when in temporary chat
            mode. Ghost icon + label on the left, X (exit) on the right.
            Replaces the floating toggle while incognito is on. */}
        {incognito && (
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <Ghost className="h-4 w-4" />
              Incognito chat
            </div>
            <button
              type="button"
              onClick={() => {
                // Exit incognito and clear the ephemeral conversation so
                // the next thread starts persistent and fresh.
                newConversation()
              }}
              aria-label="Exit incognito chat"
              title="Exit incognito chat"
              className="grid h-7 w-7 place-items-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* When NOT in incognito, show the small toggle in the top-right so
            the user can flip it on. Hidden once a real chat has started so
            we don't switch persistence mode mid-thread. */}
        {!incognito && messages.length === 0 && (
          <div className="pointer-events-none absolute right-3 top-3 z-20">
            <button
              type="button"
              onClick={() => setIncognito(true)}
              title="Start a temporary chat — won't be saved to history or memory"
              className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition-all hover:border-fuchsia-300 hover:text-fuchsia-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:text-fuchsia-300"
            >
              <Ghost className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* When there are no messages we render a Claude-style centered
            empty state — greeting + composer + chips, vertically centered.
            When chatting, we fall back to a scrolling thread + sticky
            bottom composer. */}
        {view === 'all-chats' ? (
          <AllChatsView
            conversations={conversations}
            onOpenChat={(id) => {
              loadConversation(id)
              setView('chat')
            }}
            onNewChat={() => {
              newConversation()
              setView('chat')
            }}
            onRename={renameConversation}
            onToggleStar={toggleStar}
            onDelete={deleteConversation}
            onClose={() => setView('chat')}
          />
        ) : loadingConversationId ? (
          <ChatSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4">
            <div className="w-full max-w-2xl">
              {incognito ? (
                <IncognitoGreeting />
              ) : (
                <ScoutGreeting firstName={firstName} />
              )}
              <Composer
                inputRef={inputRef}
                input={input}
                setInput={setInput}
                attachments={attachments}
                setAttachments={setAttachments}
                quotes={quotes}
                setQuotes={setQuotes}
                editing={!!editingId}
                onCancelEdit={() => {
                  setEditingId(null)
                  setInput('')
                }}
                anyLoading={anyAttachmentLoading}
                sending={sending}
                onSubmit={handleSubmit}
                onStop={stop}
                large
              />
              {incognito ? (
                <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
                  Incognito chats aren&apos;t saved to history, added to
                  memory, or used to train the model.
                </p>
              ) : (
                <ChipRow onPick={(p) => send(p)} disabled={sending} />
              )}
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRootRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl px-4 py-6">
                <div className="space-y-6">
                  {messages.map((m) => (
                    <Bubble
                      key={m.id}
                      message={m}
                      sending={sending}
                      onCopy={(text) => navigator.clipboard?.writeText(text)}
                      onRetry={() => {
                        if (m.role === 'user') retryFromUser(m.id)
                        else regenerateAssistant(m.id)
                      }}
                      onEdit={
                        m.role === 'user'
                          ? () => {
                              setEditingId(m.id)
                              setInput(m.content)
                              setQuotes([])
                              inputRef.current?.focus()
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="mx-auto w-full max-w-3xl px-4">
                <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              </div>
            )}

            <div className="px-4 pb-4 pt-2">
              <div className="mx-auto w-full max-w-3xl">
                <ConversationLengthWarning
                  messageCount={messages.length}
                  onNewChat={newConversation}
                />
                <Composer
                  inputRef={inputRef}
                  input={input}
                  setInput={setInput}
                  attachments={attachments}
                  setAttachments={setAttachments}
                  quotes={quotes}
                  setQuotes={setQuotes}
                  editing={!!editingId}
                  onCancelEdit={() => {
                    setEditingId(null)
                    setInput('')
                  }}
                  anyLoading={anyAttachmentLoading}
                  sending={sending}
                  onSubmit={handleSubmit}
                  onStop={stop}
                />
                <p className="mt-2 px-1 text-[10px] text-slate-400 dark:text-slate-500">
                  Scout reads live data — Enter to send, Shift+Enter for a new line.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Floating "Reply" tooltip — appears just above any text selection
            inside a chat bubble. Clicking it pulls the selected text into a
            quote chip in the composer. */}
        {selection && (
          <button
            type="button"
            onMouseDown={(e) => {
              // Prevent the click from clearing the selection before we read it.
              e.preventDefault()
            }}
            onClick={() => {
              setQuotes((prev) => [...prev, selection.text])
              setSelection(null)
              window.getSelection?.()?.removeAllRanges()
              inputRef.current?.focus()
            }}
            style={{
              position: 'fixed',
              left: selection.x,
              top: Math.max(8, selection.y - 36),
              transform: 'translateX(-50%)',
              zIndex: 50,
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-lg transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <CornerUpLeft className="h-3 w-3" />
            Reply
          </button>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------

// Display-serif greeting with an inline accent icon. When the page knows the
// user's first name (passed in from the server component), we open with
// "Hi <first name>, I'm Scout." — a small per-super_admin personalization.
function ScoutGreeting({ firstName }: { firstName: string }) {
  const greeting = firstName ? `Hi ${firstName}, I'm Scout.` : "Hi, I'm Scout."
  return (
    <div className="mb-5 flex items-center justify-center gap-3">
      <Sparkles className="h-7 w-7 text-fuchsia-400" strokeWidth={1.5} />
      <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
        {greeting}
      </h1>
    </div>
  )
}

// Incognito variant of the greeting — Claude's "Let's chat incognito" copy.
// No firstName here on purpose; the whole point of the mode is anonymity.
function IncognitoGreeting() {
  return (
    <div className="mb-5 flex items-center justify-center gap-3">
      <Sparkles className="h-7 w-7 text-fuchsia-400" strokeWidth={1.5} />
      <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
        Let&apos;s chat incognito
      </h1>
    </div>
  )
}

// Pill-row of starter prompts — small, ghost-bordered, with a leading icon.
// Mirrors the row of "Write / Learn / Code / Life stuff / Claude's choice"
// chips on Claude's empty state.
function ChipRow({ onPick, disabled }: { onPick: (s: string) => void; disabled?: boolean }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
      {STARTER_CHIPS.map(({ label, prompt, icon: Icon }) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          onClick={() => onPick(prompt)}
          title={prompt}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/70 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:border-fuchsia-500/50 dark:hover:bg-fuchsia-950/30 dark:hover:text-fuchsia-200"
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {label}
        </button>
      ))}
    </div>
  )
}

// Reusable composer card — used both in the centered empty state (large=true,
// 3 visible rows, no halo) and in the bottom-anchored chatting state (compact,
// 1 row autogrow). Single source of input markup so style stays consistent.
//
// Supports image + text-file attachments via:
//   • paperclip button (file picker)
//   • paste (clipboard images)
//   • drag-and-drop onto the composer card
//
// While `sending` is true the send button swaps to a Stop button.
function Composer({
  inputRef,
  input,
  setInput,
  attachments,
  setAttachments,
  quotes,
  setQuotes,
  editing,
  onCancelEdit,
  anyLoading,
  sending,
  onSubmit,
  onStop,
  large,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  input: string
  setInput: (v: string) => void
  attachments: ComposerAttachment[]
  setAttachments: React.Dispatch<React.SetStateAction<ComposerAttachment[]>>
  quotes: string[]
  setQuotes: React.Dispatch<React.SetStateAction<string[]>>
  editing: boolean
  onCancelEdit: () => void
  anyLoading: boolean
  sending: boolean
  onSubmit: (e?: React.FormEvent) => void
  onStop?: () => void
  large?: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const { toast } = useToast()
  // Mirror in a ref so the parallel readAttachment resolutions can read the
  // running total without re-rendering / stale closures.
  const attachmentsRef = useRef<ComposerAttachment[]>(attachments)
  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  const showError = (msg: string) => {
    toast({ title: 'Attachment', description: msg, variant: 'destructive' })
  }

  // Drop placeholder chips into state immediately so the user sees a
  // skeleton for each file, then resolve all extractions in parallel and
  // patch each row by its placeholder id when it lands. Errors get an
  // `error` chip so the user can dismiss and retry without losing the
  // others.
  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return
    const room = MAX_ATTACHMENTS - attachments.length
    if (room <= 0) {
      showError(`Up to ${MAX_ATTACHMENTS} attachments per message.`)
      return
    }
    if (list.length > room) {
      showError(
        `Only added the first ${room} — limit is ${MAX_ATTACHMENTS} per message.`,
      )
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
        (payloads) => {
          if (payloads.length === 0) return
          const first = payloads[0]
          // Enforce the per-message combined extracted-text cap. If adding
          // this payload would put the total over the limit, surface a toast
          // and mark the chip as error (don't silently drop — the user
          // needs to know why their attachment didn't land).
          if (first.kind === 'text') {
            const currentTotal = attachmentsRef.current.reduce((sum, a) => {
              if (a.status === 'ready' && a.payload.kind === 'text') {
                return sum + a.payload.content.length
              }
              return sum
            }, 0)
            if (currentTotal + first.content.length > MAX_COMBINED_EXTRACTED_CHARS) {
              const remainingKB = Math.max(
                0,
                Math.round((MAX_COMBINED_EXTRACTED_CHARS - currentTotal) / 1024),
              )
              showError(
                `"${first.name}" pushes the message past the combined ${Math.round(
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
          // Replace the placeholder with the first ready chip, then splice
          // the extras (e.g. additional rasterised PDF pages) in right
          // after it so they stay grouped together visually.
          const extras: ComposerAttachment[] = payloads.slice(1).map((p) => ({
            id:
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : Math.random().toString(36).slice(2),
            status: 'ready',
            payload: p,
          }))
          setAttachments((prev) => {
            const next: ComposerAttachment[] = []
            for (const a of prev) {
              if (a.id === placeholder.id) {
                next.push({ id: placeholder.id, status: 'ready', payload: first })
                for (const e of extras) next.push(e)
              } else {
                next.push(a)
              }
            }
            return next
          })
        },
        (err) => {
          // The inline chip already surfaces this message in red — don't
          // also fire a destructive toast or the user gets the same text
          // twice (chip + bottom-right popup).
          const message = typeof err === 'string' ? err : 'Could not read file'
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

  const onPickClick = () => fileInputRef.current?.click()

  const onPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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
      await addFiles(files)
    }
  }

  const removeById = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id))

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files?.length) {
            await addFiles(e.dataTransfer.files)
          }
        }}
        className={cn(
          // Stacked: chips on top → textarea full-width → footer row of
          // actions below. No more buttons floating in opposite corners
          // with a tall empty middle.
          'relative flex flex-col rounded-3xl border bg-white px-4 pt-3 pb-2 shadow-sm transition-colors',
          'border-slate-200 focus-within:border-fuchsia-300',
          'dark:border-slate-700/70 dark:bg-slate-800/60 dark:focus-within:border-fuchsia-500/50',
          dragOver && 'border-fuchsia-400 ring-2 ring-fuchsia-300/60 dark:border-fuchsia-400',
        )}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-3xl bg-fuchsia-50/80 text-sm font-medium text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-200">
            Drop to attach
          </div>
        )}

        {/* Editing banner — shown while the user is rewriting a previous
            message via the bubble's edit action. Cancel restores normal
            send mode without re-running anything. */}
        {editing && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-fuchsia-300 bg-fuchsia-50 px-2.5 py-1.5 text-[11px] font-medium text-fuchsia-700 dark:border-fuchsia-700/50 dark:bg-fuchsia-950/30 dark:text-fuchsia-200">
            <span>Editing a previous message — submit to rewrite & re-run.</span>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/40"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Quote chips — snippets the user pulled from a previous bubble
            via "Reply". Each shows the first ~80 chars + an X to remove. */}
        {quotes.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {quotes.map((q, i) => (
              <div
                key={i}
                className="group relative inline-flex max-w-[20rem] items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-700 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-200"
              >
                <Quote className="mt-0.5 h-3 w-3 shrink-0 text-fuchsia-500" />
                <span className="line-clamp-3 break-words leading-snug">
                  {q}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setQuotes((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  aria-label="Remove quote"
                  className="ml-1 grid h-4 w-4 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <AttachmentChip
                key={a.id}
                attachment={a}
                onRemove={() => removeById(a.id)}
              />
            ))}
          </div>
        )}

        {/* Full-width textarea — fills the card; no buttons crowding it. */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit()
            }
          }}
          rows={large ? 2 : 1}
          placeholder={large ? 'How can I help you today?' : 'Reply to Scout…'}
          spellCheck={false}
          autoComplete="off"
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          style={{ height: 'auto' }}
          disabled={sending}
        />

        {/* Footer row: paperclip on the left, send/stop on the right.
            Sits flush at the bottom of the card so the layout reads as a
            single cohesive composer rather than three floating elements. */}
        <div className="mt-1 flex items-center justify-between">
          <button
            type="button"
            onClick={onPickClick}
            disabled={sending}
            aria-label="Attach files"
            title="Attach images or text files"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-700/60 dark:hover:text-slate-100"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept="image/*,.pdf,.docx,.xlsx,.xls,.ods,.txt,.md,.markdown,.csv,.tsv,.json,.xml,.yml,.yaml,.log,.sql,.env,.ini,.toml,.js,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.kt,.c,.cc,.cpp,.h,.hpp,.cs,.php,.sh,.bash,.zsh,.css,.scss,.html,.htm"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files)
              e.target.value = ''
            }}
          />

          {sending && onStop ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              title="Stop generating"
              className={cn(
                'grid h-8 w-8 place-items-center rounded-full transition-all',
                'bg-slate-900 text-white hover:bg-slate-700',
                'dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white',
              )}
            >
              <span className="h-2.5 w-2.5 rounded-[2px] bg-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={
                sending ||
                anyLoading ||
                (!input.trim() &&
                  !attachments.some((a) => a.status === 'ready') &&
                  quotes.length === 0)
              }
              aria-label={anyLoading ? 'Wait for attachments to finish' : 'Send'}
              title={anyLoading ? 'Reading files…' : 'Send'}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-full text-white transition-all',
                'bg-slate-900 dark:bg-slate-100 dark:text-slate-900',
                'hover:bg-slate-700 dark:hover:bg-white',
                'disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed',
                'dark:disabled:bg-slate-700 dark:disabled:text-slate-500',
              )}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 -translate-x-px translate-y-px" />
              )}
            </button>
          )}
        </div>
      </div>
    </form>
  )
}

// Claude-style attachment chip. Three render branches:
//   loading — shimmer skeleton matching the kind (image square / file card)
//   error   — red-tinted card with the rejection message
//   ready   — full preview: image thumb or file card with type badge
//
// Image chips and file cards share the same outer footprint (~7rem wide)
// so the row reads as a uniform grid even when mixed.
function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: ComposerAttachment
  onRemove: () => void
}) {
  const removeBtn = (
    <button
      type="button"
      onClick={onRemove}
      aria-label="Remove attachment"
      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-slate-900/80 text-white opacity-0 transition group-hover:opacity-100"
    >
      <X className="h-3 w-3" />
    </button>
  )

  if (attachment.status === 'loading') {
    if (attachment.kind === 'image') {
      return (
        <div className="group relative h-[6.5rem] w-[6.5rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700/60 dark:bg-slate-800">
          <div className="h-full w-full animate-pulse bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800" />
          {removeBtn}
        </div>
      )
    }
    // doc / text loading skeleton
    return (
      <div className="group relative flex h-[6.5rem] w-[11rem] flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700/60 dark:bg-slate-800">
        <div className="space-y-1.5">
          <div className="h-2.5 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin text-fuchsia-500" />
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {attachment.kind === 'doc' ? 'Reading…' : 'Loading…'}
          </span>
        </div>
        {removeBtn}
      </div>
    )
  }

  if (attachment.status === 'error') {
    return (
      <div className="group relative flex h-[6.5rem] w-[11rem] flex-col justify-between rounded-xl border border-red-200 bg-red-50 p-2.5 dark:border-red-900/50 dark:bg-red-950/30">
        <p className="line-clamp-3 text-[11px] font-medium leading-tight text-red-700 dark:text-red-300">
          {attachment.message}
        </p>
        <span className="truncate text-[10px] text-red-500/80 dark:text-red-300/80">
          {attachment.name}
        </span>
        {removeBtn}
      </div>
    )
  }

  // ready
  const a = attachment.payload
  if (a.kind === 'image') {
    return (
      <div className="group relative h-[6.5rem] w-[6.5rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.dataUrl} alt={a.name} className="h-full w-full object-cover" />
        {removeBtn}
      </div>
    )
  }
  const badge = chipBadge(a.name, a.kind)
  return (
    <div className="group relative flex h-[6.5rem] w-[11rem] flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700/60 dark:bg-slate-900">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-500" />
        <p className="line-clamp-3 break-words font-semibold leading-tight text-slate-800 dark:text-slate-100">
          {a.name}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="rounded-md border border-slate-300 px-1.5 py-px text-[9px] font-bold tracking-wider text-slate-500 dark:border-slate-600 dark:text-slate-400">
          {badge}
        </span>
        <span className="text-[10px] text-slate-400">
          {Math.max(1, Math.round(a.size / 1024))} KB
        </span>
      </div>
      {removeBtn}
    </div>
  )
}

function Bubble({
  message,
  sending,
  onCopy,
  onRetry,
  onEdit,
}: {
  message: ScoutMessage
  sending: boolean
  onCopy: (text: string) => void
  onRetry: () => void
  onEdit?: () => void
}) {
  const isUser = message.role === 'user'
  const isEmpty = !message.content && message.pending
  // Hide actions for the message that's still being streamed; nothing to
  // copy / retry yet.
  const showActions = !message.pending && !!message.content

  if (isUser) {
    const images = (message.attachments ?? []).filter((a) => a.kind === 'image')
    const files = (message.attachments ?? []).filter((a) => a.kind === 'text')
    return (
      <div className="group/bubble flex flex-col items-end gap-2">
        {images.length > 0 && (
          <div className="flex max-w-[80%] flex-wrap justify-end gap-2">
            {images.map((a, i) => (
              <a
                key={i}
                href={a.kind === 'image' ? a.dataUrl : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="h-32 w-32 overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-700/60"
                title={a.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.kind === 'image' ? a.dataUrl : ''}
                  alt={a.name}
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        )}
        {files.length > 0 && (
          <div className="flex max-w-[80%] flex-wrap justify-end gap-2">
            {files.map((a, i) => (
              <span
                key={i}
                className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-200"
                title={a.name}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-fuchsia-500" />
                <span className="truncate font-medium">{a.name}</span>
              </span>
            ))}
          </div>
        )}
        {message.content && (
          <UserBubbleContent content={message.content} />
        )}
        {showActions && (
          <BubbleActions
            createdAt={message.createdAt}
            sending={sending}
            onCopy={() => onCopy(message.content)}
            onRetry={onRetry}
            onEdit={onEdit}
            align="end"
          />
        )}
      </div>
    )
  }
  return (
    <div className="group/bubble flex items-start gap-3">
      <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-sm">
        <ScoutBallIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1.5">
        <div
          data-scout-bubble
          className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-100"
        >
          {isEmpty ? <TypingDots /> : <ScoutMarkdown text={message.content} />}
        </div>
        {showActions && (
          <BubbleActions
            createdAt={message.createdAt}
            sending={sending}
            onCopy={() => onCopy(message.content)}
            onRetry={onRetry}
            align="start"
          />
        )}
      </div>
    </div>
  )
}

// Hover-revealed action row under each bubble. Date on the left, then the
// action icons. We use group-hover/bubble to stay scoped to the parent so
// hovering one bubble doesn't reveal everyone's actions.
function BubbleActions({
  createdAt,
  sending,
  onCopy,
  onRetry,
  onEdit,
  align,
}: {
  createdAt?: string
  sending: boolean
  onCopy: () => void
  onRetry: () => void
  onEdit?: () => void
  align: 'start' | 'end'
}) {
  const [copied, setCopied] = useState(false)
  const date = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-1 text-[11px] text-slate-400 opacity-0 transition group-hover/bubble:opacity-100 dark:text-slate-500',
        align === 'end' ? 'justify-end' : 'justify-start',
      )}
    >
      {date && <span className="select-none">{date}</span>}
      <button
        type="button"
        onClick={() => {
          onRetry()
        }}
        disabled={sending}
        title="Retry"
        className="rounded p-1 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          disabled={sending}
          title="Edit"
          className="rounded p-1 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={async () => {
          onCopy()
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }}
        title={copied ? 'Copied' : 'Copy'}
        className="rounded p-1 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// All-chats view: searchable list of every saved conversation, with select
// mode for bulk delete and a per-row "..." menu for star / rename / delete.
// Lives inside /scout (no separate route) — the main pane swaps to this when
// the user clicks "All chats" in the sidebar.
// ---------------------------------------------------------------------------

function AllChatsView({
  conversations,
  onOpenChat,
  onNewChat,
  onRename,
  onToggleStar,
  onDelete,
  onClose,
}: {
  conversations: Array<{
    id: string
    title: string | null
    starred?: boolean
    updated_at: string
  }>
  onOpenChat: (id: string) => void
  onNewChat: () => void
  onRename: (id: string, title: string) => void | Promise<void>
  onToggleStar: (id: string, starred: boolean) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const q = query.trim().toLowerCase()
  const filtered = q
    ? conversations.filter((c) => (c.title ?? '').toLowerCase().includes(q))
    : conversations

  // Keep starred chats up top so the list mirrors the sidebar layout.
  const sorted = [...filtered].sort((a, b) => {
    if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const requestBulkDelete = () => {
    if (selected.size === 0) return
    setConfirmOpen(true)
  }

  const handleBulkDelete = async () => {
    setConfirmOpen(false)
    if (selected.size === 0) return
    setBulkDeleting(true)
    try {
      // Existing DELETE endpoint takes one id; fan out in parallel for speed.
      await Promise.all(Array.from(selected).map((id) => onDelete(id)))
      exitSelectMode()
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header: title + New chat (right). Mirrors Claude's all-chats page. */}
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900 dark:text-slate-100">
              Chats
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {conversations.length} saved {conversations.length === 1 ? 'chat' : 'chats'}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Close all chats"
            >
              <X className="h-4 w-4" />
            </button>
            <Button
              onClick={onNewChat}
              className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New chat
            </Button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your chats…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-fuchsia-300 focus:outline-none dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Section header with Select toggle / bulk actions */}
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Your chats with Scout
          </span>
          {selectMode ? (
            <div className="flex items-center gap-3">
              <span className="text-slate-500 dark:text-slate-400">
                {selected.size} selected
              </span>
              <button
                type="button"
                onClick={requestBulkDelete}
                disabled={selected.size === 0 || bulkDeleting}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
              >
                {bulkDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Delete
              </button>
              <button
                type="button"
                onClick={exitSelectMode}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              className="inline-flex items-center gap-1 font-medium text-fuchsia-600 hover:underline dark:text-fuchsia-300"
            >
              <CheckSquare className="h-3 w-3" />
              Select
            </button>
          )}
        </div>

        {/* List */}
        {sorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            {q ? 'No chats match that search.' : 'No chats yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/40">
            {sorted.map((c) => (
              <li
                key={c.id}
                className="group flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-fuchsia-600"
                  />
                )}

                {renamingId === c.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (renameDraft.trim()) {
                            onRename(c.id, renameDraft.trim())
                          }
                          setRenamingId(null)
                        } else if (e.key === 'Escape') {
                          setRenamingId(null)
                        }
                      }}
                      autoFocus
                      className="flex-1 rounded-md border border-fuchsia-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none dark:border-fuchsia-500/60 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (renameDraft.trim()) onRename(c.id, renameDraft.trim())
                        setRenamingId(null)
                      }}
                      className="text-emerald-600 hover:text-emerald-700"
                      title="Save"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="text-slate-500 hover:text-slate-700"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectMode) {
                        toggleSelect(c.id)
                      } else {
                        onOpenChat(c.id)
                      }
                    }}
                    className="flex flex-1 cursor-pointer flex-col items-start text-left"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {c.starred && (
                        <Star
                          className="h-3 w-3 text-amber-500"
                          fill="currentColor"
                        />
                      )}
                      {c.title || 'Untitled chat'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Last message{' '}
                      {formatRelativeDate(c.updated_at)}
                    </span>
                  </button>
                )}

                {!selectMode && renamingId !== c.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 opacity-0 transition hover:text-slate-700 group-hover:opacity-100 dark:hover:text-slate-200"
                        title="More"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onSelect={() => onToggleStar(c.id, !c.starred)}
                      >
                        <Star
                          className={cn(
                            'mr-2 h-4 w-4',
                            c.starred ? 'text-amber-500' : 'text-slate-500',
                          )}
                          fill={c.starred ? 'currentColor' : 'none'}
                        />
                        {c.starred ? 'Unstar' : 'Star'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          setRenamingId(c.id)
                          setRenameDraft(c.title ?? '')
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-700"
                        onSelect={() => onDelete(c.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Custom confirm for bulk delete — replaces window.confirm so the
          modal matches the rest of the app's dark UI instead of a native
          browser dialog that ignores theme. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selected.size} chat{selected.size > 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Selected conversations and their
              messages will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// "5 minutes ago" / "2 days ago" / etc. Cheap and avoids pulling in date-fns
// just for one site. Falls back to absolute date for anything older than ~30d.
function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const s = Math.max(0, Math.floor((now - then) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`
  const d = Math.floor(s / 86_400)
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString()
}

// Splits a user message into leading quoted blocks + body. Each contiguous
// run of `> `-prefixed lines becomes one quote group; once we hit a non-`> `
// line, everything from there on is the body. The LLM still sees the raw
// markdown blockquote — this only changes how the user's own bubble renders
// so the `>` characters don't show up literally.
function parseUserQuotes(content: string): { quotes: string[]; body: string } {
  const lines = content.split('\n')
  const quotes: string[] = []
  let i = 0
  while (i < lines.length) {
    if (!lines[i].startsWith('>')) break
    const group: string[] = []
    while (i < lines.length && lines[i].startsWith('>')) {
      group.push(lines[i].replace(/^>\s?/, ''))
      i++
    }
    if (group.join('\n').trim()) quotes.push(group.join('\n').trim())
    // Eat one separator blank line between consecutive quote groups.
    if (i < lines.length && lines[i].trim() === '') i++
  }
  const body = lines.slice(i).join('\n').trim()
  return { quotes, body }
}

function UserBubbleContent({ content }: { content: string }) {
  const { quotes, body } = parseUserQuotes(content)
  return (
    <div data-scout-bubble className="flex max-w-[80%] flex-col items-end gap-1.5">
      {quotes.map((q, i) => (
        <div
          key={i}
          className="w-full rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-[12px] leading-snug text-white/90 backdrop-blur-sm"
        >
          <div className="flex items-start gap-1.5">
            <Quote className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
            <span className="whitespace-pre-wrap break-words">{q}</span>
          </div>
        </div>
      ))}
      {body && (
        <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-md shadow-indigo-500/20">
          {body}
        </div>
      )}
    </div>
  )
}

// Thresholds expressed in raw message count (1 turn = 1 user + 1 assistant
// = 2 messages). 80 ≈ 40 turns (soft), 120 ≈ 60 turns (hard). Pure heuristic
// — token cost actually depends on tool result sizes, but message count is
// a fine proxy for "this thread is getting heavy".
const SOFT_TURN_THRESHOLD = 80
const HARD_TURN_THRESHOLD = 120

function ConversationLengthWarning({
  messageCount,
  onNewChat,
}: {
  messageCount: number
  onNewChat: () => void
}) {
  if (messageCount < SOFT_TURN_THRESHOLD) return null
  const hard = messageCount >= HARD_TURN_THRESHOLD
  return (
    <div
      className={cn(
        'mb-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[11px]',
        hard
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'
          : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300',
      )}
    >
      <span>
        {hard
          ? "This conversation is very long — Scout's answers may slow down or lose detail. Start a fresh chat for sharper context."
          : 'Long conversation — context is getting heavy. A new chat will give Scout a fresh start.'}
      </span>
      <button
        type="button"
        onClick={onNewChat}
        className={cn(
          'shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium transition',
          hard
            ? 'border-red-300 bg-white text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/40'
            : 'border-amber-300 bg-white text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40',
        )}
      >
        Start new chat
      </button>
    </div>
  )
}

// Loading skeleton shown in the main pane while loadConversation is fetching
// a thread from the server. Same column width as the real thread, alternating
// user (right) and assistant (left) shimmer bubbles so it telegraphs "chat
// is loading" instead of an ambiguous spinner.
function ChatSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
          {/* user bubble */}
          <div className="flex justify-end">
            <div className="h-9 w-40 animate-pulse rounded-2xl rounded-br-md bg-slate-200 dark:bg-slate-700/60" />
          </div>
          {/* assistant bubble */}
          <div className="flex items-start gap-3">
            <div className="mt-1 h-7 w-7 shrink-0 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700/60" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700/60" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700/60" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-700/60" />
            </div>
          </div>
          {/* user bubble */}
          <div className="flex justify-end">
            <div className="h-9 w-56 animate-pulse rounded-2xl rounded-br-md bg-slate-200 dark:bg-slate-700/60" />
          </div>
          {/* assistant bubble */}
          <div className="flex items-start gap-3">
            <div className="mt-1 h-7 w-7 shrink-0 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700/60" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700/60" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700/60" />
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 pt-2">
        <div className="mx-auto h-12 w-full max-w-3xl animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800/40" />
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
// Sidebar: starred / recent sections with inline rename + star toggle.
// ---------------------------------------------------------------------------

interface ConversationItem {
  id: string
  title: string | null
  starred?: boolean
  updated_at: string
}

function ConversationSection({
  label,
  items,
  activeId,
  loadingId,
  onLoad,
  onDelete,
  onRename,
  onToggleStar,
}: {
  label: string
  items: ConversationItem[]
  activeId: string | null
  loadingId: string | null
  onLoad: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onToggleStar: (id: string, starred: boolean) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="mb-2">
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((c) => (
          <ConversationRow
            key={c.id}
            item={c}
            active={c.id === activeId}
            loading={c.id === loadingId}
            onLoad={onLoad}
            onDelete={onDelete}
            onRename={onRename}
            onToggleStar={onToggleStar}
          />
        ))}
      </div>
    </div>
  )
}

function ConversationRow({
  item,
  active,
  loading,
  onLoad,
  onDelete,
  onRename,
  onToggleStar,
}: {
  item: ConversationItem
  active: boolean
  loading: boolean
  onLoad: (id: string) => void
  onDelete: (id: string) => Promise<void> | void
  onRename: (id: string, title: string) => void
  onToggleStar: (id: string, starred: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.title ?? '')
  // Track in-flight delete so the row can show a spinner and lock other
  // affordances. The row usually unmounts on success, but we still flip the
  // state back in `finally` for the rare case where the request fails.
  const [deleting, setDeleting] = useState(false)

  // Keep local draft in sync if the title changes from elsewhere (e.g. when a
  // new conversation gets its first auto-derived title from the server).
  useEffect(() => {
    if (!editing) setDraft(item.title ?? '')
  }, [item.title, editing])

  const commitRename = () => {
    const t = draft.trim()
    if (t && t !== (item.title ?? '')) onRename(item.id, t)
    setEditing(false)
  }

  return (
    <div
      onClick={() => !editing && !deleting && onLoad(item.id)}
      className={cn(
        'group flex items-center gap-1.5 rounded-md px-2 py-2 transition',
        deleting
          ? 'cursor-wait opacity-60'
          : 'cursor-pointer',
        active
          ? 'bg-indigo-50 dark:bg-indigo-900/30'
          : !deleting && 'hover:bg-slate-100 dark:hover:bg-slate-800/60',
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-fuchsia-500" />
      ) : (
        <MessageSquareText
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            active ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400',
          )}
        />
      )}

      {editing ? (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitRename()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setEditing(false)
                setDraft(item.title ?? '')
              }
            }}
            autoFocus
            className="flex-1 rounded border border-indigo-300 bg-white px-1.5 py-0.5 text-xs text-slate-900 focus:outline-none dark:border-indigo-500/60 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); commitRename() }}
            className="text-emerald-600 hover:text-emerald-700"
            title="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setEditing(false)
              setDraft(item.title ?? '')
            }}
            className="text-slate-500 hover:text-slate-700"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <>
          <span className="truncate flex-1 text-xs font-medium text-slate-800 dark:text-slate-100">
            {item.title || 'Untitled chat'}
          </span>

          {/* Starred chats show the inline gold star — clickable to unstar
              directly without opening the menu. The same toggle is also in
              the dropdown for symmetry with the "Star" action on Recent. */}
          {item.starred && !deleting && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleStar(item.id, false)
              }}
              className="shrink-0 text-amber-500 transition hover:text-amber-600"
              title="Unstar"
            >
              <Star className="h-3.5 w-3.5" fill="currentColor" />
            </button>
          )}

          {deleting ? (
            <Loader2
              className="h-3.5 w-3.5 shrink-0 animate-spin text-red-500"
              aria-label="Deleting…"
            />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="text-slate-400 opacity-0 transition hover:text-slate-700 group-hover:opacity-100 dark:hover:text-slate-200 data-[state=open]:opacity-100"
                  title="More"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
                className="w-40"
              >
                <DropdownMenuItem
                  onSelect={() => onToggleStar(item.id, !item.starred)}
                >
                  <Star
                    className={cn(
                      'mr-2 h-4 w-4',
                      item.starred ? 'text-amber-500' : 'text-slate-500',
                    )}
                    fill={item.starred ? 'currentColor' : 'none'}
                  />
                  {item.starred ? 'Unstar' : 'Star'}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-700"
                  onSelect={async (e) => {
                    // Radix closes the menu on select; the spinner replaces
                    // the trigger via the deleting flag below.
                    e.preventDefault()
                    setDeleting(true)
                    try {
                      await onDelete(item.id)
                    } finally {
                      setDeleting(false)
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>
      )}
    </div>
  )
}
