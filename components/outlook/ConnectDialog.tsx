'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Check, Globe, Link2, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import { useSearchContacts } from '@/lib/hooks/useSearchContacts'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useSuggestions } from '@/lib/hooks/useSuggestions'
import type { MailThread } from '@/lib/hooks/useMailbox'
import type { Confidence, NamePart, PartMatch } from '@/lib/outlook/suggest-contacts'

export interface ConnectResult {
  email: string
  contactId: string | null
  /** The category the thread now belongs to. */
  category: 'player' | 'secondary' | 'external'
  contactName?: string
  /** Whether the contact is already in a pipeline. */
  hasDeal?: boolean
}

interface ConnectDialogProps {
  thread: MailThread
  onClose: () => void
  onConnected: (result: ConnectResult) => void
}

const CONFIDENCE: Record<Confidence, { label: string; bar: string; text: string }> = {
  strong:   { label: 'Strong match',   bar: 'bg-green-500', text: 'text-green-400' },
  likely:   { label: 'Likely match',   bar: 'bg-blue-500',  text: 'text-blue-400' },
  possible: { label: 'Possible match', bar: 'bg-slate-500', text: 'text-slate-400' },
}

/** A name part, tinted by how well it matched — the dialog's whole argument. */
function Part({ slot, value, match }: { slot: string; value: string; match: PartMatch }) {
  const tone =
    match === 'exact'   ? 'border-green-500/50 bg-green-500/10 text-green-300' :
    match === 'partial' ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' :
    match === 'initial' ? 'border-slate-600 bg-slate-800/60 text-slate-300' :
                          'border-slate-800 bg-slate-900/60 text-slate-500'
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] leading-none', tone)}>
      <span className="opacity-50">{slot}</span>
      {value}
      {match !== 'none' && <Check className="h-2.5 w-2.5" />}
    </span>
  )
}

/** One candidate. Used for both the ranked suggestions and search results. */
interface Candidate {
  contactId: string
  name: string
  email: string | null
  country: string | null
  role: string
  parts: NamePart[]
  confidence: Confidence | null
  score: number | null
}

