'use client'

import { DragDropContext, DropResult } from '@hello-pangea/dnd'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { KanbanColumn } from './KanbanColumn'
import type { PipelineStage, Deal } from '@/lib/types/pipelines'

interface KanbanBoardProps {
  stages: PipelineStage[]
  deals: Deal[]
  isLoading: boolean
  onDragEnd: (result: DropResult) => void
  onAddClick: (stage: PipelineStage) => void
  onDealClick?: (deal: Deal) => void
}

export function KanbanBoard({
  stages,
  deals,
  isLoading,
  onDragEnd,
  onAddClick,
  onDealClick,
}: KanbanBoardProps) {
  // Group deals by stage
  const dealsByStage = stages.reduce<Record<string, Deal[]>>((acc, stage) => {
    acc[stage.id] = deals.filter((deal) => deal.current_stage_id === stage.id)
    return acc
  }, {})

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-72 flex-shrink-0 bg-gray-100 rounded-lg p-3"
          >
            <Skeleton className="h-6 w-24 mb-2" />
            <Skeleton className="h-4 w-16 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-muted-foreground">
          No stages found for this pipeline.
        </p>
      </div>
    )
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4 pb-4">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage[stage.id] || []}
              onAddClick={onAddClick}
              onDealClick={onDealClick}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </DragDropContext>
  )
}
