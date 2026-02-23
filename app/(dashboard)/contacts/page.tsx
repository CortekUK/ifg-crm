'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
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
import { useContacts } from '@/lib/hooks/useContacts'
import { useContactStats } from '@/lib/hooks/useContactStats'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { createClient } from '@/lib/supabase/client'
import type { Contact } from '@/lib/types/contacts'
import { ErrorState } from '@/components/ui/error-state'

export default function ContactsPage() {
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

  // Current user ID
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

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
    </div>
  )
}
