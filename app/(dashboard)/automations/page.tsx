'use client'

import { useState } from 'react'
import { AutomationsPageHeader } from '@/components/automations/AutomationsPageHeader'
import { AutomationStats } from '@/components/automations/AutomationStats'
import { AutomationTabs } from '@/components/automations/AutomationTabs'
import { AutomationsTable } from '@/components/automations/AutomationsTable'
import { RunHistoryTable } from '@/components/automations/RunHistoryTable'
import { AutomationDetailSheet } from '@/components/automations/AutomationDetailSheet'
import { useAutomations, useAutomationLogs, useToggleAutomation } from '@/lib/hooks/useAutomations'
import { useAutomationStats } from '@/lib/hooks/useAutomationStats'
import type { Automation, AutomationFilters } from '@/lib/types/automations'

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<'automations' | 'history'>('automations')
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null)
  const [historyFilters, setHistoryFilters] = useState<AutomationFilters>({})

  // Fetch data
  const { data: automations = [], isLoading: automationsLoading } = useAutomations()
  const { data: logs = [], isLoading: logsLoading } = useAutomationLogs(historyFilters)
  const { data: stats, isLoading: statsLoading } = useAutomationStats()
  const toggleAutomation = useToggleAutomation()

  const handleCreateClick = () => {
    // Future: Open create automation modal
    console.log('Create automation clicked')
  }

  const handleView = (automation: Automation) => {
    setSelectedAutomation(automation)
  }

  const handleEdit = (automation: Automation) => {
    // Future: Open edit automation modal
    console.log('Edit automation:', automation.id)
  }

  const handleToggle = async (automationId: string, isActive: boolean) => {
    try {
      await toggleAutomation.mutateAsync({ automationId, isActive })
    } catch (error) {
      console.error('Failed to toggle automation:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AutomationsPageHeader onCreateClick={handleCreateClick} />

      {/* Stats */}
      <AutomationStats
        totalAutomations={stats?.totalAutomations || 0}
        active={stats?.active || 0}
        paused={stats?.paused || 0}
        runsThisMonth={stats?.runsThisMonth || 0}
        isLoading={statsLoading}
      />

      {/* Tabs */}
      <AutomationTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      {activeTab === 'automations' ? (
        <AutomationsTable
          automations={automations}
          isLoading={automationsLoading}
          onView={handleView}
          onEdit={handleEdit}
          onToggle={handleToggle}
        />
      ) : (
        <RunHistoryTable
          logs={logs}
          automations={automations}
          isLoading={logsLoading}
          filters={historyFilters}
          onFiltersChange={setHistoryFilters}
        />
      )}

      {/* Detail Sheet */}
      <AutomationDetailSheet
        automationId={selectedAutomation?.id || null}
        isOpen={!!selectedAutomation}
        onClose={() => setSelectedAutomation(null)}
      />
    </div>
  )
}
