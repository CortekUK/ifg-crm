'use client'

// Compact report card. Earlier design had three stacked rows (icon /
// title-description / "Format: CSV" / full-width Generate button)
// which made each card ~150px tall and the page felt heavy. The new
// card folds the icon, title, description, and Generate trigger into
// a single tight horizontal row.

import { Button } from '@/components/ui/button'
import { Play, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReportCardProps {
  icon: LucideIcon
  name: string
  description: string
  onGenerate: () => void
}

export function ReportCard({ icon: Icon, name, description, onGenerate }: ReportCardProps) {
  return (
    <div
      className={cn(
        'group relative flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
        'transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md',
        'dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500/50',
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight text-slate-900 dark:text-white">
            {name}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <Button
        onClick={onGenerate}
        size="sm"
        variant="outline"
        className="mt-auto h-7 gap-1.5 border-blue-200 bg-blue-50 text-[12px] font-medium text-blue-700 hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300"
      >
        <Play className="h-3 w-3" />
        Generate CSV
      </Button>
    </div>
  )
}
