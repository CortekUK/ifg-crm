'use client'

import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { BookOpen, FileText, Loader2, Maximize2, Minus, Paperclip, Send, UserPlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import { useSearchContacts } from '@/lib/hooks/useSearchContacts'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { useContactDealSummary } from '@/lib/hooks/useContactDealSummary'
import { useSendOutlookMail } from '@/lib/hooks/useOutlook'
import {
  AttachedChip, BrochurePicker, TemplatePicker, type Picked,
} from '@/components/outlook/ComposeAttach'
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
 * The To field prefers contacts and suggests them as you type, but it does
 * take an address nobody has met yet — cold outreach is most of what a
 * recruiter does, and the send route creates the contact at the moment the
 * message goes, so nothing lands on nobody's record. Refusing the address
 * outright, as this used to, blocked the case the feature was built for.
 */

/** Someone in the To field: an existing contact, or an address typed in. */
interface Recipient {
  id: string
  email: string
  name: string
  /** True until the send route creates the contact row. */
  isNew: boolean
}

function recipientFromContact(contact: Contact): Recipient {
  return {
    id: contact.id,
    email: contact.email as string,
    name: `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || (contact.email as string),
    isNew: false,
  }
}

function initialsOf(recipient: Recipient): string {
  return (
    recipient.name
      .split(/[\s@.]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  )
}

export function ComposeWindow({ fromEmail, onClose, onDealOpportunity }: ComposeWindowProps) {
  const [minimised, setMinimised] = useState(false)
  const [maximised, setMaximised] = useState(false)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [term, setTerm] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [pipelineId, setPipelineId] = useState('none')
  const [template, setTemplate] = useState<Picked | null>(null)
  const [brochure, setBrochure] = useState<Picked | null>(null)
  const [picker, setPicker] = useState<'template' | 'brochure' | null>(null)
  const [files, setFiles] = useState<{ name: string; type: string; size: number; bytes: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const debounced = useDebouncedValue(term, 200)
  const { data: found = [] } = useSearchContacts(debounced)
  const { data: pipelines = [] } = usePipelines()
  const sendMail = useSendOutlookMail()

  const options = useMemo(() => {
    // Matched on address, not id: a typed address and the contact who owns it
    // are the same person, and would otherwise both sit in the field.
    const chosen = new Set(recipients.map((r) => r.email.toLowerCase()))
    return found
      .filter((c) => !!c.email && !chosen.has((c.email as string).toLowerCase()))
      .slice(0, 6)
  }, [found, recipients])
  const { data: summaries = {} } = useContactDealSummary(options.map((o) => o.id))

  const typed = term.trim().toLowerCase()
  const looksLikeEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(typed)
  const alreadyAdded = recipients.some((r) => r.email.toLowerCase() === typed)
  // Offer the typed address only when the search has not already turned up the
  // contact who owns it — picking the contact is always the better answer.
  const offerTyped =
    looksLikeEmail &&
    !alreadyAdded &&
    !found.some((c) => (c.email as string | null)?.toLowerCase() === typed)

  const add = (recipient: Recipient) => {
    setRecipients((prev) => [...prev, recipient])
    setTerm('')
    setHighlighted(0)
    inputRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    // The typed address sits below the suggestions, so it is one row further
    // than options.length would suggest.
    const lastRow = options.length - 1 + (offerTyped ? 1 : 0)
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, lastRow)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && options[highlighted]) {
      e.preventDefault()
      add(recipientFromContact(options[highlighted]))
    } else if (e.key === 'Enter' && offerTyped) {
      e.preventDefault()
      add({ id: `new:${typed}`, email: typed, name: typed, isNew: true })
    } else if (e.key === 'Backspace' && !term && recipients.length) {
      setRecipients((prev) => prev.slice(0, -1))
    }
  }

  // Graph carries attachments inline only while the whole message stays small
  // (see ATTACHMENT_LIMIT_BYTES in the send route). Checked here as well so a
  // file too big is refused before minutes are spent reading it.
  const attachedBytes = files.reduce((sum, f) => sum + f.size, 0)
  const ATTACH_LIMIT = 2.5 * 1024 * 1024

  async function addFiles(chosen: FileList | null) {
    if (!chosen?.length) return
    const read = await Promise.all(
      Array.from(chosen).map(
        (file) =>
          new Promise<{ name: string; type: string; size: number; bytes: string }>((resolve, reject) => {
            const reader = new FileReader()
            reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
            reader.onload = () =>
              resolve({
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                // data: URLs are "data:<type>;base64,<payload>" — Graph wants
                // the payload alone.
                bytes: String(reader.result).split(',')[1] ?? '',
              })
            reader.readAsDataURL(file)
          }),
      ),
    ).catch((err: Error) => {
      toast({ title: 'Could not attach that file', description: err.message, variant: 'destructive' })
      return []
    })

    const next = [...files, ...read]
    const total = next.reduce((sum, f) => sum + f.size, 0)
    if (total > ATTACH_LIMIT) {
      toast({
        title: 'Too large to attach',
        description: `That comes to ${(total / 1024 / 1024).toFixed(1)}MB and the limit is 2.5MB. For a brochure, use the Brochure button — it sends as a link with no size limit.`,
        variant: 'destructive',
      })
      return
    }
    setFiles(next)
  }

  const send = async () => {
    if (!recipients.length) return
    let sent = 0
    // The first recipient who has no deal is the one we offer to open one for.
    // Queueing a prompt per recipient would stack dialogs over each other.
    let opportunity: { id: string; name: string } | null = null

    for (const r of recipients) {
      try {
        const result = await sendMail.mutateAsync({
          to: r.email,
          subject,
          body,
          templateId: template?.id ?? null,
          brochureId: brochure?.id ?? null,
          attachments: files.map((f) => ({
            name: f.name,
            contentType: f.type,
            contentBytes: f.bytes,
          })),
        })
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
                <span
                  key={r.id}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full py-0.5 pl-1 pr-2 text-sm',
                    r.isNew ? 'bg-amber-500/15 ring-1 ring-amber-500/30' : 'bg-slate-800',
                  )}
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className={cn('text-[9px] text-white', r.isNew ? 'bg-amber-600' : 'bg-blue-600')}>
                      {initialsOf(r)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-slate-200">{r.name}</span>
                  {/* Said on the chip, not just once in the dropdown — by the
                      time you press Send the dropdown is long gone. */}
                  {r.isNew && <span className="text-[10px] text-amber-300">new contact</span>}
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
                placeholder={recipients.length ? '' : 'Search contacts, or type an email address'}
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
                    onClick={() => add(recipientFromContact(c))}
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

              {/* Accepted, with what it will do said plainly. The send route
                  creates the contact as the message goes, so the reply has
                  something to match against when it comes back. */}
              {offerTyped && (
                <button
                  onMouseEnter={() => setHighlighted(options.length)}
                  onClick={() => add({ id: `new:${typed}`, email: typed, name: typed, isNew: true })}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left',
                    highlighted >= options.length && 'bg-slate-800',
                  )}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-amber-600 text-[10px] text-white">
                      <UserPlus className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-100">{typed}</p>
                    <p className="truncate text-[11px] text-amber-300">
                      Not in Contacts — will be added when you send
                    </p>
                  </div>
                </button>
              )}
              {!options.length && !offerTyped && (
                <p className="px-3 py-2 text-xs text-slate-500">
                  {looksLikeEmail && alreadyAdded ? 'Already added.' : 'No contact found.'}
                </p>
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
          placeholder={template ? 'Add a personal note above the template (optional)' : 'Hi there,'}
          className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-4 py-3 text-slate-100 focus-visible:ring-0"
        />

        {/* What is going out besides what was typed. Shown above the toolbar
            so it is still in view at the moment Send is pressed. */}
        {(template || brochure || files.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 px-4 py-2">
            {template && (
              <AttachedChip icon={FileText} label={template.name} onRemove={() => setTemplate(null)} />
            )}
            {brochure && (
              <AttachedChip icon={BookOpen} label={brochure.name} onRemove={() => setBrochure(null)} />
            )}
            {files.map((f, i) => (
              <AttachedChip
                key={`${f.name}-${i}`}
                icon={Paperclip}
                label={`${f.name} · ${(f.size / 1024).toFixed(0)}KB`}
                onRemove={() => setFiles((prev) => prev.filter((_, n) => n !== i))}
              />
            ))}
            {files.length > 0 && (
              <span className="text-[11px] text-slate-500">
                {(attachedBytes / 1024 / 1024).toFixed(1)}MB of 2.5MB
              </span>
            )}
          </div>
        )}

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

        <div className="relative flex items-center gap-2 border-t border-slate-800 px-4 py-3">
          {picker === 'template' && (
            <TemplatePicker
              onClose={() => setPicker(null)}
              onPick={(picked, templateSubject) => {
                setTemplate(picked)
                // The template's own subject fills an empty box; it never
                // overwrites a subject somebody has already written.
                if (!subject.trim() && templateSubject) setSubject(templateSubject)
                setPicker(null)
              }}
            />
          )}
          {picker === 'brochure' && (
            <BrochurePicker
              onClose={() => setPicker(null)}
              onPick={(picked) => { setBrochure(picked); setPicker(null) }}
            />
          )}

          {/* The send route refuses an empty subject, so stopping here is
              clearer than one failed toast per recipient. A template brings
              its own subject, so it lifts that requirement. */}
          <Button
            onClick={send}
            disabled={!recipients.length || (!subject.trim() && !template) || sendMail.isPending}
          >
            {sendMail.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Send
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-slate-100"
            onClick={() => setPicker((p) => (p === 'template' ? null : 'template'))}
          >
            <FileText className="mr-1.5 h-4 w-4" />
            Template
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-slate-100"
            onClick={() => setPicker((p) => (p === 'brochure' ? null : 'brochure'))}
          >
            <BookOpen className="mr-1.5 h-4 w-4" />
            Brochure
          </Button>
          {/* There was a paperclip here that did nothing. */}
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); if (fileRef.current) fileRef.current.value = '' }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-slate-100"
            onClick={() => fileRef.current?.click()}
            title="Attach a file — up to 2.5MB. Brochures go as links instead."
          >
            <Paperclip className="mr-1.5 h-4 w-4" />
            Attach
          </Button>

          <span className="ml-auto text-xs text-slate-500">
            Branded · saved to your Outlook Sent Items
          </span>
        </div>
      </div>
    </div>
  )
}
