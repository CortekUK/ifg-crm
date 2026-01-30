'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

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
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as 'unmatched' | 'matched' | 'spam')}>
      <TabsList>
        <TabsTrigger value="unmatched" className="gap-2">
          Unmatched
          <Badge variant="secondary" className="ml-1">
            {counts.unmatched}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="matched" className="gap-2">
          Matched
          <Badge variant="secondary" className="ml-1">
            {counts.matched}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="spam" className="gap-2">
          Spam
          <Badge variant="secondary" className="ml-1">
            {counts.spam}
          </Badge>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
