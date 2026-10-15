'use client'

import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Loader2, Maximize2, Minus, Paperclip, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import { useSearchContacts } from '@/lib/hooks/useSearchContacts'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { useContactDealSummary } from '@/lib/hooks/useContactDealSummary'
import { useSendOutlookMail } from '@/lib/hooks/useOutlook'
import type { Contact } from '@/lib/types/contacts'

interface ComposeWindowProps {
  fromEmail: string
  onClose: () => void
  /**
   * Fired after a successful send to someone who has no deal yet, carrying
   * the pipeline chosen below. The prompt itself lives on the page, because
   * this window closes the moment the message goes.
   */
  onDealOpportunity?: (opportunity: { id: string; name: string; pipelineId?: string }) => void
}

/** Highlights the typed text inside a suggestion, so it is obvious why it matched. */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term.trim()) return <>{text}</>
  const i = text.toLowerCase().indexOf(term.toLowerCase())
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-blue-500/30 text-blue-200">{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  )
}

/**
 * Compose, as a Gmail window in the corner.
 *
 * The To field takes CONTACTS ONLY. That is a deliberate restriction, not an
 * omission: every message sent from here is meant to end up on somebody's
 * record, and an address typed free-hand has nothing to attach to. A raw
 * address is refused with a message rather than silently accepted.
 */
