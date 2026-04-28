'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import type { Contact } from '@/lib/types/contacts'
import { cn } from '@/lib/utils'

interface ContactsTableProps {
  contacts: Contact[]
  isLoading: boolean
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onSort: (column: string) => void
  selectedIds: Set<string>
  onSelectChange: (id: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  onRowClick?: (contact: Contact) => void
  visibleColumns?: string[]
  customColumns?: { key: string; label: string }[]
}

const ALL_TABLE_COLUMNS = [
  { key: 'name', label: 'Name', sortable: true, sortKey: 'first_name' },
  { key: 'email', label: 'Email', sortable: true, sortKey: 'email' },
  { key: 'phone', label: 'Phone', sortable: false },
  { key: 'graduation_year', label: 'Grad Year', sortable: true, sortKey: 'graduation_year' },
  { key: 'position', label: 'Position', sortable: true, sortKey: 'position' },
  { key: 'club_name', label: 'Club', sortable: true, sortKey: 'club_name' },
  { key: 'country', label: 'Country', sortable: true, sortKey: 'country' },
  { key: 'gpa', label: 'GPA', sortable: true, sortKey: 'gpa' },
  { key: 'tags', label: 'Tags', sortable: false },
  { key: 'source', label: 'Source', sortable: true, sortKey: 'source' },
  { key: 'created_at', label: 'Date Created', sortable: true, sortKey: 'created_at' },
  { key: 'football_background', label: 'Football BG', sortable: false },
  { key: 'academic_background', label: 'Academic BG', sortable: false },
  { key: 'degree_choice', label: 'Degree', sortable: false },
  { key: 'football_highlights', label: 'Highlights', sortable: false },
  { key: 'preferred_programme', label: 'Programme', sortable: false },
  { key: 'job_title', label: 'Job Title', sortable: false },
]

const DEFAULT_VISIBLE = [
  'name', 'email', 'phone', 'graduation_year', 'country', 'source',
]

export function ContactsTable({
  contacts,
  isLoading,
  sortBy,
  sortOrder,
  onSort,
  selectedIds,
  onSelectChange,
  onSelectAll,
  onRowClick,
  visibleColumns = DEFAULT_VISIBLE,
  customColumns = [],
}: ContactsTableProps) {
  const allColumns = [
    ...ALL_TABLE_COLUMNS,
    ...customColumns.map((c) => ({ key: c.key, label: c.label, sortable: false as const, sortKey: undefined as string | undefined })),
  ]
  const columns = allColumns.filter((col) => visibleColumns.includes(col.key))
  const allSelected = contacts.length > 0 && selectedIds.size === contacts.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < contacts.length

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  const sourceLabels: Record<string, string> = {
    'website_form': 'Website Form',
    'csv_import': 'CSV Import',
    'sms_reply': 'SMS Reply',
    'email_reply': 'Email Reply',
    'manual': 'Manual',
    'Manual Entry': 'Manual',
    'referral': 'Referral',
    'tournament': 'Tournament',
    'google_ads': 'Google Ads',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
  }

  const formatSource = (source: string | null) => {
    if (!source) return '-'
    return sourceLabels[source] || source
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground/50" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-1 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-1 h-4 w-4" />
    )
  }

  const renderCell = (contact: Contact, columnKey: string) => {
    switch (columnKey) {
      case 'name':
        return (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 text-xs font-medium">
                {getInitials(contact.first_name, contact.last_name)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium truncate" title={`${contact.first_name} ${contact.last_name}`}>
              {contact.first_name} {contact.last_name}
            </span>
          </div>
        )
      case 'email':
        return <span className="text-muted-foreground truncate block" title={contact.email}>{contact.email}</span>
      case 'phone':
        return <span className="text-muted-foreground">{contact.phone || '-'}</span>
      case 'graduation_year':
        return contact.graduation_year || '-'
      case 'position':
        return contact.position ? (
          <Badge variant="secondary" className="text-xs">{contact.position}</Badge>
        ) : '-'
      case 'club_name':
        return contact.club_name || '-'
      case 'country':
        return contact.country || '-'
      case 'gpa':
        return contact.gpa != null ? contact.gpa.toFixed(2) : '-'
      case 'tags':
        return contact.tags && contact.tags.length > 0 ? (
          <div className="flex items-center gap-1 flex-wrap">
            {contact.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                  borderColor: tag.color,
                }}
              >
                {tag.name}
              </Badge>
            ))}
            {contact.tags.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{contact.tags.length - 2}
              </span>
            )}
          </div>
        ) : '-'
      case 'source':
        return (
          <Badge variant="outline" className="font-normal">
            {formatSource(contact.source)}
          </Badge>
        )
      case 'created_at':
        return <span className="text-muted-foreground">{formatDate(contact.created_at)}</span>
      case 'football_background':
      case 'academic_background':
      case 'degree_choice':
      case 'football_highlights':
      case 'preferred_programme':
      case 'job_title': {
        const val = contact[columnKey as keyof Contact] as string | null
        return val ? <span className="max-w-[200px] truncate block" title={val}>{val}</span> : '-'
      }
      default:
        if (columnKey.startsWith('custom_') && contact.custom_fields) {
          const key = columnKey.slice(7)
          const cfVal = contact.custom_fields[key]
          return cfVal ? <span className="max-w-[200px] truncate block" title={cfVal}>{cfVal}</span> : '-'
        }
        return '-'
    }
  }

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox disabled />
              </TableHead>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-4" />
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {col.key === 'name' ? (
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    ) : (
                      <Skeleton className="h-4 w-20" />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (contacts.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center bg-white dark:bg-slate-900 dark:border-slate-700">
        <p className="text-muted-foreground">No contacts found</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox
                checked={someSelected ? 'indeterminate' : allSelected}
                onCheckedChange={(checked) => onSelectAll(checked === true)}
              />
            </TableHead>
            {columns.map((col) => {
              const colWidth: Record<string, string> = {
                name: 'w-[24%]',
                email: 'w-[24%]',
                phone: 'w-[15%]',
                graduation_year: 'w-[10%]',
                country: 'w-[14%]',
                source: 'w-[13%]',
              }
              return (
                <TableHead
                  key={col.key}
                  className={cn(
                    colWidth[col.key],
                    col.sortable && 'cursor-pointer select-none hover:bg-muted/50'
                  )}
                  onClick={() => col.sortable && col.sortKey && onSort(col.sortKey)}
                >
                  <div className="flex items-center">
                    {col.label}
                    {col.sortable && col.sortKey && <SortIcon column={col.sortKey} />}
                  </div>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow
              key={contact.id}
              className="cursor-pointer hover:bg-muted/50"
              data-selected={selectedIds.has(contact.id)}
              onClick={() => onRowClick?.(contact)}
            >
              <TableCell className="w-10 px-2">
                <Checkbox
                  checked={selectedIds.has(contact.id)}
                  onCheckedChange={(checked) =>
                    onSelectChange(contact.id, checked as boolean)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              {columns.map((col) => (
                <TableCell key={col.key} className="overflow-hidden text-ellipsis whitespace-nowrap">{renderCell(contact, col.key)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
