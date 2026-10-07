'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Search, Loader2, UserPlus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearchContacts } from '@/lib/hooks/useSearchContacts'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import type { Contact } from '@/lib/types/contacts'

interface ContactPickerPopoverProps {
  /** Pre-fills the search so the obvious candidates are on screen immediately. */
  initialSearch?: string
  /** Currently chosen contact, if any. */
  selectedContactId?: string | null
  /** Chose an existing contact. */
  onSelect: (contact: Contact) => void
  /** Chose "create a new contact instead". */
  onCreateNew: () => void
  children: React.ReactNode
}

/**
 * Pick a contact for a row in Smart Match.
 *
 * QA-31 bug 2: the ticket expects staff to be able to untick a suggestion they
 * disagree with *and pick a different contact*. Each Smart Match row had only
 * a tick box, so a wrong or missing suggestion could not be corrected at all —
 * the only options were "accept what it guessed" or "skip this reply".
 *
 * Searching goes through `useSearchContacts`, the same ranked server-side
 * search the Contacts page and the single Match dialog use, so it reaches all
 * 179,468 contacts rather than the 1,000 the old matcher could see.
 */
export function ContactPickerPopover({
  initialSearch = '',
  selectedContactId,
  onSelect,
  onCreateNew,
  children,
}: ContactPickerPopoverProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(initialSearch)
  const debounced = useDebouncedValue(search, 300)
  const { data: contacts = [], isLoading } = useSearchContacts(debounced)

  const initials = (c: Contact) =>
    `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase() || '??'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="relative border-b border-slate-200 p-2 dark:border-slate-700">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or phone…"
            aria-label="Search contacts"
            className="h-9 pl-8"
          />
        </div>

        <ScrollArea className="max-h-64">
          <div className="p-1">
            <button
              type="button"
              onClick={() => {
                onCreateNew()
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm',
                'hover:bg-slate-100 dark:hover:bg-slate-800',
                !selectedContactId && 'bg-blue-50 dark:bg-blue-900/20',
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <UserPlus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="font-medium">Create a new contact</span>
              {!selectedContactId && <Check className="ml-auto h-4 w-4 text-blue-600" />}
            </button>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            ) : contacts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No contacts match that search.
              </p>
            ) : (
              contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect(c)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm',
                    'hover:bg-slate-100 dark:hover:bg-slate-800',
                    selectedContactId === c.id && 'bg-purple-50 dark:bg-purple-900/20',
                  )}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-slate-100 text-xs font-semibold dark:bg-slate-800">
                      {initials(c)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.email || c.phone || '—'}
                    </span>
                  </span>
                  {selectedContactId === c.id && (
                    <Check className="ml-auto h-4 w-4 shrink-0 text-purple-600" />
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

/** The trigger Smart Match rows use, kept here so the styling lives with it. */
export function ContactPickerTrigger({ label }: { label: string }) {
  return (
    <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground">
      {label}
    </Button>
  )
}
