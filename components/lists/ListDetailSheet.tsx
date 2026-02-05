'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Search, UserPlus, Trash2, ChevronLeft, ChevronRight, Users, Download, Loader2 } from 'lucide-react'
import { useList, useListContacts, useRemoveContactFromList, useBulkRemoveContactsFromList, useExportListContacts } from '@/lib/hooks/useLists'
import { formatDate } from '@/lib/utils/format'
import { toast } from '@/lib/hooks/use-toast'
import type { Contact } from '@/lib/types/contacts'

interface ListDetailSheetProps {
  listId: string | null
  isOpen: boolean
  onClose: () => void
  onAddContacts: () => void
}

export function ListDetailSheet({
  listId,
  isOpen,
  onClose,
  onAddContacts,
}: ListDetailSheetProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [contactToRemove, setContactToRemove] = useState<{ id: string; name: string } | null>(null)
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const [showBulkRemoveDialog, setShowBulkRemoveDialog] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const pageSize = 20

  const { data: list, isLoading: listLoading } = useList(listId)
  const { data: contactsData, isLoading: contactsLoading } = useListContacts(
    listId,
    page,
    pageSize,
    search
  )
  const removeContact = useRemoveContactFromList()
  const bulkRemove = useBulkRemoveContactsFromList()
  const exportContacts = useExportListContacts()

  const contacts = contactsData?.contacts || []
  const totalContacts = contactsData?.total || 0
  const totalPages = Math.ceil(totalContacts / pageSize)

  // Reset selection when list changes or sheet closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedContactIds(new Set())
      setSearch('')
      setPage(1)
    }
  }, [isOpen])

  // Reset selection when page or search changes
  useEffect(() => {
    setSelectedContactIds(new Set())
  }, [page, search])

  const handleRemoveContact = async () => {
    if (!contactToRemove || !listId) return

    try {
      await removeContact.mutateAsync({
        listId,
        contactId: contactToRemove.id,
      })
      toast({
        title: 'Contact removed',
        description: `${contactToRemove.name} has been removed from this list.`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove contact from list.',
        variant: 'destructive',
      })
    }
    setContactToRemove(null)
  }

  const handleBulkRemove = async () => {
    if (!listId || selectedContactIds.size === 0) return

    try {
      await bulkRemove.mutateAsync({
        listId,
        contactIds: Array.from(selectedContactIds),
      })
      toast({
        title: 'Contacts removed',
        description: `${selectedContactIds.size} contact(s) removed from this list.`,
      })
      setSelectedContactIds(new Set())
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove contacts from list.',
        variant: 'destructive',
      })
    }
    setShowBulkRemoveDialog(false)
  }

  const handleExportCSV = async () => {
    if (!listId || !list) return

    setIsExporting(true)
    try {
      const csvData = await exportContacts.mutateAsync(listId)
      
      // Create and download the file
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${list.name.replace(/[^a-z0-9]/gi, '_')}_contacts.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'Export complete',
        description: `${totalContacts} contact(s) exported to CSV.`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export contacts.',
        variant: 'destructive',
      })
    }
    setIsExporting(false)
  }

  const toggleSelectContact = (contactId: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev)
      if (next.has(contactId)) {
        next.delete(contactId)
      } else {
        next.add(contactId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedContactIds.size === contacts.length) {
      setSelectedContactIds(new Set())
    } else {
      const allIds = contacts
        .map((item) => {
          const contactData = item.contact
          const contact = Array.isArray(contactData) ? contactData[0] : contactData
          return contact?.id
        })
        .filter(Boolean) as string[]
      setSelectedContactIds(new Set(allIds))
    }
  }

  const getInitials = (contact: Contact) => {
    return `${contact.first_name.charAt(0)}${contact.last_name.charAt(0)}`.toUpperCase()
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
          {listLoading || !list ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-10 w-full" />
              <div className="space-y-3 pt-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ) : (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b bg-white dark:bg-slate-900 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
                      {list.name}
                    </SheetTitle>
                    <SheetDescription className="mt-1 line-clamp-2">
                      {list.description || 'No description'}
                    </SheetDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCSV}
                      disabled={isExporting || totalContacts === 0}
                    >
                      {isExporting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Export CSV
                    </Button>
                    <Button onClick={onAddContacts} className="bg-blue-600 hover:bg-blue-700">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Players
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {totalContacts.toLocaleString()} contacts
                  </Badge>
                </div>
              </SheetHeader>

              {/* Search and Bulk Actions */}
              <div className="px-6 py-4 border-b bg-slate-50 dark:bg-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search contacts..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value)
                        setPage(1)
                      }}
                      className="pl-9"
                    />
                  </div>
                  {selectedContactIds.size > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                        {selectedContactIds.size} selected
                      </Badge>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkRemoveDialog(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove Selected
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Contacts Table */}
              <div className="flex-1 overflow-y-auto">
                {contactsLoading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-6">
                    <Users className="h-12 w-12 text-gray-300 mb-4" />
                    <p className="text-muted-foreground text-center">
                      {search ? 'No contacts match your search.' : 'No contacts in this list yet.'}
                    </p>
                    {!search && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={onAddContacts}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Players
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={
                              contacts.length > 0 &&
                              selectedContactIds.size === contacts.length
                            }
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Grad Year</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts.map((item) => {
                        // Contact may come as array from Supabase join
                        const contactData = item.contact
                        const contact = Array.isArray(contactData) ? contactData[0] : contactData
                        if (!contact) return null

                        const isSelected = selectedContactIds.has(contact.id)

                        return (
                          <TableRow key={item.contact_id} className={isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectContact(contact.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs">
                                    {getInitials(contact)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {contact.first_name} {contact.last_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {contact.email}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {contact.phone || '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {contact.grad_year || '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(item.added_at)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                onClick={() =>
                                  setContactToRemove({
                                    id: contact.id,
                                    name: `${contact.first_name} ${contact.last_name}`,
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <SheetFooter className="border-t px-6 py-4 bg-slate-50 dark:bg-slate-800 shrink-0">
                  <div className="flex items-center justify-between w-full">
                    <p className="text-sm text-muted-foreground">
                      Showing {(page - 1) * pageSize + 1}-
                      {Math.min(page * pageSize, totalContacts)} of {totalContacts}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Remove Contact Confirmation */}
      <AlertDialog open={!!contactToRemove} onOpenChange={() => setContactToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove contact from list?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-medium">{contactToRemove?.name}</span> from this list?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveContact}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Remove Confirmation */}
      <AlertDialog open={showBulkRemoveDialog} onOpenChange={setShowBulkRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedContactIds.size} contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-medium">{selectedContactIds.size} contacts</span> from this list?
              The contacts themselves will not be deleted, only removed from this list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkRemove}
              className="bg-red-600 hover:bg-red-700"
              disabled={bulkRemove.isPending}
            >
              {bulkRemove.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove All'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
