'use client'

import { useState } from 'react'
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
import { ArrowUpDown, ArrowUp, ArrowDown, Mail, MessageSquare } from 'lucide-react'
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
}

const columns = [
  { key: 'name', label: 'Name', sortable: true, sortKey: 'first_name' },
  { key: 'email', label: 'Email', sortable: true, sortKey: 'email' },
  { key: 'phone', label: 'Phone', sortable: false },
  { key: 'graduation_year', label: 'Grad Year', sortable: true, sortKey: 'graduation_year' },
  { key: 'country', label: 'Country', sortable: true, sortKey: 'country' },
  { key: 'tags', label: 'Tags', sortable: false },
  { key: 'source', label: 'Source', sortable: true, sortKey: 'source' },
  { key: 'created_at', label: 'Date Created', sortable: true, sortKey: 'created_at' },
  { key: 'status', label: 'Status', sortable: true, sortKey: 'subscription_status' },
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
}: ContactsTableProps) {
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
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16" /></TableCell>
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={someSelected ? 'indeterminate' : allSelected}
                onCheckedChange={(checked) => onSelectAll(checked === true)}
              />
            </TableHead>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  col.sortable && 'cursor-pointer select-none hover:bg-muted/50'
                )}
                onClick={() => col.sortable && col.sortKey && onSort(col.sortKey)}
              >
                <div className="flex items-center">
                  {col.label}
                  {col.sortable && col.sortKey && <SortIcon column={col.sortKey} />}
                </div>
              </TableHead>
            ))}
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
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(contact.id)}
                  onCheckedChange={(checked) =>
                    onSelectChange(contact.id, checked as boolean)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 text-xs font-medium">
                      {getInitials(contact.first_name, contact.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {contact.first_name} {contact.last_name}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {contact.email}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {contact.phone || '-'}
              </TableCell>
              <TableCell>{contact.graduation_year || '-'}</TableCell>
              <TableCell>{contact.country || '-'}</TableCell>
              <TableCell>
                {contact.tags && contact.tags.length > 0 ? (
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
                ) : (
                  '-'
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">
                  {formatSource(contact.source)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(contact.created_at)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "p-1 rounded",
                      contact.email_subscribed !== false
                        ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400"
                        : "bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400"
                    )}
                    title={contact.email_subscribed !== false ? "Email subscribed" : "Email unsubscribed"}
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </div>
                  <div
                    className={cn(
                      "p-1 rounded",
                      contact.sms_subscribed !== false
                        ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400"
                        : "bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400"
                    )}
                    title={contact.sms_subscribed !== false ? "SMS subscribed" : "SMS unsubscribed"}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
