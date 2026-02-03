'use client'

import { DragDropContext, DropResult } from '@hello-pangea/dnd'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { KanbanColumn } from './KanbanColumn'
import { useColumnPreferences } from '@/lib/hooks/useColumnPreferences'
import { LayoutGrid, RefreshCw } from 'lucide-react'
import type { PipelineStage, Deal } from '@/lib/types/pipelines'

interface KanbanBoardProps {
  stages: PipelineStage[]
  deals: Deal[]
  pipelineId: string | null
  isLoading: boolean
  onDragEnd: (result: DropResult) => void
  onAddClick: (stage: PipelineStage) => void
  onDealClick?: (deal: Deal) => void
}

function LoadingSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-80 flex-shrink-0 rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* Header Skeleton */}
          <div className="p-3 border-b border-l-[3px] border-l-muted">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-10 ml-auto rounded-full" />
            </div>
            <Skeleton className="h-4 w-16 mt-2" />
          </div>
          
          {/* Add Button Skeleton */}
          <div className="px-2 pt-2">
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
          
          {/* Cards Skeleton */}
          <div className="p-2 space-y-2">
            {Array.from({ length: 3 - (i % 2) }).map((_, j) => (
              <div
                key={j}
                className="bg-card rounded-lg border p-3"
                style={{ animationDelay: `${(i * 3 + j) * 50}ms` }}
              >
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 pt-2 border-t">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-8" />
                  <div className="flex-1" />
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-80 bg-muted/30 rounded-xl border-2 border-dashed border-muted">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <LayoutGrid className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">No stages configured</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        This pipeline doesn&apos;t have any stages yet. Configure stages to start tracking deals.
      </p>
      <Button variant="outline" className="mt-4" disabled>
        <RefreshCw className="h-4 w-4 mr-2" />
        Configure Stages
      </Button>
    </div>
  )
}

export function KanbanBoard({
  stages,
  deals,
  pipelineId,
  isLoading,
  onDragEnd,
  onAddClick,
  onDealClick,
}: KanbanBoardProps) {
  const {
    isLoaded: prefsLoaded,
    toggleColumnCollapsed,
    isColumnCollapsed,
    setColumnSort,
    getColumnSort,
  } = useColumnPreferences(pipelineId)

  // Group deals by stage
  const stageIdSet = new Set(stages.map(s => s.id))
  const dealsByStage = stages.reduce<Record<string, Deal[]>>((acc, stage) => {
    acc[stage.id] = deals.filter((deal) => deal.current_stage_id === stage.id)
    return acc
  }, {})
  
  // Put unmatched deals in the first stage column so they're visible
  if (stages.length > 0) {
    const unmatchedDeals = deals.filter(d => !stageIdSet.has(d.current_stage_id))
    if (unmatchedDeals.length > 0) {
      const firstStageId = stages[0].id
      dealsByStage[firstStageId] = [...(dealsByStage[firstStageId] || []), ...unmatchedDeals]
    }
  }

  if (isLoading || !prefsLoaded) {
    return <LoadingSkeleton />
  }

  if (stages.length === 0) {
    return <EmptyState />
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
              isCollapsed={isColumnCollapsed(stage.id)}
              sortBy={getColumnSort(stage.id)}
              onToggleCollapse={() => toggleColumnCollapsed(stage.id)}
              onSortChange={(sort) => setColumnSort(stage.id, sort)}
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
