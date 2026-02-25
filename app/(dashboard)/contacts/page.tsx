'use client'

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContactsPageHeader } from '@/components/contacts/ContactsPageHeader'
import { ContactStats } from '@/components/contacts/ContactStats'
import { ContactFilters } from '@/components/contacts/ContactFilters'
import { ContactsTable } from '@/components/contacts/ContactsTable'
import { ContactsGrid } from '@/components/contacts/ContactsGrid'
import { ColumnToggle, getStoredColumns, storeColumns } from '@/components/contacts/ColumnToggle'
import { TablePagination } from '@/components/ui/table-pagination'
import { CreateContactModal } from '@/components/contacts/CreateContactModal'
import { EditContactModal } from '@/components/contacts/EditContactModal'
import { ContactDetailSheet } from '@/components/contacts/ContactDetailSheet'
import { ImportCSVModal } from '@/components/contacts/ImportCSVModal'
import { BulkEditModal } from '@/components/contacts/BulkEditModal'
import { useContacts, useBulkDeleteContacts, useBulkUpdateContactSubscription } from '@/lib/hooks/useContacts'
import { useContactStats } from '@/lib/hooks/useContactStats'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useAddContactsToList, useLists } from '@/lib/hooks/useLists'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'
import type { Contact } from '@/lib/types/contacts'
import { ErrorState } from '@/components/ui/error-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Download, Trash2, MailCheck, MailX, ListPlus, ChevronDown, Loader2, X, Pencil } from 'lucide-react'

function ContactsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>(getStoredColumns)

  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Filter state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [programmeFilter, setProgrammeFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [recruiterFilter, setRecruiterFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [graduationYearFilter, setGraduationYearFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')

  // Sort state
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  // Current user ID
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  // Handle URL ?id= param from global search
  useEffect(() => {
    const contactId = searchParams.get('id')
    if (contactId) {
      setSelectedContact({ id: contactId } as Contact)
      // Clean the URL without triggering navigation
      router.replace('/contacts', { scroll: false })
    }
  }, [searchParams, router])

  // Debounce search
  const debouncedSearch = useDebouncedValue(search, 300)

  // Build filters object
  const filters = {
    ...(statusFilter && statusFilter !== 'all' && { subscription_status: statusFilter }),
    ...(programmeFilter && programmeFilter !== 'all' && { pipeline_id: programmeFilter }),
    ...(countryFilter && countryFilter !== 'all' && { country: countryFilter }),
    ...(recruiterFilter && recruiterFilter !== 'all' && { recruiter_id: recruiterFilter }),
    ...(tagFilter && tagFilter !== 'all' && { tag_id: tagFilter }),
    ...(positionFilter && positionFilter !== 'all' && { position: positionFilter }),
    ...(ownerFilter && ownerFilter !== 'all' && { owner_id: ownerFilter }),
    ...(graduationYearFilter && graduationYearFilter !== 'all' && { graduation_year: parseInt(graduationYearFilter) }),
    ...(genderFilter && genderFilter !== 'all' && { gender: genderFilter }),
  }

  // Fetch contacts
  const { data, isLoading, error, refetch, isFetching } = useContacts({
    page,
    pageSize,
    search: debouncedSearch,
    sortBy,
    sortOrder,
    filters,
  })

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useContactStats()

  // Bulk actions
  const bulkDelete = useBulkDeleteContacts()
  const bulkUpdateSubscription = useBulkUpdateContactSubscription()
  const addContactsToList = useAddContactsToList()
  const { data: lists = [] } = useLists()

  const contacts = data?.contacts || []
  const total = data?.total || 0

  // Discover custom field keys from loaded contacts
  const customFieldColumns = useMemo(() => {
    const keys = new Set<string>()
    contacts.forEach((c) => {
      if (c.custom_fields) Object.keys(c.custom_fields).forEach((k) => keys.add(k))
    })
    return [...keys].sort().map((k) => ({
      key: `custom_${k}`,
      label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    }))
  }, [contacts])

  // Handle sorting
  const handleSort = useCallback((column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }, [sortBy])

  // Handle selection
  const handleSelectChange = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(contacts.map((c) => c.id)))
    } else {
      setSelectedIds(new Set())
    }
  }, [contacts])

  // Handle filter clear
  const handleClearFilters = useCallback(() => {
    setSearch('')
    setStatusFilter('')
    setProgrammeFilter('')
    setCountryFilter('')
    setRecruiterFilter('')
    setTagFilter('')
    setPositionFilter('')
    setOwnerFilter('')
    setGraduationYearFilter('')
    setGenderFilter('')
    setPage(1)
  }, [])

  // Handle page size change
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1)
  }, [])

  // Handle row click
  const handleRowClick = useCallback((contact: Contact) => {
    setSelectedContact(contact)
  }, [])

  // Handle column toggle
  const handleColumnToggle = useCallback((columns: string[]) => {
    setVisibleColumns(columns)
    storeColumns(columns)
  }, [])

  // Handle export
  const handleExport = useCallback(() => {
    if (contacts.length === 0) return
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Country', 'Position', 'Club', 'Graduation Year', 'Gender', 'GPA', 'Source']
    const rows = contacts.map((c) => [
      c.first_name || '',
      c.last_name || '',
      c.email || '',
      c.phone || '',
      c.country || '',
      c.position || '',
      c.club_name || '',
      c.graduation_year?.toString() || '',
      c.gender || '',
      c.gpa?.toString() || '',
      c.source || '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [contacts])

  // Grid view handlers
  const handleEmailClick = useCallback((contact: Contact) => {
    window.location.href = `mailto:${contact.email}`
  }, [])

  const handleSMSClick = useCallback((contact: Contact) => {
    if (contact.phone) {
      window.location.href = `sms:${contact.phone}`
    }
  }, [])

  // Bulk action handlers
  const handleBulkExport = useCallback(() => {
    const selected = contacts.filter((c) => selectedIds.has(c.id))
    if (selected.length === 0) return
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Country', 'Position', 'Club', 'Graduation Year', 'Gender', 'GPA', 'Source']
    const rows = selected.map((c) => [
      c.first_name || '', c.last_name || '', c.email || '', c.phone || '',
      c.country || '', c.position || '', c.club_name || '',
      c.graduation_year?.toString() || '', c.gender || '', c.gpa?.toString() || '', c.source || '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts-selected-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Exported', description: `${selected.length} contact(s) exported to CSV.` })
  }, [contacts, selectedIds])

  const handleBulkDelete = useCallback(async () => {
    try {
      await bulkDelete.mutateAsync(Array.from(selectedIds))
      toast({ title: 'Contacts deleted', description: `${selectedIds.size} contact(s) deleted.` })
      setSelectedIds(new Set())
      setBulkDeleteDialogOpen(false)
    } catch {
      toast({ title: 'Error', description: 'Failed to delete contacts.', variant: 'destructive' })
    }
  }, [selectedIds, bulkDelete])

  const handleBulkSubscriptionChange = useCallback(async (status: string) => {
    try {
      await bulkUpdateSubscription.mutateAsync({ contactIds: Array.from(selectedIds), status })
      toast({
        title: status === 'subscribed' ? 'Subscribed' : 'Unsubscribed',
        description: `${selectedIds.size} contact(s) updated.`,
      })
      setSelectedIds(new Set())
    } catch {
      toast({ title: 'Error', description: 'Failed to update contacts.', variant: 'destructive' })
    }
  }, [selectedIds, bulkUpdateSubscription])

  const handleBulkAddToList = useCallback(async (listId: string, listName: string) => {
    try {
      await addContactsToList.mutateAsync({ listId, contactIds: Array.from(selectedIds) })
      toast({ title: 'Added to list', description: `${selectedIds.size} contact(s) added to "${listName}".` })
      setSelectedIds(new Set())
    } catch {
      toast({ title: 'Error', description: 'Failed to add contacts to list.', variant: 'destructive' })
    }
  }, [selectedIds, addContactsToList])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <ContactsPageHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddContact={() => setCreateModalOpen(true)}
        onImportClick={() => setImportModalOpen(true)}
        onExportClick={handleExport}
      />

      {/* Stats */}
      <ContactStats
        totalContacts={stats?.totalContacts || 0}
        newThisMonth={stats?.newThisMonth || 0}
        subscribed={stats?.subscribed || 0}
        withDeals={stats?.withDeals || 0}
        isLoading={statsLoading}
      />

      {/* Tabs */}
      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="lists" asChild>
            <Link href="/lists">Lists</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <ContactFilters
        search={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(value) => {
          setStatusFilter(value)
          setPage(1)
        }}
        programmeFilter={programmeFilter}
        onProgrammeFilterChange={(value) => {
          setProgrammeFilter(value)
          setPage(1)
        }}
        countryFilter={countryFilter}
        onCountryFilterChange={(value) => {
          setCountryFilter(value)
          setPage(1)
        }}
        recruiterFilter={recruiterFilter}
        onRecruiterFilterChange={(value) => {
          setRecruiterFilter(value)
          setPage(1)
        }}
        tagFilter={tagFilter}
        onTagFilterChange={(value) => {
          setTagFilter(value)
          setPage(1)
        }}
        positionFilter={positionFilter}
        onPositionFilterChange={(value) => {
          setPositionFilter(value)
          setPage(1)
        }}
        ownerFilter={ownerFilter}
        onOwnerFilterChange={(value) => {
          setOwnerFilter(value)
          setPage(1)
        }}
        graduationYearFilter={graduationYearFilter}
        onGraduationYearFilterChange={(value) => {
          setGraduationYearFilter(value)
          setPage(1)
        }}
        genderFilter={genderFilter}
        onGenderFilterChange={(value) => {
          setGenderFilter(value)
          setPage(1)
        }}
        userId={userId}
        onClearFilters={handleClearFilters}
        trailing={viewMode === 'list' ? (
          <ColumnToggle
            visibleColumns={visibleColumns}
            onToggle={handleColumnToggle}
            customColumns={customFieldColumns}
          />
        ) : undefined}
      />

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-1 px-3 py-2 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Badge variant="secondary" className="bg-blue-600 text-white hover:bg-blue-600 text-xs font-semibold px-2.5 py-0.5 mr-2">
            {selectedIds.size} selected
          </Badge>

          <div className="w-px h-5 bg-blue-200 dark:bg-blue-700 mx-0.5" />

          {/* Export Selected */}
          <Button variant="ghost" size="sm" onClick={handleBulkExport} className="text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50">
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>

          <div className="w-px h-5 bg-blue-200 dark:bg-blue-700 mx-0.5" />

          {/* Add to List */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={addContactsToList.isPending} className="text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50">
                {addContactsToList.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ListPlus className="h-4 w-4 mr-1.5" />}
                Add to List
                <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
              {lists.length === 0 ? (
                <DropdownMenuItem disabled>No lists available</DropdownMenuItem>
              ) : (
                lists.map((list) => (
                  <DropdownMenuItem key={list.id} onClick={() => handleBulkAddToList(list.id, list.name)}>
                    {list.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-5 bg-blue-200 dark:bg-blue-700 mx-0.5" />

          {/* Subscription Status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={bulkUpdateSubscription.isPending} className="text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50">
                {bulkUpdateSubscription.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <MailCheck className="h-4 w-4 mr-1.5" />}
                Subscription
                <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleBulkSubscriptionChange('subscribed')}>
                <MailCheck className="h-4 w-4 mr-2 text-green-600" />
                Subscribe
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkSubscriptionChange('unsubscribed')}>
                <MailX className="h-4 w-4 mr-2 text-red-600" />
                Unsubscribe
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-5 bg-blue-200 dark:bg-blue-700 mx-0.5" />

          {/* Bulk Edit */}
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            onClick={() => setBulkEditOpen(true)}
          >
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit
          </Button>

          <div className="w-px h-5 bg-blue-200 dark:bg-blue-700 mx-0.5" />

          {/* Delete */}
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50"
            onClick={() => setBulkDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>

          <div className="flex-1" />

          {/* Clear Selection */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-blue-400 dark:text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Error State */}
      {error && (
        <ErrorState
          title="Failed to load contacts"
          message="We couldn't load your contacts. Please check your connection and try again."
          onRetry={() => refetch()}
          isRetrying={isFetching}
          compact
        />
      )}

      {/* Grid or Table View */}
      {viewMode === 'grid' ? (
        <ContactsGrid
          contacts={contacts}
          isLoading={isLoading}
          onViewProfile={handleRowClick}
          onEmailClick={handleEmailClick}
          onSMSClick={handleSMSClick}
        />
      ) : (
        <ContactsTable
          contacts={contacts}
          isLoading={isLoading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          selectedIds={selectedIds}
          onSelectChange={handleSelectChange}
          onSelectAll={handleSelectAll}
          onRowClick={handleRowClick}
          visibleColumns={visibleColumns}
          customColumns={customFieldColumns}
        />
      )}

      {/* Pagination */}
      {total > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          label="contacts"
        />
      )}

      {/* Create Contact Modal */}
      <CreateContactModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      {/* Contact Detail Sheet */}
      <ContactDetailSheet
        contactId={selectedContact?.id || null}
        isOpen={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        onEdit={(contact) => {
          setSelectedContact(null)
          setEditingContact(contact)
        }}
      />

      {/* Edit Contact Modal */}
      <EditContactModal
        contact={editingContact}
        isOpen={!!editingContact}
        onClose={() => setEditingContact(null)}
      />

      {/* Import CSV Modal */}
      <ImportCSVModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected contacts and all their associated data
              (deals, invoices, activities). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={bulkDelete.isPending}
            >
              {bulkDelete.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete All'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        contactIds={Array.from(selectedIds)}
        onSuccess={() => setSelectedIds(new Set())}
      />
    </div>
  )
}

export default function ContactsPage() {
  return (
    <Suspense>
      <ContactsPageContent />
    </Suspense>
  )
}
