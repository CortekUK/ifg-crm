'use client'

import { useState, useEffect, useCallback } from 'react'
import { DropResult } from '@hello-pangea/dnd'
import { PipelinesPageHeader } from '@/components/pipelines/PipelinesPageHeader'
import { PipelineFilters } from '@/components/pipelines/PipelineFilters'
import { PipelineStats } from '@/components/pipelines/PipelineStats'
import { KanbanBoard } from '@/components/pipelines/KanbanBoard'
import { AddDealModal } from '@/components/pipelines/AddDealModal'
import { DealDetailSheet } from '@/components/pipelines/DealDetailSheet'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { usePipelineStages } from '@/lib/hooks/usePipelineStages'
import { useDeals, useMoveDeal } from '@/lib/hooks/useDeals'
import { toast } from '@/lib/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import type { PipelineStage, Deal } from '@/lib/types/pipelines'

export default function PipelinesPage() {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
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

  // Fetch stages for selected pipeline
  const { data: stages = [], isLoading: stagesLoading } = usePipelineStages(
    selectedPipelineId
  )

  // Fetch deals for selected pipeline
  const { data: deals = [], isLoading: dealsLoading } = useDeals(selectedPipelineId)

  // Mutation for moving deals
  const moveDeal = useMoveDeal()

  // Set default pipeline when data loads
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(pipelines[0].id)
    }
  }, [pipelines, selectedPipelineId])

  // Calculate deal counts per pipeline
  const dealCounts = pipelines.reduce<Record<string, number>>((acc, pipeline) => {
    // This would ideally come from a separate query, but for now we'll show 0
    acc[pipeline.id] = 0
    return acc
  }, {})

  // Filter deals by search
  const filteredDeals = search
    ? deals.filter((deal) => {
        const contactName = deal.contact
          ? `${deal.contact.first_name} ${deal.contact.last_name}`.toLowerCase()
          : deal.title.toLowerCase()
        return (
          contactName.includes(search.toLowerCase()) ||
          deal.title.toLowerCase().includes(search.toLowerCase())
        )
      })
    : deals

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
        onPipelineChange={setSelectedPipelineId}
        isLoading={pipelinesLoading}
        dealCounts={dealCounts}
      />

      {/* Filters */}
      <PipelineFilters search={search} onSearchChange={setSearch} />

      {/* Stats */}
      <PipelineStats deals={filteredDeals} lastUpdated={lastUpdated} />

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
