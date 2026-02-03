'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2, Users, Check } from 'lucide-react'
import { useSearchContacts } from '@/lib/hooks/useSearchContacts'
import { useAddContactsToList, useListContactIds } from '@/lib/hooks/useLists'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { toast } from '@/lib/hooks/use-toast'
import type { Contact } from '@/lib/types/contacts'

interface AddContactsToListModalProps {
  isOpen: boolean
  onClose: () => void
  listId: string | null
  listName: string
}

export function AddContactsToListModal({
  isOpen,
  onClose,
  listId,
  listName,
}: AddContactsToListModalProps) {
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const debouncedSearch = useDebouncedValue(search, 300)
  const { data: contacts = [], isLoading: contactsLoading } = useSearchContacts(debouncedSearch)
  const { data: existingContactIds = new Set() } = useListContactIds(listId)
  const addContacts = useAddContactsToList()

  // Filter out contacts that can be added (not already in list)
  const availableContacts = contacts.filter((c) => !existingContactIds.has(c.id))
  const alreadyInListContacts = contacts.filter((c) => existingContactIds.has(c.id))

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      setSelectedIds(new Set())
    }
  }, [isOpen])

  const handleToggleContact = (contactId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(contactId)) {
        next.delete(contactId)
      } else {
        next.add(contactId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedIds.size === availableContacts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(availableContacts.map((c) => c.id)))
    }
  }

  const handleSubmit = async () => {
    if (!listId || selectedIds.size === 0) return

    try {
      await addContacts.mutateAsync({
        listId,
        contactIds: Array.from(selectedIds),
      })
      toast({
        title: 'Contacts added',
        description: `${selectedIds.size} contact${selectedIds.size > 1 ? 's' : ''} added to "${listName}".`,
      })
      onClose()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add contacts to list.',
        variant: 'destructive',
      })
    }
  }

  const getInitials = (contact: Contact) => {
    return `${contact.first_name.charAt(0)}${contact.last_name.charAt(0)}`.toUpperCase()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            Add Players to List
          </DialogTitle>
          <DialogDescription>
            Search and select contacts to add to "{listName}".
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Selection count */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between py-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              {selectedIds.size} selected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs"
            >
              Clear selection
            </Button>
          </div>
        )}

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto border rounded-lg min-h-[200px] max-h-[300px]">
          {contactsLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Users className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-muted-foreground text-center">
                {search
                  ? 'No contacts found matching your search.'
                  : 'Start typing to search for contacts.'}
              </p>
            </div>
          ) : availableContacts.length === 0 && alreadyInListContacts.length > 0 ? (
            <div className="divide-y">
              {/* Show already-in-list contacts with message */}
              <div className="p-3 bg-amber-50 border-b border-amber-100">
                <p className="text-sm text-amber-700 text-center">
                  All matching contacts are already in this list
                </p>
              </div>
              {alreadyInListContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 bg-slate-50/50 opacity-60 cursor-not-allowed"
                >
                  <div className="h-4 w-4 rounded border border-slate-300 bg-slate-200 flex items-center justify-center">
                    <Check className="h-3 w-3 text-slate-500" />
                  </div>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-slate-100 text-slate-500 text-xs">
                      {getInitials(contact)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-500 truncate">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {contact.email}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs bg-slate-200 text-slate-600">
                    Already in list
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y">
              {/* Select All - only for available contacts */}
              {availableContacts.length > 0 && (
                <div
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b bg-slate-50"
                  onClick={handleSelectAll}
                >
                  <Checkbox
                    checked={selectedIds.size === availableContacts.length && availableContacts.length > 0}
                  />
                  <span className="text-sm font-medium text-gray-600">
                    Select all ({availableContacts.length})
                  </span>
                </div>
              )}

              {/* Contacts already in list - shown as disabled */}
              {alreadyInListContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 bg-slate-50/50 opacity-60 cursor-not-allowed"
                >
                  <div className="h-4 w-4 rounded border border-slate-300 bg-slate-200 flex items-center justify-center">
                    <Check className="h-3 w-3 text-slate-500" />
                  </div>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-slate-100 text-slate-500 text-xs">
                      {getInitials(contact)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-500 truncate">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {contact.email}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs bg-slate-200 text-slate-600">
                    Already in list
                  </Badge>
                </div>
              ))}

              {/* Available contacts */}
              {availableContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleToggleContact(contact.id)}
                >
                  <Checkbox checked={selectedIds.has(contact.id)} />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                      {getInitials(contact)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {contact.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedIds.size === 0 || addContacts.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {addContacts.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              `Add ${selectedIds.size > 0 ? selectedIds.size : ''} Contact${selectedIds.size !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
