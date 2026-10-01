'use client'

import { useMemo, useState } from 'react'
import { Droppable } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, ChevronRight, ChevronDown, PoundSterling, Users } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { DealCard } from './DealCard'
import { ColumnControls } from './ColumnControls'
import { groupDealsByDate, groupingDateFor, type DealDateGroup } from './dealDateGroups'
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
  canMoveDeal?: (deal: Deal) => boolean
  columnWidth?: number
  compact?: boolean
  // True while a search or filter is narrowing the board. Every date
  // group opens so a match is never hidden inside a collapsed section.
  isFiltering?: boolean
}

// Recent groups open by default; older history starts folded so a stage
// with hundreds of leads opens as a short list of dated headers.
function isOpenByDefault(group: DealDateGroup, index: number): boolean {
  return index === 0 || group.key === 'today' || group.key === 'yesterday'
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
  canMoveDeal,
  columnWidth = 320,
  compact = false,
  isFiltering = false,
}: KanbanColumnProps) {
  const totalValue = deals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0)

  const sortedDeals = useMemo(() => sortDeals(deals, sortBy), [deals, sortBy])

  // null = the sort isn't date-based, render a flat list as before.
  const groups = useMemo(() => {
    const getDate = groupingDateFor(sortBy)
    return getDate ? groupDealsByDate(sortedDeals, getDate) : null
  }, [sortedDeals, sortBy])

  // Only groups the user has explicitly toggled are stored; everything
  // else falls back to isOpenByDefault.
  const [groupOverrides, setGroupOverrides] = useState<Record<string, boolean>>({})

  const isGroupOpen = (group: DealDateGroup, index: number) =>
    isFiltering || (groupOverrides[group.key] ?? isOpenByDefault(group, index))

  const toggleGroup = (group: DealDateGroup, index: number) =>
    setGroupOverrides((prev) => ({ ...prev, [group.key]: !isGroupOpen(group, index) }))

  const setAllGroups = (open: boolean) =>
    setGroupOverrides(Object.fromEntries((groups ?? []).map((g) => [g.key, open])))

  const renderCard = (deal: Deal, index: number) => (
    <DealCard
      key={deal.id}
      deal={deal}
      index={index}
      onClick={onDealClick ? () => onDealClick(deal) : undefined}
      isDragDisabled={canMoveDeal ? !canMoveDeal(deal) : false}
      compact={compact}
    />
  )

  // Draggable indices must be contiguous across the whole droppable, so
  // cards in collapsed groups are skipped rather than numbered.
  const renderGroups = (dateGroups: DealDateGroup[]) => {
    let index = 0
    return dateGroups.map((group, groupIndex) => {
      const open = isGroupOpen(group, groupIndex)
      return (
        <section key={group.key} className={cn(open ? 'mb-1' : 'mb-0.5')}>
          <button
            type="button"
            onClick={() => toggleGroup(group, groupIndex)}
            aria-expanded={open}
            disabled={isFiltering}
            className={cn(
              'sticky top-0 z-[5] flex w-full items-center gap-1.5 rounded-md bg-card text-left',
              'text-muted-foreground hover:text-foreground transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-default disabled:hover:text-muted-foreground',
              compact ? 'px-1 py-1' : 'px-1.5 py-1.5',
            )}
          >
            <ChevronDown
              className={cn(
                'shrink-0 transition-transform duration-200',
                compact ? 'h-3 w-3' : 'h-3.5 w-3.5',
                !open && '-rotate-90',
              )}
            />
            <span
              className={cn(
                'font-semibold uppercase tracking-wider',
                compact ? 'text-[9px]' : 'text-[11px]',
                group.key === 'today' && 'text-foreground',
              )}
            >
              {group.label}
            </span>
            <span className="h-px flex-1 bg-border" aria-hidden />
            <span
              className={cn(
                'tabular-nums rounded-full bg-muted px-1.5 font-medium',
                compact ? 'text-[9px]' : 'text-[11px]',
              )}
            >
              {formatNumber(group.deals.length)}
            </span>
          </button>
          {open && <div className="pt-1">{group.deals.map((deal) => renderCard(deal, index++))}</div>}
        </section>
      )
    })
  }

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
    <div
      className="flex flex-col flex-shrink-0 rounded-xl border border-border/50 bg-card shadow-sm"
      style={{ width: columnWidth }}
    >
      {/* Column Header */}
      <div
        className={cn(
          "sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 rounded-t-xl",
          compact ? "px-2 py-2" : "px-3 py-3"
        )}
        style={{ borderLeftColor: stage.color, borderLeftWidth: 3 }}
      >
        <div className="flex items-center gap-1.5">
          <h3 className={cn("font-semibold flex-1 truncate", compact ? "text-xs" : "text-sm")}>{stage.name}</h3>

          <Badge
            variant="secondary"
            className={cn(
              "font-medium tabular-nums",
              compact ? "text-[10px] px-1 py-0" : "text-xs",
              deals.length > 10 && "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
              deals.length > 20 && "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
            )}
          >
            {!compact && <Users className="h-3 w-3 mr-1" />}
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
              onSetAllGroups={groups && groups.length > 1 && !isFiltering ? setAllGroups : undefined}
            />
          )}
        </div>

        {!compact && (
          <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
            <PoundSterling className="h-3 w-3" />
            <span className="text-xs font-medium">{formatCurrency(totalValue)}</span>
          </div>
        )}
      </div>

      {/* Add Button */}
      {!compact && (
        <div className="px-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start border-dashed border-2 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 text-slate-600 dark:text-slate-400"
            onClick={() => onAddClick(stage)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Deal
          </Button>
        </div>
      )}

      {/* Cards Container */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <ScrollArea className={cn("flex-1 pb-2", compact ? "px-1" : "px-2")}>
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                'min-h-[120px] pt-2 rounded-lg',
                'transition-[background-color,box-shadow] duration-300 ease-out',
                snapshot.isDraggingOver && 'bg-primary/5 ring-2 ring-dashed ring-primary/30'
              )}
            >
              {sortedDeals.length === 0 ? (
                <div className={cn(
                  "flex flex-col items-center justify-center text-center",
                  compact ? "py-4 px-2" : "py-8 px-4"
                )}>
                  {!compact && (
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                      <Users className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}
                  <p className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-sm mb-1")}>No deals yet</p>
                  {!compact && (
                    <p className="text-xs text-muted-foreground/70">
                      Drag a deal here or click Add
                    </p>
                  )}
                </div>
              ) : groups ? (
                renderGroups(groups)
              ) : (
                sortedDeals.map(renderCard)
              )}
              {provided.placeholder}
            </div>
          </ScrollArea>
        )}
      </Droppable>
    </div>
  )
}
