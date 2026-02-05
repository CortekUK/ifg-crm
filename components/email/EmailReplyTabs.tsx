'use client'

import { cn } from '@/lib/utils'

interface EmailReplyTabsProps {
  activeTab: 'unmatched' | 'matched' | 'spam'
  onTabChange: (tab: 'unmatched' | 'matched' | 'spam') => void
  counts: {
    unmatched: number
    matched: number
    spam: number
  }
}

export function EmailReplyTabs({ activeTab, onTabChange, counts }: EmailReplyTabsProps) {
  const tabs = [
    { id: 'unmatched' as const, label: 'Unmatched', count: counts.unmatched, color: 'red' },
    { id: 'matched' as const, label: 'Matched', count: counts.matched, color: 'green' },
    { id: 'spam' as const, label: 'Spam', count: counts.spam, color: 'gray' },
  ]

  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1.5 gap-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all',
              isActive
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full min-w-[1.5rem]',
                isActive
                  ? tab.color === 'red'
                    ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                    : tab.color === 'green'
                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              )}
            >
              {tab.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
