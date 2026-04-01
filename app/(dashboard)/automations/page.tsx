'use client'

import { useState, useMemo } from 'react'
import { AutomationsPageHeader } from '@/components/automations/AutomationsPageHeader'
import { AutomationStats } from '@/components/automations/AutomationStats'
import { AutomationTabs } from '@/components/automations/AutomationTabs'
import { AutomationsTable } from '@/components/automations/AutomationsTable'
import { RunHistoryTable } from '@/components/automations/RunHistoryTable'
import { AutomationDetailSheet } from '@/components/automations/AutomationDetailSheet'
import { ConfigureAutomationModal } from '@/components/automations/ConfigureAutomationModal'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Filter } from 'lucide-react'
import { useAutomations, useAutomationLogs, useToggleAutomation, useCreateAutomation, useUpdateAutomation, useDeleteAutomation, useDuplicateAutomation } from '@/lib/hooks/useAutomations'
import { useAutomationStats } from '@/lib/hooks/useAutomationStats'
import { toast } from '@/lib/hooks/use-toast'
import type { Automation, AutomationFilters, AutomationType, AutomationConfig } from '@/lib/types/automations'

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<'automations' | 'history'>('automations')
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null)
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [historyFilters, setHistoryFilters] = useState<AutomationFilters>({})
  const [automationToDelete, setAutomationToDelete] = useState<Automation | null>(null)
  const [pipelineFilter, setPipelineFilter] = useState<string>('all')

  // Fetch data
  const { data: automations = [], isLoading: automationsLoading } = useAutomations()
  const { data: logs = [], isLoading: logsLoading } = useAutomationLogs(historyFilters)
  const { data: stats, isLoading: statsLoading } = useAutomationStats()
  const toggleAutomation = useToggleAutomation()
  const createAutomation = useCreateAutomation()
  const updateAutomation = useUpdateAutomation()
  const deleteAutomation = useDeleteAutomation()
  const duplicateAutomation = useDuplicateAutomation()

  // Extract unique pipelines from automations for the filter
  const uniquePipelines = useMemo(() => {
    const pipelineMap = new Map<string, string>()
    automations.forEach((a) => {
      if (a.pipeline_id && a.pipeline?.name) {
        pipelineMap.set(a.pipeline_id, a.pipeline.name)
      }
    })
    return Array.from(pipelineMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [automations])

  // Filter automations by selected pipeline
  const filteredAutomations = useMemo(() => {
    if (pipelineFilter === 'all') return automations
    return automations.filter((a) => a.pipeline_id === pipelineFilter)
  }, [automations, pipelineFilter])

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

  const handleDuplicate = async (automationId: string) => {
    try {
      await duplicateAutomation.mutateAsync(automationId)
      toast({
        title: 'Automation duplicated',
        description: 'A copy of the automation has been created (paused by default).',
      })
    } catch (error) {
      console.error('Failed to duplicate automation:', error)
      toast({
        title: 'Error',
        description: 'Failed to duplicate automation. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
    if (!automationToDelete) return
    
    try {
      await deleteAutomation.mutateAsync(automationToDelete.id)
      toast({
        title: 'Automation deleted',
        description: `"${automationToDelete.name}" has been deleted.`,
      })
      setAutomationToDelete(null)
    } catch (error) {
      console.error('Failed to delete automation:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete automation. Please try again.',
        variant: 'destructive',
      })
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
    } catch (error: unknown) {
      console.error('Failed to save automation:', error)
      const message = error instanceof Error ? error.message
        : (error as { message?: string })?.message || 'Unknown error'
      toast({
        title: 'Error',
        description: `Failed to save automation: ${message}`,
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

      {/* Tabs + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <AutomationTabs activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === 'automations' && uniquePipelines.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={pipelineFilter} onValueChange={setPipelineFilter}>
              <SelectTrigger className="w-[160px] sm:w-[200px] h-9">
                <SelectValue placeholder="All Pipelines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pipelines</SelectItem>
                {uniquePipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Content */}
      {activeTab === 'automations' ? (
        <AutomationsTable
          automations={filteredAutomations}
          isLoading={automationsLoading}
          onView={handleView}
          onEdit={handleEdit}
          onToggle={handleToggle}
          onDuplicate={handleDuplicate}
          onDelete={setAutomationToDelete}
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
          config: {
            ...(editingAutomation.config || {}),
            // Populate emails from existing steps so template IDs are preserved on save
            emails: editingAutomation.steps
              ?.sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order)
              .filter((s: { step_type: string }) => s.step_type === 'send_email')
              .map((s: { email_template_id: string | null }, i: number) => ({
                step: i,
                template_id: s.email_template_id || '',
              })) || [],
          },
        } : null}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!automationToDelete} onOpenChange={() => setAutomationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete automation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{automationToDelete?.name}&quot;? This will also remove all 
              enrollment history and logs associated with this automation. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}