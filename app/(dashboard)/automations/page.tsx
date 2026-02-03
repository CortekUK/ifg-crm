'use client'

import { useState } from 'react'
import { AutomationsPageHeader } from '@/components/automations/AutomationsPageHeader'
import { AutomationStats } from '@/components/automations/AutomationStats'
import { AutomationTabs } from '@/components/automations/AutomationTabs'
import { AutomationsTable } from '@/components/automations/AutomationsTable'
import { RunHistoryTable } from '@/components/automations/RunHistoryTable'
import { AutomationDetailSheet } from '@/components/automations/AutomationDetailSheet'
import { ConfigureAutomationModal } from '@/components/automations/ConfigureAutomationModal'
import { useAutomations, useAutomationLogs, useToggleAutomation, useCreateAutomation, useUpdateAutomation } from '@/lib/hooks/useAutomations'
import { useAutomationStats } from '@/lib/hooks/useAutomationStats'
import { toast } from '@/lib/hooks/use-toast'
import type { Automation, AutomationFilters, AutomationType, AutomationConfig } from '@/lib/types/automations'

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
  const createAutomation = useCreateAutomation()
  const updateAutomation = useUpdateAutomation()

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

  const handleSaveAutomation = async (data: {
    id?: string
    name: string
    description?: string | null
    automation_type: AutomationType
    pipeline_id: string | null
    trigger_stage_id: string | null
    stop_on_stage_ids?: string[]
    config?: AutomationConfig | null
  }) => {
    try {
      if (editingAutomation) {
        // Update existing automation
        await updateAutomation.mutateAsync({
          id: editingAutomation.id,
          name: data.name,
          description: data.description,
          automation_type: data.automation_type,
          pipeline_id: data.pipeline_id,
          trigger_stage_id: data.trigger_stage_id,
          stop_on_stage_ids: data.stop_on_stage_ids,
          config: data.config,
        })
        toast({
          title: 'Automation updated',
          description: `"${data.name}" has been updated successfully.`,
        })
      } else {
        // Create new automation
        await createAutomation.mutateAsync({
          name: data.name,
          description: data.description,
          automation_type: data.automation_type,
          pipeline_id: data.pipeline_id,
          trigger_stage_id: data.trigger_stage_id,
          stop_on_stage_ids: data.stop_on_stage_ids,
          config: data.config,
        })
        toast({
          title: 'Automation created',
          description: `"${data.name}" has been created and is paused by default.`,
        })
      }
      setIsCreateModalOpen(false)
      setEditingAutomation(null)
    } catch (error) {
      console.error('Failed to save automation:', error)
      toast({
        title: 'Error',
        description: 'Failed to save automation. Please try again.',
        variant: 'destructive',
      })
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
        totalEnrolled={stats?.totalEnrolled || 0}
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
          config: editingAutomation.config ?? null,
        } : null}
      />
    </div>
  )
}