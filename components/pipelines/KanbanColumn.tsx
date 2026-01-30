'use client'

import { Droppable } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { DealCard } from './DealCard'
import type { PipelineStage, Deal } from '@/lib/types/pipelines'

interface KanbanColumnProps {
  stage: PipelineStage
  deals: Deal[]
  onAddClick: (stage: PipelineStage) => void
  onDealClick?: (deal: Deal) => void
}

export function KanbanColumn({ stage, deals, onAddClick, onDealClick }: KanbanColumnProps) {
  const totalValue = deals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0)

  return (
    <div className="flex flex-col w-72 flex-shrink-0 bg-gray-100 rounded-lg">
      {/* Column Header */}
      <div className="p-3 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-semibold text-sm">{stage.name}</h3>
          <span className="ml-auto text-xs text-muted-foreground bg-white px-2 py-0.5 rounded-full">
            {formatNumber(deals.length)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(totalValue)}
        </p>
      </div>

      {/* Add Button */}
      <div className="px-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => onAddClick(stage)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Cards Container */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <ScrollArea className="flex-1 px-2 pb-2">
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`
                min-h-[200px] pt-2 transition-colors rounded
                ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}
              `}
            >
              {deals.map((deal, index) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  index={index}
                  onClick={onDealClick ? () => onDealClick(deal) : undefined}
                />
              ))}
              {provided.placeholder}
            </div>
          </ScrollArea>
        )}
      </Droppable>
    </div>
  )
}
