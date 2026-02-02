'use client'

import { useState, useEffect, useCallback } from 'react'
import { DropResult } from '@hello-pangea/dnd'
import { PipelinesPageHeader } from '@/components/pipelines/PipelinesPageHeader'
import { PipelineFilters } from '@/components/pipelines/PipelineFilters'
import { PipelineStats } from '@/components/pipelines/PipelineStats'
import { KanbanBoard } from '@/components/pipelines/KanbanBoard'
import { AddDealModal } from '@/components/pipelines/AddDealModal'
import { DealDetailSheet } from '@/components/pipelines/DealDetailSheet'
import { usePipelines, usePipelineDealCounts } from '@/lib/hooks/usePipelines'
import { usePipelineStages } from '@/lib/hooks/usePipelineStages'
import { useDeals, useMoveDeal } from '@/lib/hooks/useDeals'
import { toast } from '@/lib/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import type { PipelineStage, Deal } from '@/lib/types/pipelines'
import { ErrorState } from '@/components/ui/error-state'

const PIPELINE_STORAGE_KEY = 'ifg-crm-selected-pipeline'

export default function PipelinesPage() {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [userId, setUserId] = useState<string | null>(null)
  
  // Modal state
  const [addDealModalOpen, setAddDealModalOpen] = useState(false)
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    fetchUser()
  }, [])

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

  // Load selected pipeline from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(PIPELINE_STORAGE_KEY)
    if (stored) {
      setSelectedPipelineId(stored)
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

  // Filter deals by search, owner, and status
  const filteredDeals = deals.filter((deal) => {
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
  })

  // Handle drag end
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
        const oldStage = stages.find((s) => s.id === source.droppableId)
        const newStage = stages.find((s) => s.id === destination.droppableId)

        moveDeal.mutate(
          {
            dealId: draggableId,
            newStageId: destination.droppableId,
            pipelineId: selectedPipelineId,
            oldStageName: oldStage?.name,
            newStageName: newStage?.name,
            performedById: userId || undefined,
          },
          {
            onSuccess: () => {
              toast({
                title: 'Deal moved',
                description: `Moved to ${newStage?.name || 'new stage'}`,
              })
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
      }
    },
    [moveDeal, selectedPipelineId, stages, userId]
  )

  // Handle add click from column
  const handleAddClick = useCallback((stage: PipelineStage) => {
    setSelectedStage(stage)
    setAddDealModalOpen(true)
  }, [])

  // Handle deal click
  const handleDealClick = useCallback((deal: Deal) => {
    setSelectedDeal(deal)
  }, [])

  // Get last updated time from deals
  const lastUpdated = deals.length > 0
    ? deals.reduce((latest, deal) => {
        const dealDate = new Date(deal.updated_at)
        return dealDate > new Date(latest) ? deal.updated_at : latest
      }, deals[0].updated_at)
    : undefined

  const isLoading = pipelinesLoading || stagesLoading || dealsLoading

  return (
    <div className="space-y-6">
      {/* Page Header with Pipeline Selector */}
      <PipelinesPageHeader
        pipelines={pipelines}
        selectedPipelineId={selectedPipelineId}
        onPipelineChange={handlePipelineChange}
        isLoading={pipelinesLoading}
        dealCounts={dealCounts}
      />

      {/* Filters */}
      <PipelineFilters
        search={search}
        onSearchChange={setSearch}
        ownerFilter={ownerFilter}
        onOwnerFilterChange={setOwnerFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        deals={deals}
      />

      {/* Stats */}
      <PipelineStats deals={filteredDeals} lastUpdated={lastUpdated} />

      {/* Error State */}
      {dealsError && (
        <ErrorState
          title="Failed to load deals"
          message="We couldn't load the deals for this pipeline. Please check your connection and try again."
          onRetry={() => refetchDeals()}
          isRetrying={dealsFetching}
          compact
        />
      )}

      {/* Kanban Board */}
      <KanbanBoard
        stages={stages}
        deals={filteredDeals}
        pipelineId={selectedPipelineId}
        isLoading={isLoading && !stages.length}
        onDragEnd={handleDragEnd}
        onAddClick={handleAddClick}
        onDealClick={handleDealClick}
      />

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
    </div>
  )
}
