'use client'

import { useState } from 'react'
import { AutomationsPageHeader } from '@/components/automations/AutomationsPageHeader'
import { AutomationStats } from '@/components/automations/AutomationStats'
import { AutomationTabs } from '@/components/automations/AutomationTabs'
import { AutomationsTable } from '@/components/automations/AutomationsTable'
import { RunHistoryTable } from '@/components/automations/RunHistoryTable'
import { AutomationDetailSheet } from '@/components/automations/AutomationDetailSheet'
import { ConfigureAutomationModal } from '@/components/automations/ConfigureAutomationModal'
import { useAutomations, useAutomationLogs, useToggleAutomation } from '@/lib/hooks/useAutomations'
import { useAutomationStats } from '@/lib/hooks/useAutomationStats'
import type { Automation, AutomationFilters } from '@/lib/types/automations'

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<'automations' | 'history'>('automations')
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null)
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [historyFilters, setHistoryFilters] = useState<AutomationFilters>({})

  // Fetch data
  const { data: automations = [], isLoading: automationsLoading } = useAutomations()
  const { data: logs = [], isLoading: logsLoading } = useAutomationLogs(historyFilters)
  const { data: stats, isLoading: statsLoading } = useAutomationStats()
  const toggleAutomation = useToggleAutomation()

  const handleCreateClick = () => {
    setEditingAutomation(null)
    setIsCreateModalOpen(true)
  }

  const handleView = (automation: Automation) => {
    setSelectedAutomation(automation)
  }

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation)
    setIsCreateModalOpen(true)
  }

  const handleToggle = async (automationId: string, isActive: boolean) => {
    try {
      await toggleAutomation.mutateAsync({ automationId, isActive })
    } catch (error) {
      console.error('Failed to toggle automation:', error)
    }
  }

  const handleSaveAutomation = async (data: any) => {
    // TODO: Implement save to Supabase
    console.log('Save automation:', data)
    // For now, just close the modal
    setIsCreateModalOpen(false)
    setEditingAutomation(null)
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
        onEdit={() => {
          if (selectedAutomation) {
            handleEdit(selectedAutomation)
            setSelectedAutomation(null)
          }
        }}
      />

      {/* Create/Edit Modal */}
      <ConfigureAutomationModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setEditingAutomation(null)
        }}
        onSave={handleSaveAutomation}
        editingAutomation={editingAutomation ? {
          id: editingAutomation.id,
          name: editingAutomation.name,
          description: editingAutomation.description,
          automation_type: editingAutomation.automation_type || 'initial_contact',
          pipeline_id: editingAutomation.pipeline_id,
          trigger_stage_id: editingAutomation.trigger_stage_id,
          stop_on_stage_ids: editingAutomation.stop_on_stage_ids,
          config: editingAutomation.config,
        } : null}
      />
    </div>
  )
}