export function ComposeWindow({ fromEmail, onClose, onDealOpportunity }: ComposeWindowProps) {
  const [minimised, setMinimised] = useState(false)
  const [maximised, setMaximised] = useState(false)
  const [recipients, setRecipients] = useState<Contact[]>([])
  const [term, setTerm] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [pipelineId, setPipelineId] = useState('none')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const debounced = useDebouncedValue(term, 200)
  const { data: found = [] } = useSearchContacts(debounced)
  const { data: pipelines = [] } = usePipelines()
  const sendMail = useSendOutlookMail()

  const options = useMemo(() => {
    const chosen = new Set(recipients.map((r) => r.id))
    return found.filter((c) => !!c.email && !chosen.has(c.id)).slice(0, 6)
  }, [found, recipients])
  const { data: summaries = {} } = useContactDealSummary(options.map((o) => o.id))

  const looksLikeEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(term.trim())
  const noContactForTyped = looksLikeEmail && options.length === 0

  const add = (contact: Contact) => {
    setRecipients((prev) => [...prev, contact])
    setTerm('')
    setHighlighted(0)
    inputRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && options[highlighted]) { e.preventDefault(); add(options[highlighted]) }
    else if (e.key === 'Backspace' && !term && recipients.length) {
      setRecipients((prev) => prev.slice(0, -1))
    }
  }

  const send = async () => {
    if (!recipients.length) return
    let sent = 0
    // The first recipient who has no deal is the one we offer to open one for.
    // Queueing a prompt per recipient would stack dialogs over each other.
    let opportunity: { id: string; name: string } | null = null

    for (const r of recipients) {
      try {
        const result = await sendMail.mutateAsync({ to: r.email as string, subject, body })
        sent++
        if (!opportunity && result.contact && !result.contact.hasDeal) {
          opportunity = { id: result.contact.id, name: result.contact.name }
        }
      } catch (error) {
        toast({
          title: `Could not send to ${r.email}`,
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        })
      }
    }
    if (sent) {
      toast({ title: `Sent to ${sent} recipient${sent === 1 ? '' : 's'}` })
      onClose()
      // Carries the pipeline chosen above, so Smart Deal opens with the
      // answer already filled in rather than asking the same question twice.
      if (opportunity) {
        onDealOpportunity?.({
          ...opportunity,
          pipelineId: pipelineId === 'none' ? undefined : pipelineId,
        })
      }
    }
  }

  if (minimised) {
    return (
      <div className="fixed bottom-0 right-6 z-[60] w-72 rounded-t-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="truncate text-sm text-slate-200">{subject || 'New message'}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setMinimised(false)} className="text-slate-400 hover:text-slate-100" aria-label="Expand">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-100" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'fixed z-[60] flex flex-col rounded-t-xl border border-slate-700 bg-slate-900 shadow-2xl',
      maximised ? 'inset-6 rounded-xl' : 'bottom-0 right-6 h-[560px] w-[560px]',
    )}>
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
        <span className="text-sm font-medium text-slate-100">New message</span>
        <div className="flex items-center gap-2 text-slate-400">
          <button onClick={() => setMinimised(true)} aria-label="Minimise"><Minus className="h-4 w-4 hover:text-slate-100" /></button>
          <button onClick={() => setMaximised((v) => !v)} aria-label="Maximise"><Maximize2 className="h-3.5 w-3.5 hover:text-slate-100" /></button>
          <button onClick={onClose} aria-label="Close"><X className="h-4 w-4 hover:text-slate-100" /></button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-2 text-sm">
          <span className="w-16 shrink-0 text-slate-500">From</span>
          <span className="truncate text-slate-300">{fromEmail}</span>
        </div>

        <div className="relative border-b border-slate-800 px-4 py-2">
          <div className="flex items-start gap-3">
            <span className="mt-1.5 w-16 shrink-0 text-sm text-slate-500">To</span>
            <div className="flex min-h-[32px] flex-1 flex-wrap items-center gap-1.5">
              {recipients.map((r) => (
                <span key={r.id} className="flex items-center gap-1.5 rounded-full bg-slate-800 py-0.5 pl-1 pr-2 text-sm">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="bg-blue-600 text-[9px] text-white">
                      {`${r.first_name?.[0] ?? ''}${r.last_name?.[0] ?? ''}`.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-slate-200">{`${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.email}</span>
                  <button
                    onClick={() => setRecipients((prev) => prev.filter((x) => x.id !== r.id))}
                    className="text-slate-500 hover:text-slate-200"
                    aria-label={`Remove ${r.email}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => { setTerm(e.target.value); setHighlighted(0) }}
                onKeyDown={onKeyDown}
                placeholder={recipients.length ? '' : 'Search contacts by name or email'}
                className="min-w-[180px] flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>

          {term.length > 1 && (
            <div className="absolute left-20 right-4 top-full z-10 mt-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
              {options.map((c, i) => {
                const pipelines = summaries[c.id]?.pipelines ?? []
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setHighlighted(i)}
                    onClick={() => add(c)}
                    className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left', i === highlighted && 'bg-slate-800')}
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="bg-slate-700 text-[10px] text-slate-200">
                        {`${c.first_name?.[0] ?? ''}${c.last_name?.[0] ?? ''}`.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-100">
                        <Highlight text={`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || (c.email as string)} term={term} />
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        <Highlight text={c.email as string} term={term} />
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-300">Player</span>
                    {pipelines.length > 0 && (
                      <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{pipelines[0]}</span>
                    )}
                  </button>
                )
              })}

              {/* Refused, with the reason. Silently accepting it would send a
                  message that lands on nobody's record. */}
              {noContactForTyped && (
                <p className="px-3 py-2 text-xs text-amber-300">
                  {term.trim()} isn&apos;t in Contacts. You can only email people saved in the CRM.
                </p>
              )}
              {!options.length && !noContactForTyped && (
                <p className="px-3 py-2 text-xs text-slate-500">No contact found.</p>
              )}
            </div>
          )}
        </div>

        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Summer Residency 2027 — places open"
          className="rounded-none border-0 border-b border-slate-800 bg-transparent px-4 text-slate-100 focus-visible:ring-0"
        />

        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Hi there,"
          className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-4 py-3 text-slate-100 focus-visible:ring-0"
        />

        <div className="flex items-center gap-3 border-t border-slate-800 px-4 py-2 text-sm">
          <span className="shrink-0 text-slate-500">Pipeline</span>
          <Select value={pipelineId} onValueChange={setPipelineId}>
            <SelectTrigger className="h-8 w-[280px] border-slate-800 bg-slate-900/60 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No pipeline — create as Initial Lead</SelectItem>
              {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-500">Optional · used by Smart Deal</span>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-800 px-4 py-3">
          <Button onClick={send} disabled={!recipients.length || sendMail.isPending}>
            {sendMail.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Send
          </Button>
          <Paperclip className="h-4 w-4 text-slate-500" />
          <span className="text-xs text-slate-500">Also saved to your Outlook Sent Items</span>
        </div>
      </div>
    </div>
  )
}
