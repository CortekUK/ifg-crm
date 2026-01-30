'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AutomationTabsProps {
  activeTab: 'automations' | 'history'
  onTabChange: (tab: 'automations' | 'history') => void
}

export function AutomationTabs({ activeTab, onTabChange }: AutomationTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as 'automations' | 'history')}>
      <TabsList>
        <TabsTrigger value="automations">Automations</TabsTrigger>
        <TabsTrigger value="history">Run History</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
