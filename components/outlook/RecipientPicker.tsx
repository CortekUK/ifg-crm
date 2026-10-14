'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Loader2, Mail, Search, UserPlus, X } from 'lucide-react'
import { useSearchContacts } from '@/lib/hooks/useSearchContacts'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useContactDealSummary } from '@/lib/hooks/useContactDealSummary'
import type { Contact } from '@/lib/types/contacts'

export interface ChosenRecipient {
  email: string
  contact: Contact | null
  /** Pipelines the contact already has an active deal in. */
  pipelines: string[]
}

interface RecipientPickerProps {
  value: ChosenRecipient | null
  onChange: (value: ChosenRecipient | null) => void
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * "Who are you writing to?" — a search over every contact, not a blank box.
 *
 * The first version of Compose was a plain email field. That put the whole
 * burden on the recruiter: remember the address exactly, and separately
 * remember whether that person is already in a pipeline. Neither is
 * reasonable against 179,000 contacts.
 *
 * So each suggestion carries the two facts that decide what happens next:
 * who they are, and which programme they are already in — or "No deal yet",
 * which is the case where Compose will offer to open one after sending.
 *
 * A raw address that matches nobody is still allowed, because cold outreach
 * to someone new is the entire point of Compose. It is just labelled as such.
 */
export function RecipientPicker({ value, onChange }: RecipientPickerProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebouncedValue(search, 250)

  const { data: contacts = [], isLoading } = useSearchContacts(debounced)
  const withEmail = useMemo(() => contacts.filter((c) => !!c.email).slice(0, 8), [contacts])
  const { data: summaries = {} } = useContactDealSummary(withEmail.map((c) => c.id))

  const typedIsEmail = EMAIL_RE.test(search.trim())
  const typedMatchesNobody =
    typedIsEmail && !withEmail.some((c) => c.email?.toLowerCase() === search.trim().toLowerCase())

  const initials = (c: Contact) =>
    `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase() || '??'

  const choose = (contact: Contact) => {
    onChange({
      email: (contact.email as string).toLowerCase(),
      contact,
      pipelines: summaries[contact.id]?.pipelines ?? [],
    })
    setSearch('')
    setOpen(false)
  }

  // Already chosen — show it as a removable chip rather than leaving the
  // search box looking like nothing has been selected.
  if (value) {
    const name = value.contact
      ? `${value.contact.first_name ?? ''} ${value.contact.last_name ?? ''}`.trim()
      : null
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-[10px]">
              {value.contact ? initials(value.contact) : <Mail className="h-3 w-3" />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{name || value.email}</p>
            <p className="text-[11px] text-muted-foreground truncate">{value.email}</p>
          </div>
          {value.contact ? (
            value.pipelines.length ? (
              value.pipelines.map((p) => (
                <Badge key={p} variant="secondary" className="text-[10px] shrink-0">
                  {p}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="text-[10px] shrink-0">
                No deal yet
              </Badge>
            )
          ) : (
            <Badge variant="outline" className="text-[10px] shrink-0">
              New contact
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Change recipient"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9"
        placeholder="Search a contact, or type an email address"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />

      {open && (search.length > 0 || withEmail.length > 0) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <ScrollArea className="max-h-64">
            {isLoading && (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching contacts…
              </div>
            )}

            {!isLoading &&
              withEmail.map((contact) => {
                const pipelines = summaries[contact.id]?.pipelines ?? []
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => choose(contact)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60"
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-[10px]">
                        {initials(contact)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {`${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || contact.email}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{contact.email}</p>
                    </div>
                    {/* The deciding fact: already in a programme, or not. */}
                    {pipelines.length ? (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {pipelines[0]}
                        {pipelines.length > 1 ? ` +${pipelines.length - 1}` : ''}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] shrink-0 text-amber-600 border-amber-300">
                        No deal yet
                      </Badge>
                    )}
                  </button>
                )
              })}

            {!isLoading && typedMatchesNobody && (
              <button
                type="button"
                onClick={() => {
                  onChange({ email: search.trim().toLowerCase(), contact: null, pipelines: [] })
                  setSearch('')
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2.5 border-t px-3 py-2 text-left hover:bg-muted/60"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                  <UserPlus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{search.trim()}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Not in the CRM — they will be added as a contact
                  </p>
                </div>
              </button>
            )}

            {!isLoading && !withEmail.length && !typedMatchesNobody && search.length > 1 && (
              <p className="p-3 text-sm text-muted-foreground">
                No contact found. Type a full email address to write to someone new.
              </p>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
