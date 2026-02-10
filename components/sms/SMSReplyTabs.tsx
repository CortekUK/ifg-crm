'use client'

import { cn } from '@/lib/utils'

interface SMSReplyTabsProps {
  activeTab: 'unmatched' | 'matched' | 'spam'
  onTabChange: (tab: 'unmatched' | 'matched' | 'spam') => void
  counts: {
    unmatched: number
    matched: number
    spam: number
  }
}

export function SMSReplyTabs({ activeTab, onTabChange, counts }: SMSReplyTabsProps) {
  const tabs = [
    { id: 'unmatched' as const, label: 'Unmatched', count: counts.unmatched, color: 'red' },
    { id: 'matched' as const, label: 'Matched', count: counts.matched, color: 'green' },
    { id: 'spam' as const, label: 'Spam', count: counts.spam, color: 'gray' },
  ]

  return (
    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-0.5">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 py-1.5 px-3.5 rounded-md text-sm font-medium transition-all',
              isActive
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <span>{tab.label}</span>
            <span className={cn(
              'text-[11px] font-medium tabular-nums min-w-[1.25rem] text-center',
              isActive ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'
            )}>
              {tab.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
