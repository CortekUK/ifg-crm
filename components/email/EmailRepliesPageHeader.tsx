'use client'

import { Badge } from '@/components/ui/badge'

interface EmailRepliesPageHeaderProps {
  unmatchedCount: number
}

export function EmailRepliesPageHeader({ unmatchedCount }: EmailRepliesPageHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-900 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-white/90 text-base">
            View and manage email responses from players.
          </p>
        </div>
        {unmatchedCount > 0 && (
          <Badge className="bg-red-500 text-white hover:bg-red-600 uppercase w-fit">
            {unmatchedCount} UNMATCHED
          </Badge>
        )}
      </div>
    </div>
  )
}
