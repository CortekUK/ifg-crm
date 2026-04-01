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
import { Mail, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { EmailReplyCard } from './EmailReplyCard'
import { cn } from '@/lib/utils'
import type { EmailReply } from '@/lib/types/email'

interface EmailReplyListProps {
  replies: EmailReply[]
  isLoading: boolean
  onMatchClick: (reply: EmailReply) => void
  onViewContact: (contactId: string) => void
  onMarkSpam: (reply: EmailReply) => void
  onViewFull: (reply: EmailReply) => void
  emptyMessage?: string
  hasNextPage?: boolean
  onLoadMore?: () => void
  isLoadingMore?: boolean
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectChange?: (reply: EmailReply, selected: boolean) => void
}

type SortKey = 'from' | 'subject' | 'intent' | 'campaign' | 'status' | 'date'
type SortOrder = 'asc' | 'desc'

const columns: { key: SortKey | 'checkbox' | 'pipeline' | 'actions'; label: string; sortable: boolean; className?: string }[] = [
  { key: 'checkbox', label: '', sortable: false, className: 'w-10' },
  { key: 'from', label: 'From', sortable: true, className: 'w-[200px]' },
  { key: 'subject', label: 'Subject', sortable: true },
  { key: 'intent', label: 'Intent', sortable: true, className: 'w-[90px]' },
  { key: 'campaign', label: 'Campaign', sortable: true, className: 'w-[140px]' },
  { key: 'pipeline', label: 'Pipeline', sortable: false, className: 'w-[120px]' },
  { key: 'status', label: 'Status', sortable: true, className: 'w-[100px]' },
  { key: 'date', label: 'Date', sortable: true, className: 'w-[100px]' },
  { key: 'actions', label: '', sortable: false, className: 'w-[140px]' },
]

export function EmailReplyList({
  replies,
  isLoading,
  onMatchClick,
  onViewContact,
  onMarkSpam,
  onViewFull,
  emptyMessage = 'No emails to display.',
  hasNextPage,
  onLoadMore,
  isLoadingMore,
  selectable = false,
  selectedIds,
  onSelectChange,
}: EmailReplyListProps) {
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

  const sortedReplies = useMemo(() => {
    return [...replies].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'from': {
          const nameA = (a.from_name || a.from_email).toLowerCase()
          const nameB = (b.from_name || b.from_email).toLowerCase()
          comparison = nameA.localeCompare(nameB)
          break
        }
        case 'subject': {
          const subjectA = (a.subject || '').toLowerCase()
          const subjectB = (b.subject || '').toLowerCase()
          comparison = subjectA.localeCompare(subjectB)
          break
        }
        case 'intent': {
          const intentA = a.ai_intent || 'unknown'
          const intentB = b.ai_intent || 'unknown'
          comparison = intentA.localeCompare(intentB)
          break
        }
        case 'campaign': {
          const campaignA = a.campaign?.name || ''
          const campaignB = b.campaign?.name || ''
          comparison = campaignA.localeCompare(campaignB)
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
  }, [replies, sortBy, sortOrder])

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

  const allSelected = replies.length > 0 && selectedIds?.size === replies.length
  const someSelected = (selectedIds?.size ?? 0) > 0 && (selectedIds?.size ?? 0) < replies.length

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      replies.forEach((reply) => onSelectChange?.(reply, true))
    } else {
      replies.forEach((reply) => onSelectChange?.(reply, false))
    }
  }

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 overflow-x-auto">
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
                      <Skeleton className="h-2.5 w-32" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-48 mb-1" />
                  <Skeleton className="h-2.5 w-64" />
                </TableCell>
                <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                <TableCell><Skeleton className="h-3 w-24" /></TableCell>
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

  if (replies.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center bg-white dark:bg-slate-900 dark:border-slate-700">
        <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No emails</h3>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 overflow-x-auto">
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
            {sortedReplies.map((reply) => (
              <EmailReplyCard
                key={reply.id}
                reply={reply}
                onMatchClick={onMatchClick}
                onViewContact={onViewContact}
                onMarkSpam={onMarkSpam}
                onViewFull={onViewFull}
                selectable={selectable}
                selected={selectedIds?.has(reply.id)}
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
