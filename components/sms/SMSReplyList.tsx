'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { MessageSquare, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { SMSReplyCard } from './SMSReplyCard'
import { cn } from '@/lib/utils'
import type { SMSMessage } from '@/lib/types/sms'

interface SMSReplyListProps {
  messages: SMSMessage[]
  isLoading: boolean
  onMatchClick: (message: SMSMessage) => void
  onViewContact: (contactId: string) => void
  onMarkSpam: (message: SMSMessage) => void
  onViewFull: (message: SMSMessage) => void
  emptyMessage?: string
  hasNextPage?: boolean
  onLoadMore?: () => void
  isLoadingMore?: boolean
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectChange?: (message: SMSMessage, selected: boolean) => void
}

type SortKey = 'from' | 'message' | 'intent' | 'status' | 'date'
type SortOrder = 'asc' | 'desc'

const columns: { key: SortKey | 'checkbox' | 'pipeline' | 'actions'; label: string; sortable: boolean; className?: string }[] = [
  { key: 'checkbox', label: '', sortable: false, className: 'w-10' },
  { key: 'from', label: 'From', sortable: true, className: 'w-[180px]' },
  { key: 'message', label: 'Message', sortable: false },
  { key: 'intent', label: 'Intent', sortable: true, className: 'w-[90px]' },
  { key: 'pipeline', label: 'Pipeline', sortable: false, className: 'w-[120px]' },
  { key: 'status', label: 'Status', sortable: true, className: 'w-[100px]' },
  { key: 'date', label: 'Date', sortable: true, className: 'w-[100px]' },
  { key: 'actions', label: '', sortable: false, className: 'w-[140px]' },
]

export function SMSReplyList({
  messages,
  isLoading,
  onMatchClick,
  onViewContact,
  onMarkSpam,
  onViewFull,
  emptyMessage = 'No messages to display.',
  hasNextPage,
  onLoadMore,
  isLoadingMore,
  selectable = false,
  selectedIds,
  onSelectChange,
}: SMSReplyListProps) {
  const [sortBy, setSortBy] = useState<SortKey>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder('asc')
    }
  }

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'from': {
          const nameA = a.contact
            ? `${a.contact.first_name} ${a.contact.last_name}`.toLowerCase()
            : a.phone_number
          const nameB = b.contact
            ? `${b.contact.first_name} ${b.contact.last_name}`.toLowerCase()
            : b.phone_number
          comparison = nameA.localeCompare(nameB)
          break
        }
        case 'message': {
          comparison = a.content.localeCompare(b.content)
          break
        }
        case 'intent': {
          const intentA = a.ai_intent || 'unknown'
          const intentB = b.ai_intent || 'unknown'
          comparison = intentA.localeCompare(intentB)
          break
        }
        case 'status': {
          const statusOrder = { spam: 0, unmatched: 1, auto_matched: 2, manually_matched: 3 }
          comparison = (statusOrder[a.match_status as keyof typeof statusOrder] ?? 1) - (statusOrder[b.match_status as keyof typeof statusOrder] ?? 1)
          break
        }
        case 'date': {
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [messages, sortBy, sortOrder])

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/50" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5" />
    )
  }

  const allSelected = messages.length > 0 && selectedIds?.size === messages.length
  const someSelected = (selectedIds?.size ?? 0) > 0 && (selectedIds?.size ?? 0) < messages.length

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      messages.forEach((message) => onSelectChange?.(message, true))
    } else {
      messages.forEach((message) => onSelectChange?.(message, false))
    }
  }

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-3 w-64" /></TableCell>
                <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                <TableCell><Skeleton className="h-3 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-3 w-16" /></TableCell>
                <TableCell><Skeleton className="h-7 w-20" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center bg-white dark:bg-slate-900 dark:border-slate-700">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No messages</h3>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.className,
                    col.sortable && 'cursor-pointer select-none hover:bg-muted/50'
                  )}
                  onClick={() => col.sortable && handleSort(col.key as SortKey)}
                >
                  {col.key === 'checkbox' && selectable ? (
                    <Checkbox
                      checked={someSelected ? 'indeterminate' : allSelected}
                      onCheckedChange={(checked) => handleSelectAll(checked === true)}
                    />
                  ) : (
                    <div className="flex items-center">
                      {col.label}
                      {col.sortable && <SortIcon column={col.key as SortKey} />}
                    </div>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMessages.map((message) => (
              <SMSReplyCard
                key={message.id}
                message={message}
                onMatchClick={onMatchClick}
                onViewContact={onViewContact}
                onMarkSpam={onMarkSpam}
                onViewFull={onViewFull}
                selectable={selectable}
                selected={selectedIds?.has(message.id)}
                onSelectChange={onSelectChange}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Load More Button */}
      {hasNextPage && onLoadMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
