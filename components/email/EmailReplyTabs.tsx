'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

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
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as 'unmatched' | 'matched' | 'spam')}>
      <TabsList className="grid w-full grid-cols-3 h-auto p-1">
        <TabsTrigger value="unmatched" className="gap-2 py-3">
          <span className="font-medium">Unmatched</span>
          <Badge variant="secondary" className="ml-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
            {counts.unmatched}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="matched" className="gap-2 py-3">
          <span className="font-medium">Matched</span>
          <Badge variant="secondary" className="ml-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
            {counts.matched}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="spam" className="gap-2 py-3">
          <span className="font-medium">Spam</span>
          <Badge variant="secondary" className="ml-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            {counts.spam}
          </Badge>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
