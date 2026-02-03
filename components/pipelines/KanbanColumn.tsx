'use client'

import { useMemo } from 'react'
import { Droppable } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, ChevronRight, PoundSterling, Users } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { DealCard } from './DealCard'
import { ColumnControls } from './ColumnControls'
import type { PipelineStage, Deal } from '@/lib/types/pipelines'
import type { SortOption } from '@/lib/hooks/useColumnPreferences'

interface KanbanColumnProps {
  stage: PipelineStage
  deals: Deal[]
  isCollapsed?: boolean
  sortBy?: SortOption
  onToggleCollapse?: () => void
  onSortChange?: (sort: SortOption) => void
  onAddClick: (stage: PipelineStage) => void
  onDealClick?: (deal: Deal) => void
}

function sortDeals(deals: Deal[], sortBy: SortOption): Deal[] {
  const sorted = [...deals]
  
  switch (sortBy) {
    case 'value-desc':
      return sorted.sort((a, b) => (b.deal_value || 0) - (a.deal_value || 0))
    case 'value-asc':
      return sorted.sort((a, b) => (a.deal_value || 0) - (b.deal_value || 0))
    case 'date-desc':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    case 'date-asc':
      return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    case 'name-asc':
      return sorted.sort((a, b) => {
        const nameA = a.contact ? `${a.contact.first_name} ${a.contact.last_name}` : a.title
        const nameB = b.contact ? `${b.contact.first_name} ${b.contact.last_name}` : b.title
        return nameA.localeCompare(nameB)
      })
    case 'name-desc':
      return sorted.sort((a, b) => {
        const nameA = a.contact ? `${a.contact.first_name} ${a.contact.last_name}` : a.title
        const nameB = b.contact ? `${b.contact.first_name} ${b.contact.last_name}` : b.title
        return nameB.localeCompare(nameA)
      })
    case 'activity-desc':
      return sorted.sort((a, b) => {
        const dateA = a.last_activity_at || a.created_at
        const dateB = b.last_activity_at || b.created_at
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
    default:
      return sorted
  }
}

export function KanbanColumn({
  stage,
  deals,
  isCollapsed = false,
  sortBy = 'date-desc',
  onToggleCollapse,
  onSortChange,
  onAddClick,
  onDealClick,
}: KanbanColumnProps) {
  const totalValue = deals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0)
  
  const sortedDeals = useMemo(() => sortDeals(deals, sortBy), [deals, sortBy])

  // Collapsed state
  if (isCollapsed) {
    return (
      <div
        className="flex flex-col w-14 flex-shrink-0 rounded-xl border border-border/50 bg-card shadow-sm cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={onToggleCollapse}
      >
        <div className="flex flex-col items-center gap-3 py-4 px-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse?.()
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          
          <span
            className="text-xs font-medium text-muted-foreground whitespace-nowrap"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {stage.name}
          </span>
          
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
            {deals.length}
          </Badge>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-80 flex-shrink-0 rounded-xl border border-border/50 bg-card shadow-sm">
      {/* Column Header */}
      <div
        className="sticky top-0 z-10 px-3 py-3 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 rounded-t-xl"
        style={{ borderLeftColor: stage.color, borderLeftWidth: 3 }}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm flex-1 truncate">{stage.name}</h3>
          
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs font-medium tabular-nums",
              deals.length > 10 && "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
              deals.length > 20 && "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
            )}
          >
            <Users className="h-3 w-3 mr-1" />
            {formatNumber(deals.length)}
          </Badge>
          
          {onSortChange && onToggleCollapse && (
            <ColumnControls
              stage={stage}
              sortBy={sortBy}
              onSortChange={onSortChange}
              onCollapse={onToggleCollapse}
              onAddDeal={() => onAddClick(stage)}
              dealCount={deals.length}
            />
          )}
        </div>
        
        <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
          <PoundSterling className="h-3 w-3" />
          <span className="text-xs font-medium">{formatCurrency(totalValue)}</span>
        </div>
      </div>

      {/* Add Button */}
      <div className="px-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg"
          onClick={() => onAddClick(stage)}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add deal
        </Button>
      </div>

      {/* Cards Container */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <ScrollArea className="flex-1 px-2 pb-2">
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                'min-h-[200px] pt-2 transition-all duration-200 rounded-lg',
                snapshot.isDraggingOver && 'bg-primary/5 ring-2 ring-dashed ring-primary/30'
              )}
            >
              {sortedDeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <Users className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">No deals yet</p>
                  <p className="text-xs text-muted-foreground/70">
                    Drag a deal here or click Add
                  </p>
                </div>
              ) : (
                sortedDeals.map((deal, index) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    index={index}
                    onClick={onDealClick ? () => onDealClick(deal) : undefined}
                  />
                ))
              )}
              {provided.placeholder}
            </div>
          </ScrollArea>
        )}
      </Droppable>
    </div>
  )
}
