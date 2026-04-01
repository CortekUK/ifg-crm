'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { DropResult } from '@hello-pangea/dnd'
import { PipelinesPageHeader } from '@/components/pipelines/PipelinesPageHeader'
import { PipelineFilters } from '@/components/pipelines/PipelineFilters'
import { PipelineStats } from '@/components/pipelines/PipelineStats'
import { KanbanBoard } from '@/components/pipelines/KanbanBoard'
import { PipelineListView } from '@/components/pipelines/PipelineListView'
import { usePipelineViewPreference } from '@/lib/hooks/usePipelineViewPreference'
import { AddDealModal } from '@/components/pipelines/AddDealModal'
import { DealDetailSheet } from '@/components/pipelines/DealDetailSheet'
import { CreatePipelineModal } from '@/components/pipelines/CreatePipelineModal'
import { PipelineSettingsModal } from '@/components/pipelines/PipelineSettingsModal'
import { usePipelines, usePipelineDealCounts } from '@/lib/hooks/usePipelines'
import { usePipelineStages } from '@/lib/hooks/usePipelineStages'
import { useDeals, useMoveDeal } from '@/lib/hooks/useDeals'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { toast } from '@/lib/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import type { PipelineStage, Deal } from '@/lib/types/pipelines'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'

const PIPELINE_STORAGE_KEY = 'ifg-crm-selected-pipeline'
const KANBAN_ZOOM_KEY = 'ifg-crm-kanban-zoom'

