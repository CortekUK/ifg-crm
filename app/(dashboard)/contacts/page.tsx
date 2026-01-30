'use client'

import { useState, useCallback } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContactsPageHeader } from '@/components/contacts/ContactsPageHeader'
import { ContactStats } from '@/components/contacts/ContactStats'
import { ContactFilters } from '@/components/contacts/ContactFilters'
import { ContactsTable } from '@/components/contacts/ContactsTable'
import { ContactsTablePagination } from '@/components/contacts/ContactsTablePagination'
import { CreateContactModal } from '@/components/contacts/CreateContactModal'
import { ContactDetailSheet } from '@/components/contacts/ContactDetailSheet'
import { useContacts } from '@/lib/hooks/useContacts'
import { useContactStats } from '@/lib/hooks/useContactStats'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import type { Contact } from '@/lib/types/contacts'

export default function ContactsPage() {
  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Filter state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Sort state
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  // Debounce search to avoid too many API calls
  const debouncedSearch = useDebouncedValue(search, 300)

  // Build filters object
  const filters = {
    ...(statusFilter && statusFilter !== 'all' && { subscription_status: statusFilter }),
  }

  // Fetch contacts
  const { data, isLoading, error } = useContacts({
    page,
    pageSize,
    search: debouncedSearch,
    sortBy,
    sortOrder,
    filters,
  })

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useContactStats()

  const contacts = data?.contacts || []
  const total = data?.total || 0

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
    setPage(1)
  }, [])

  // Handle page size change
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1) // Reset to first page
  }, [])

  // Handle row click
  const handleRowClick = useCallback((contact: Contact) => {
    setSelectedContact(contact)
  }, [])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <ContactsPageHeader onAddContact={() => setCreateModalOpen(true)} />

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
          <TabsTrigger value="lists">Lists</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <ContactFilters
        search={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1) // Reset to first page on search
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(value) => {
          setStatusFilter(value)
          setPage(1) // Reset to first page on filter change
        }}
        onClearFilters={handleClearFilters}
      />

      {/* Selection Summary */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
          <span className="text-sm font-medium text-blue-700">
            {selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          Failed to load contacts. Please try again.
        </div>
      )}

      {/* Table */}
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
      />

      {/* Pagination */}
      {total > 0 && (
        <ContactsTablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
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
      />
    </div>
  )
}
