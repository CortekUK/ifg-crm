'use client'

import { useAuditLog } from '@/lib/hooks/useAuditLog'
import { Skeleton } from '@/components/ui/skeleton'
import { History } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface AuditTrailProps {
  entityType: string
  entityId: string | undefined
}

export function AuditTrail({ entityType, entityId }: AuditTrailProps) {
  const { data: entries, isLoading } = useAuditLog(entityType, entityId)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const userName = entry.user?.full_name || entry.user?.email || 'System'
        const changes = entry.new_value ? Object.entries(entry.new_value) : []

        return (
          <div key={entry.id} className="flex gap-3 text-sm">
            <div className="mt-1 h-2 w-2 rounded-full bg-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">{userName}</span>
                {' '}{entry.action}{' '}
                {changes.length > 0 && (
                  <span className="text-muted-foreground">
                    {changes.map(([key, val]) => (
                      <span key={key}>
                        {key.replace(/_/g, ' ')} to <span className="font-medium text-gray-900 dark:text-white">{String(val)}</span>
                      </span>
                    )).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
