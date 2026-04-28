'use client'

import { cn } from '@/lib/utils'

type IntentKey = 'all' | 'positive' | 'question' | 'negative' | 'neutral' | 'unknown'

interface IntentFilterChipsProps {
  value: IntentKey
  onChange: (value: IntentKey) => void
  counts: Record<IntentKey, number>
}

const chips: {
  key: IntentKey
  label: string
  /** Active background; inactive uses muted tones. */
  active: string
}[] = [
  { key: 'all', label: 'All', active: 'bg-blue-600 text-white border-blue-600' },
  { key: 'positive', label: 'Positive', active: 'bg-green-600 text-white border-green-600' },
  { key: 'question', label: 'Question', active: 'bg-purple-600 text-white border-purple-600' },
  { key: 'negative', label: 'Negative', active: 'bg-red-600 text-white border-red-600' },
  { key: 'neutral', label: 'Neutral', active: 'bg-slate-600 text-white border-slate-600' },
  { key: 'unknown', label: 'Unclassified', active: 'bg-slate-400 text-white border-slate-400' },
]

export function IntentFilterChips({ value, onChange, counts }: IntentFilterChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => {
        const isActive = value === chip.key
        const count = counts[chip.key]
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              isActive
                ? chip.active
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            )}
          >
            <span>{chip.label}</span>
            <span
              className={cn(
                'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                isActive
                  ? 'bg-white/25 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              )}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