export default function PipelinesPage() {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [userId, setUserId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Exit fullscreen on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFullscreen])

  // Modal state
  const [addDealModalOpen, setAddDealModalOpen] = useState(false)
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [createPipelineModalOpen, setCreatePipelineModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)

  // Fetch current user (with role)
  const { data: currentUser } = useCurrentUser()
  useEffect(() => {
    if (currentUser?.id) {
      setUserId(currentUser.id)
    }
  }, [currentUser?.id])

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  // Fetch pipelines
  const { data: pipelines = [], isLoading: pipelinesLoading } = usePipelines()

  // Fetch deal counts per pipeline
  const { data: dealCounts = {} } = usePipelineDealCounts()

  // Fetch stages for selected pipeline
  const { data: stages = [], isLoading: stagesLoading } = usePipelineStages(
    selectedPipelineId
  )

  // Fetch deals for selected pipeline
  const { data: deals = [], isLoading: dealsLoading, error: dealsError, refetch: refetchDeals, isFetching: dealsFetching } = useDeals(selectedPipelineId)

  // Mutation for moving deals
  const moveDeal = useMoveDeal()

  // View mode preference (kanban or list)
  const { viewMode, setViewMode } = usePipelineViewPreference()

  // Load selected pipeline and zoom from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(PIPELINE_STORAGE_KEY)
    if (stored) {
      setSelectedPipelineId(stored)
    }
    const storedZoom = localStorage.getItem(KANBAN_ZOOM_KEY)
    if (storedZoom) {
      setZoom(parseFloat(storedZoom))
    }
  }, [])

  // Set default pipeline when data loads (only if not already set)
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      // Check if stored pipeline still exists
      const stored = localStorage.getItem(PIPELINE_STORAGE_KEY)
      if (stored && pipelines.some(p => p.id === stored)) {
        setSelectedPipelineId(stored)
      } else {
        setSelectedPipelineId(pipelines[0].id)
      }
    }
  }, [pipelines, selectedPipelineId])

  // Save selected pipeline to localStorage
  const handlePipelineChange = useCallback((pipelineId: string) => {
    setSelectedPipelineId(pipelineId)
    localStorage.setItem(PIPELINE_STORAGE_KEY, pipelineId)
  }, [])

  // Save zoom level to localStorage
  const handleZoomChange = useCallback((newZoom: number) => {
    const rounded = Math.round(newZoom * 10) / 10
    setZoom(rounded)
    localStorage.setItem(KANBAN_ZOOM_KEY, rounded.toString())
  }, [])

  // Filter deals by search, owner, and status
  const filteredDeals = useMemo(() => deals.filter((deal) => {
    // Search filter
    if (search) {
      const contactName = deal.contact
        ? `${deal.contact.first_name} ${deal.contact.last_name}`.toLowerCase()
        : deal.title.toLowerCase()
      if (!contactName.includes(search.toLowerCase()) && !deal.title.toLowerCase().includes(search.toLowerCase())) {
        return false
      }
    }

    // Owner filter
    if (ownerFilter && ownerFilter !== 'all') {
      if (deal.deal_owner_id !== ownerFilter) {
        return false
      }
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'won' && !deal.won_at) return false
      if (statusFilter === 'lost' && !deal.lost_at) return false
      if (statusFilter === 'open' && (deal.won_at || deal.lost_at)) return false
    }

    return true
  }), [deals, search, ownerFilter, statusFilter])

  // Trigger automation processing immediately after deal move
  const triggerAutomationProcessing = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl || !session?.access_token) return

      // Small delay to let the DB trigger create the enrollment first
      await new Promise(resolve => setTimeout(resolve, 500))

      await fetch(`${supabaseUrl}/functions/v1/process-automations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      })
    } catch (err) {
      // Non-critical — cron will pick it up as fallback
      console.log('Automation trigger (non-critical):', err)
    }
  }, [])

  // Execute the move deal mutation
  const executeMoveDeals = useCallback(
    (dealId: string, newStageId: string, oldStageName?: string, newStageName?: string) => {
      if (!selectedPipelineId) return

      moveDeal.mutate(
        {
          dealId,
          newStageId,
          pipelineId: selectedPipelineId,
          oldStageName,
          newStageName,
          performedById: userId || undefined,
        },
        {
          onSuccess: () => {
            toast({
              title: 'Deal moved',
              description: `Moved to ${newStageName || 'new stage'}`,
            })
            // Trigger automation processing immediately
            triggerAutomationProcessing()
          },
          onError: (error) => {
            toast({
              title: 'Failed to move deal',
              description: error instanceof Error ? error.message : 'An error occurred',
              variant: 'destructive',
            })
          },
        }
      )
    },
    [moveDeal, selectedPipelineId, userId, triggerAutomationProcessing]
  )

  // Core stage change logic - auto-stops active automations and moves the deal
  const handleStageChange = useCallback(
    async (dealId: string, newStageId: string, oldStage?: PipelineStage, newStage?: PipelineStage) => {
      if (!selectedPipelineId) return

      const supabase = createClient()

      // Auto-stop any active automation enrollments for this deal
      const { data: activeEnrollments } = await supabase
        .from('automation_enrollments')
        .select('id')
        .eq('deal_id', dealId)
        .eq('status', 'active')

      if (activeEnrollments && activeEnrollments.length > 0) {
        await supabase
          .from('automation_enrollments')
          .update({
            status: 'stopped',
            stopped_reason: 'Auto-stopped on stage move',
            next_step_at: null,
          })
          .in('id', activeEnrollments.map(e => e.id))
      }

      // Move the deal — DB trigger will auto-enroll in new stage's automation if one exists
      executeMoveDeals(dealId, newStageId, oldStage?.name, newStage?.name)
    },
    [executeMoveDeals, selectedPipelineId]
  )

  // Check if current user can move a specific deal
  const canMoveDeal = useCallback(
    (deal: Deal) => {
      if (isAdmin) return true
      return deal.deal_owner_id === userId
    },
    [isAdmin, userId]
  )

  // Handle drag end (for Kanban board)
  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result

      // Dropped outside a valid droppable
      if (!destination) return

      // Dropped in same position
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return
      }

      // Different column = stage changed
      if (destination.droppableId !== source.droppableId && selectedPipelineId) {
        // Ownership check: recruiters can only move their own deals
        const deal = deals.find((d) => d.id === draggableId)
        if (deal && !canMoveDeal(deal)) {
          toast({
            title: 'Cannot move deal',
            description: 'You can only move deals that are assigned to you.',
            variant: 'destructive',
          })
          return
        }

        const oldStage = stages.find((s) => s.id === source.droppableId)
        const newStage = stages.find((s) => s.id === destination.droppableId)
        await handleStageChange(draggableId, destination.droppableId, oldStage, newStage)
      }
    },
    [handleStageChange, selectedPipelineId, stages, deals, canMoveDeal]
  )

  // Handle add click from column
  const handleAddClick = useCallback((stage: PipelineStage) => {
    setSelectedStage(stage)
    setAddDealModalOpen(true)
  }, [])

  // Handle add deal from header - use first stage as default
  const handleAddDealFromHeader = useCallback(() => {
    if (stages.length > 0) {
      setSelectedStage(stages[0])
      setAddDealModalOpen(true)
    }
  }, [stages])

  // Handle deal click
  const handleDealClick = useCallback((deal: Deal) => {
    setSelectedDeal(deal)
  }, [])

  // Get selected pipeline object
  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId) || null

  // Get last updated time from deals
  const lastUpdated = deals.length > 0
    ? deals.reduce((latest, deal) => {
        const dealDate = new Date(deal.updated_at)
        return dealDate > new Date(latest) ? deal.updated_at : latest
      }, deals[0].updated_at)
    : undefined

  const isLoading = pipelinesLoading || stagesLoading || dealsLoading

  return (
    <div className={cn(
      'space-y-6',
      isFullscreen && 'fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 p-6 overflow-auto'
    )}>
      {/* Page Header with Pipeline Selector */}
      {!isFullscreen && (
        <PipelinesPageHeader
          pipelines={pipelines}
          selectedPipelineId={selectedPipelineId}
          onPipelineChange={handlePipelineChange}
          onOpenSettings={() => setSettingsModalOpen(true)}
          onOpenCreate={() => setCreatePipelineModalOpen(true)}
          onAddDeal={handleAddDealFromHeader}
          isLoading={pipelinesLoading}
          dealCounts={dealCounts}
        />
      )}

      {/* Filters */}
      <PipelineFilters
        search={search}
        onSearchChange={setSearch}
        ownerFilter={ownerFilter}
        onOwnerFilterChange={setOwnerFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        deals={deals}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        userId={userId}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        isFullscreen={isFullscreen}
        onFullscreenToggle={() => setIsFullscreen((prev) => !prev)}
        onOpenSettings={() => setSettingsModalOpen(true)}
        settingsDisabled={!selectedPipelineId || pipelinesLoading}
      />

      {/* Stats */}
      {!isFullscreen && <PipelineStats deals={filteredDeals} lastUpdated={lastUpdated} userId={userId} isAdmin={isAdmin} />}

      {/* Error State - only show if there are no deals */}
      {dealsError && deals.length === 0 && (
        <ErrorState
          title="Failed to load deals"
          message="We couldn't load the deals for this pipeline. Please check your connection and try again."
          onRetry={() => refetchDeals()}
          isRetrying={dealsFetching}
          compact
        />
      )}

      {/* Pipeline View - Kanban or List */}
      {viewMode === 'kanban' ? (
        <KanbanBoard
          stages={stages}
          deals={filteredDeals}
          pipelineId={selectedPipelineId}
          isLoading={isLoading && !stages.length}
          zoom={zoom}
          onDragEnd={handleDragEnd}
          onAddClick={handleAddClick}
          onDealClick={handleDealClick}
          canMoveDeal={canMoveDeal}
        />
      ) : (
        <PipelineListView
          deals={filteredDeals}
          stages={stages}
          pipelineId={selectedPipelineId}
          isLoading={isLoading && !stages.length}
          onDealClick={handleDealClick}
          onStageChange={handleStageChange}
          canMoveDeal={canMoveDeal}
        />
      )}

      {/* Add Deal Modal */}
      {selectedStage && selectedPipelineId && userId && (
        <AddDealModal
          isOpen={addDealModalOpen}
          onClose={() => {
            setAddDealModalOpen(false)
            setSelectedStage(null)
          }}
          pipelineId={selectedPipelineId}
          stage={selectedStage}
          userId={userId}
        />
      )}

      {/* Deal Detail Sheet */}
      {userId && (
        <DealDetailSheet
          deal={selectedDeal}
          isOpen={!!selectedDeal}
          onClose={() => setSelectedDeal(null)}
          userId={userId}
        />
      )}

      {/* Create Pipeline Modal */}
      <CreatePipelineModal
        isOpen={createPipelineModalOpen}
        onClose={() => setCreatePipelineModalOpen(false)}
      />

      {/* Pipeline Settings Modal */}
      <PipelineSettingsModal
        pipeline={selectedPipeline}
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

    </div>
  )
}
