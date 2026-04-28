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
  onUnmarkSpam?: (reply: EmailReply) => void
  onViewFull: (reply: EmailReply) => void
  emptyMessage?: string
  hasNextPage?: boolean
  onLoadMore?: () => void
  isLoadingMore?: boolean
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectChange?: (reply: EmailReply, selected: boolean) => void
}

type SortKey = 'from' | 'subject' | 'intent' | 'campaign' | 'received'
type SortOrder = 'asc' | 'desc'

// Status column was dropped — it duplicated the active tab (Unmatched/Matched/Spam).
// "Date" column renamed to "Received" since the cell shows relative time
// ("3 minutes ago"), not a calendar date.
const columns: { key: SortKey | 'checkbox' | 'pipeline' | 'actions'; label: string; sortable: boolean; className?: string }[] = [
  { key: 'checkbox', label: '', sortable: false, className: 'w-10' },
  { key: 'from', label: 'From', sortable: true, className: 'w-[200px]' },
  { key: 'subject', label: 'Subject', sortable: true },
  { key: 'intent', label: 'Intent', sortable: true, className: 'w-[100px]' },
  { key: 'campaign', label: 'Campaign', sortable: true, className: 'w-[140px]' },
  { key: 'pipeline', label: 'Pipeline', sortable: false, className: 'w-[120px]' },
  { key: 'received', label: 'Received', sortable: true, className: 'w-[110px]' },
  { key: 'actions', label: '', sortable: false, className: 'w-[100px]' },
]

export function EmailReplyList({
  replies,
  isLoading,
  onMatchClick,
  onViewContact,
  onMarkSpam,
  onUnmarkSpam,
  onViewFull,
  emptyMessage = 'Replies from contacts will appear here once they respond to one of your emails.',
  hasNextPage,
  onLoadMore,
  isLoadingMore,
  selectable = false,
  selectedIds,
  onSelectChange,
}: EmailReplyListProps) {
  const [sortBy, setSortBy] = useState<SortKey>('received')
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
          // Sort positive first, then question, then neutral, negative, unknown/null
          const order: Record<string, number> = {
            positive: 0,
            question: 1,
            neutral: 2,
            negative: 3,
            unknown: 4,
          }
          const rankA = order[a.ai_intent ?? 'unknown'] ?? 5
          const rankB = order[b.ai_intent ?? 'unknown'] ?? 5
          comparison = rankA - rankB
          break
        }
        case 'campaign': {
          const campaignA = a.campaign?.name || ''
          const campaignB = b.campaign?.name || ''
          comparison = campaignA.localeCompare(campaignB)
          break
        }
        case 'received': {
          const aDate = a.received_at || a.created_at
          const bDate = b.received_at || b.created_at
          comparison = new Date(aDate).getTime() - new Date(bDate).getTime()
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
                <TableCell><Skeleton className="h-3 w-16" /></TableCell>
                <TableCell><Skeleton className="h-7 w-16" /></TableCell>
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
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No replies yet</h3>
        <p className="text-muted-foreground max-w-md mx-auto">{emptyMessage}</p>
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
                onUnmarkSpam={onUnmarkSpam}
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
