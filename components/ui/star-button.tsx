'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToggleStar } from '@/lib/hooks/useStarredItems'

interface StarButtonProps {
  entityType: 'contact' | 'deal'
  entityId: string
  isStarred: boolean
  className?: string
}

export function StarButton({ entityType, entityId, isStarred, className }: StarButtonProps) {
  const toggleStar = useToggleStar()

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        toggleStar.mutate({ entityType, entityId, isStarred })
      }}
      className={cn(
        'p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors',
        className
      )}
      title={isStarred ? 'Remove from starred' : 'Add to starred'}
    >
      <Star
        className={cn(
          'h-4 w-4',
          isStarred
            ? 'fill-yellow-400 text-yellow-400'
            : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400'
        )}
      />
    </button>
  )
}
