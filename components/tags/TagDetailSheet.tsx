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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useTagContacts } from '@/lib/hooks/useTags'
import type { TagWithCount } from '@/lib/hooks/useTags'
import { formatDate } from '@/lib/utils/format'
import type { Contact } from '@/lib/types/contacts'

interface TagDetailSheetProps {
  tag: TagWithCount | null
  isOpen: boolean
  onClose: () => void
}

export function TagDetailSheet({ tag, isOpen, onClose }: TagDetailSheetProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: contactsData, isLoading: contactsLoading } = useTagContacts(
    tag?.id || null,
    page,
    pageSize,
    debouncedSearch
  )

  const contacts = contactsData?.contacts || []
  const totalContacts = contactsData?.total || 0
  const totalPages = Math.ceil(totalContacts / pageSize)

  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      setDebouncedSearch('')
      setPage(1)
    }
  }, [isOpen])

  const getInitials = (contact: Contact) => {
    return `${contact.first_name.charAt(0)}${contact.last_name.charAt(0)}`.toUpperCase()
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
        {!tag ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3.5 w-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color || '#3b82f6' }}
                    />
                    <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
                      {tag.name}
                    </SheetTitle>
                  </div>
                  <SheetDescription className="mt-1 line-clamp-2">
                    {tag.description || 'No description'}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {totalContacts.toLocaleString()} contact{totalContacts === 1 ? '' : 's'}
                </Badge>
                {tag.category && (
                  <Badge variant="outline">
                    {tag.category.charAt(0).toUpperCase() + tag.category.slice(1)}
                  </Badge>
                )}
              </div>
            </SheetHeader>

            {/* Search */}
            <div className="px-6 py-4 border-b bg-slate-50 dark:bg-slate-800 shrink-0">
              <div className="relative">
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
                  <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
                  <p className="text-muted-foreground text-center">
                    {search ? 'No contacts match your search.' : 'No contacts have this tag yet.'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((item) => {
                      const contactData = item.contact
                      const contact = (Array.isArray(contactData) ? contactData[0] : contactData) as Contact | null
                      if (!contact) return null

                      return (
                        <TableRow key={item.contact_id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs">
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
                            {contact.phone || '\u2014'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(item.added_at)}
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
                    Showing {(page - 1) * pageSize + 1}\u2013
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
  )
}