export function ConnectDialog({ thread, onClose, onConnected }: ConnectDialogProps) {
  const address = thread.counterparty_email ?? ''

  // Already in the cache: the Unmatched list prefetches these while it renders,
  // so the dialog opens with its answer instead of a spinner.
  const { data: suggestions = [], isLoading } = useSuggestions(address, thread.counterparty_name)

  const [chosen, setChosen] = useState<string | null>(null)
  const [saveSecondary, setSaveSecondary] = useState(true)
  const [working, setWorking] = useState(false)
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const debounced = useDebouncedValue(search, 250)
  const searching = search.trim().length > 1
  const { data: searchResults = [], isFetching } = useSearchContacts(searching ? debounced : '')

  // Typing replaces the ranked list rather than adding a second one below it.
  // Two lists of people in one dialog is a guessing game about which is which.
  const candidates: Candidate[] = useMemo(() => {
    if (searching) {
      return searchResults.slice(0, 8).map((c) => ({
        contactId: c.id,
        name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || (c.email as string),
        email: c.email ?? null,
        country: c.country ?? null,
        role: 'Player',
        parts: [],
        confidence: null,
        score: null,
      }))
    }
    return suggestions.map((s) => ({
      contactId: s.contactId,
      name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' '),
      email: s.email,
      country: s.country,
      role: s.role,
      parts: s.parts,
      confidence: s.confidence,
      score: s.score,
    }))
  }, [searching, searchResults, suggestions])

  // Pre-select the top suggestion only when it is a STRONG match. Pre-selecting
  // a "possible" one invites someone to press Connect without reading it, and a
  // reply filed on the wrong player is far more work to undo than to avoid.
  useEffect(() => {
    if (!searching && suggestions[0]?.confidence === 'strong') setChosen(suggestions[0].contactId)
  }, [searching, suggestions])

  useEffect(() => { setCursor(0) }, [searching, debounced])

  const chosenName = candidates.find((c) => c.contactId === chosen)?.name ?? null

  // ↑ ↓ to move, Enter to pick — the dialog is reachable without the mouse.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, candidates.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = candidates[cursor]
      if (pick) setChosen(pick.contactId)
    }
  }

  useEffect(() => {
    listRef.current?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const submit = async (markExternal = false) => {
    setWorking(true)
    try {
      const res = await fetch('/api/outlook/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: address,
          contactId: markExternal ? undefined : chosen,
          saveAsSecondary: markExternal ? false : saveSecondary,
          markExternal,
          threadId: thread.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not connect this email.')

      toast(
        markExternal
          ? { title: 'Marked as external', description: 'Filed as a supplier or booking email.' }
          : {
              title: `Connected to ${data.contactName}`,
              description:
                `${data.messagesConnected} message${data.messagesConnected === 1 ? '' : 's'} moved onto this contact` +
                (data.savedAsSecondary ? ' · future emails from this address will match automatically.' : '.'),
            },
      )
      onConnected({
        email: data.email ?? address,
        contactId: data.contactId ?? null,
        category: data.category,
        contactName: data.contactName,
        hasDeal: data.hasDeal,
      })
    } catch (error) {
      toast({
        title: 'Could not connect',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setWorking(false)
    }
  }

  const initials = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '??'

  const AVATAR_TONES = [
    'bg-amber-500/80 text-slate-900', 'bg-orange-500/80 text-slate-900',
    'bg-pink-500/80 text-white', 'bg-blue-500/80 text-white', 'bg-violet-500/80 text-white',
  ]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden border-slate-800 bg-slate-950 p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 px-5 pb-3 pt-4">
          <DialogTitle className="text-base font-semibold text-slate-100">
            Connect email to a contact
          </DialogTitle>
        </DialogHeader>

        <div className="shrink-0 space-y-3 px-5 pb-3">
          {/* who wrote in */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-violet-500/80 text-[11px] text-white">
                {initials(thread.counterparty_name ?? address)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-slate-100">
                  {thread.counterparty_name || 'Unknown sender'}
                </span>
                <span className="truncate text-sm text-slate-400">&lt;{address}&gt;</span>
              </div>
              <p className="mt-0.5 truncate text-sm text-slate-500">
                {thread.subject} — {thread.last_message_preview}
              </p>
            </div>
            <span className="shrink-0 rounded bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">
              Unknown address
            </span>
          </div>

          {/* Search sits ABOVE the suggestions: if the ranking has not found the
              right person, searching is the next thing you do, and it should
              not be buried under five rows you have already rejected. */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search all contacts by name or email"
              className="h-11 border-slate-800 bg-slate-900/60 pl-9 pr-20 text-slate-100 placeholder:text-slate-500"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500">
              ↑↓ Enter
            </span>
          </div>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-5">
          <p className="pb-2 text-xs text-slate-500">
            {searching ? (
              <>Search results{isFetching ? ' · searching…' : ` · ${candidates.length}`}</>
            ) : (
              <>
                <span className="text-slate-400">Suggested</span>
                {` · ${suggestions.length} possible match${suggestions.length === 1 ? '' : 'es'}`}
                {' — first, middle and last name + email'}
              </>
            )}
          </p>

          {isLoading && !searching ? (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Ranking contacts…
            </div>
          ) : candidates.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">
              {searching
                ? 'No contact matches that search.'
                : 'No likely contact found. Search above, or mark the email as external.'}
            </p>
          ) : (
            <div className="space-y-1.5 pb-4">
              {candidates.map((c, i) => {
                const selected = chosen === c.contactId
                const conf = c.confidence ? CONFIDENCE[c.confidence] : null
                return (
                  <button
                    key={c.contactId}
                    data-cursor={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => setChosen(c.contactId)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'border-blue-500/60 bg-blue-500/10'
                        : i === cursor
                          ? 'border-slate-700 bg-slate-900/70'
                          : 'border-transparent bg-slate-900/40 hover:bg-slate-900/70',
                    )}
                  >
                    <span className={cn(
                      'h-4 w-4 shrink-0 rounded-full border-2',
                      selected ? 'border-blue-400 bg-blue-500' : 'border-slate-600',
                    )} />

                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={cn('text-[11px]', AVATAR_TONES[i % AVATAR_TONES.length])}>
                        {initials(c.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-slate-100">{c.name}</span>
                        <span className="shrink-0 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-300">
                          {c.role}
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {c.email}{c.country ? ` · ${c.country}` : ''}
                      </p>
                    </div>

                    {/* The reasoning, inline — why this person was suggested. */}
                    {c.parts.length > 0 && (
                      <div className="hidden shrink-0 items-center gap-1 lg:flex">
                        {c.parts.map((p) => <Part key={p.slot} slot={p.slot} value={p.value} match={p.match} />)}
                      </div>
                    )}

                    {conf && (
                      <div className="w-24 shrink-0 text-right">
                        <p className={cn('text-[11px] font-medium', conf.text)}>{conf.label}</p>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                          <div className={cn('h-full rounded-full', conf.bar)} style={{ width: `${c.score}%` }} />
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t border-slate-800 px-5 py-3.5">
          {chosen && (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-300">
              <Checkbox checked={saveSecondary} onCheckedChange={(v) => setSaveSecondary(!!v)} />
              <span>
                Save <span className="font-medium text-slate-100">{address}</span> as a secondary email
                so future emails match automatically
              </span>
            </label>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => submit(true)}
              disabled={working}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
            >
              <Globe className="h-4 w-4" />
              Mark as external
            </button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={working}>Cancel</Button>
              <Button onClick={() => submit(false)} disabled={!chosen || working}>
                {working ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Link2 className="mr-1.5 h-4 w-4" />}
                {chosenName ? `Connect to ${chosenName}` : 'Connect'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
