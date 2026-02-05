'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { MessageSquare, Loader2 } from 'lucide-react'
import { SMSReplyCard } from './SMSReplyCard'
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
  // Bulk selection props
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectChange?: (message: SMSMessage, selected: boolean) => void
}

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
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No messages</h3>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
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
      
      {/* Load More Button */}
      {hasNextPage && onLoadMore && (
        <div className="flex justify-center pt-4">
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
