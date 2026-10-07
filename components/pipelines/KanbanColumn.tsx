'use client'

import { useEffect, useMemo, useState } from 'react'
import { Droppable } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, ChevronRight, PoundSterling, Users, Search, X } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { matchesDealSearch } from '@/lib/utils/deal-search'
import { DealCard } from './DealCard'
import { ColumnControls } from './ColumnControls'
import { DATE_RANGES, withinDateRange, type DateRange } from './dealDateFilter'
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
  // The deal the user has just moved. If it landed past the visible window of
  // its new column, the window grows to include it — otherwise the card
  // appears to vanish on drop, which reads as a failed drag.
  revealDealId?: string | null
  /**
   * Reports what this column currently has on screen, so the board can work
   * out where a dropped card belongs. It has to be the VISIBLE list — the
   * column's own search, date filter and page size all narrow it, and the drop
   * index rbd reports is an index into what the user can see.
   */
  onVisibleDealsChange?: (stageId: string, deals: Deal[]) => void
}

/**
 * How many cards a column renders before asking.
 *
 * The board used to render every card in a stage. University "Dormant" holds
 * 328 and the scrolling simply never ended; the browser also laid out 328
 * draggables per column for a list nobody reads past the top of. Showing a
 * screenful and offering the rest is the whole fix for that.
 */
const PAGE_SIZE = 25

function sortDeals(deals: Deal[], sortBy: SortOption): Deal[] {
  const sorted = [...deals]

  switch (sortBy) {
    case 'manual':
      // Dragged order. Positions are always set (migration 196 backfilled
      // every deal and a trigger stamps new ones), but a deal that somehow
      // arrives without one sorts to the bottom rather than to the top, where
      // it would look like the newest lead.
      return sorted.sort((a, b) => {
        const posA = a.board_position ?? Number.POSITIVE_INFINITY
        const posB = b.board_position ?? Number.POSITIVE_INFINITY
        if (posA !== posB) return posA - posB
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
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
  revealDealId = null,
  onVisibleDealsChange,
}: KanbanColumnProps) {
  const totalValue = deals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0)

  // Per-stage search and date range. Deliberately not persisted: these are
  // "find me this player now" controls, and a filter still applied tomorrow
  // would hide cards the recruiter has forgotten they filtered out.
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const matchedDeals = useMemo(() => {
    const filtered = deals.filter(
      (deal) => withinDateRange(deal, dateRange) && matchesDealSearch(deal, search),
    )
    return sortDeals(filtered, sortBy)
  }, [deals, dateRange, search, sortBy])

  // Narrowing the list starts it from the top again — a search matching three
  // cards should not keep a window sized for the last one. Adjusted during
  // render rather than in an effect: this is derived state, and an effect
  // would paint the stale window once before correcting it.
  const narrowKey = `${stage.id}|${sortBy}|${dateRange}|${search}`
  const [lastNarrowKey, setLastNarrowKey] = useState(narrowKey)
  if (narrowKey !== lastNarrowKey) {
    setLastNarrowKey(narrowKey)
    setVisibleCount(PAGE_SIZE)
  }

  // A dropped card keeps the created_at it has always had, so it can land
  // anywhere in the order — including past the visible window. Widening the
  // window for it is a pure derivation, so no state and no effect: the card is
  // shown on the render that follows the drop.
  const revealIndex = useMemo(
    () => (revealDealId ? matchedDeals.findIndex((deal) => deal.id === revealDealId) : -1),
    [matchedDeals, revealDealId],
  )
  const effectiveCount = revealIndex >= 0 ? Math.max(visibleCount, revealIndex + 1) : visibleCount

  const visibleDeals = matchedDeals.slice(0, effectiveCount)
  const hiddenCount = matchedDeals.length - visibleDeals.length
  const isNarrowed = search.trim() !== '' || dateRange !== 'all'

  // Hand the visible list up. An effect writing into the board's ref rather
  // than its state: the board only reads this inside onDragEnd, so turning it
  // into state would re-render every column on every keystroke for nothing.
  useEffect(() => {
    onVisibleDealsChange?.(stage.id, visibleDeals)
  }, [onVisibleDealsChange, stage.id, visibleDeals])

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
      // No overflow-hidden here. @hello-pangea/dnd drags a card in place rather
      // than through a portal, so a clipping ancestor cuts the card off the
      // moment it leaves this column — which looks exactly like the drag has
      // stopped working, and is worst for the far-apart columns you have to
      // drag the longest to reach.
      className="flex flex-col flex-shrink-0 rounded-xl border border-border/50 bg-card shadow-sm"
      style={{ width: columnWidth }}
    >
      {/* Column Header */}
      <div
        className={cn(
          'sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 rounded-t-xl',
          compact ? 'px-2 py-2' : 'px-3 py-3',
        )}
        style={{ borderLeftColor: stage.color, borderLeftWidth: 3 }}
      >
        <div className="flex items-center gap-1.5">
          <h3 className={cn('font-semibold flex-1 truncate', compact ? 'text-xs' : 'text-sm')}>
            {stage.name}
          </h3>

          <Badge
            variant="secondary"
            className={cn(
              'font-medium tabular-nums',
              compact ? 'text-[10px] px-1 py-0' : 'text-xs',
              deals.length > 10 && 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
              deals.length > 20 && 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
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
            />
          )}
        </div>

        {!compact && (
          <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
            <PoundSterling className="h-3 w-3" />
            <span className="text-xs font-medium">{formatCurrency(totalValue)}</span>
          </div>
        )}

        {/* Per-stage search. The board-wide box above narrows every column at
            once; this one answers "is this player sitting in Dormant?" without
            disturbing the rest of the board. */}
        <div className={cn('flex items-center gap-1.5', compact ? 'mt-1.5' : 'mt-2')}>
          <div className="relative flex-1 min-w-0">
            <Search
              className={cn(
                'absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none',
                compact ? 'h-3 w-3' : 'h-3.5 w-3.5',
              )}
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or email…"
              aria-label={`Search ${stage.name}`}
              className={cn(
                'pr-7',
                compact ? 'h-6 pl-6 text-[10px]' : 'h-7 pl-7 text-xs',
              )}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
              >
                <X className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
              </button>
            )}
          </div>

          <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
            <SelectTrigger
              aria-label={`Filter ${stage.name} by date added`}
              // Height has to be set through the same data-variant the
              // component uses. SelectTrigger ships `data-[size=default]:h-9`,
              // and tailwind-merge does not treat a plain `h-7` as a conflict
              // with a modified class, so both survived and the
              // higher-specificity h-9 won — leaving the select 36px tall next
              // to a 28px input.
              className={cn(
                'w-auto shrink-0 gap-1 py-0',
                compact
                  ? 'data-[size=default]:h-6 px-1.5 text-[10px]'
                  : 'data-[size=default]:h-7 px-2 text-xs',
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {DATE_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value} className="text-xs">
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isNarrowed && (
          <p className={cn('mt-1.5 text-muted-foreground', compact ? 'text-[9px]' : 'text-[11px]')}>
            {formatNumber(matchedDeals.length)} of {formatNumber(deals.length)} match
          </p>
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
          /* Deliberately NOT a scroll container, and not Radix ScrollArea.
             @hello-pangea/dnd tracks exactly one scroll parent per droppable
             — the closest one — so an `overflow-y-auto` here claimed that
             slot and left the board's horizontal scroller untracked. The
             library logged "unsupported nested scroll container detected"
             once per column, and once the board scrolled sideways mid-drag
             every column's cached position was stale: the highlight stopped
             following the cursor and the card dropped into whichever stage
             rbd had last measured. It never even earned the scrollbar —
             columns stretch to the tallest one in the flex row, so this body
             had nothing to scroll (scrollWidth === clientWidth).
             Plain flex-1 keeps the definite-height parent that `min-h-full`
             on the drop target needs, and hands the scroll-parent slot to
             the board, which is the one that actually scrolls. */
          <div className={cn('flex-1 min-h-[120px] pb-2', compact ? 'px-1' : 'px-2')}>
            {/* min-h-full, not a fixed strip.
                Columns sit in a flex row, so every one of them stretches to the
                height of the tallest. The drop target used to be min-h-[120px],
                which in a short or empty column left hundreds of pixels that
                looked droppable and were not — dropping into Arrival, Lost or
                any stage with few cards did nothing unless you aimed at the top
                inch. Filling the column makes the whole body a target. */}
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                'min-h-full pt-2 rounded-lg',
                'transition-[background-color,box-shadow] duration-300 ease-out',
                snapshot.isDraggingOver && 'bg-primary/5 ring-2 ring-dashed ring-primary/30',
              )}
            >
              {matchedDeals.length === 0 ? (
                <div
                  className={cn(
                    'flex flex-col items-center justify-center text-center',
                    compact ? 'py-4 px-2' : 'py-8 px-4',
                  )}
                >
                  {!compact && (
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                      <Users className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}
                  <p className={cn('text-muted-foreground', compact ? 'text-[10px]' : 'text-sm mb-1')}>
                    {isNarrowed ? 'No matches' : 'No deals yet'}
                  </p>
                  {!compact && (
                    <p className="text-xs text-muted-foreground/70">
                      {isNarrowed ? 'Try a different name, email or date' : 'Drag a deal here or click Add'}
                    </p>
                  )}
                </div>
              ) : (
                visibleDeals.map(renderCard)
              )}
              {provided.placeholder}
            </div>

            {hiddenCount > 0 && (
              <div className={cn('pt-1', compact ? 'pb-1' : 'pb-2')}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('w-full text-muted-foreground', compact ? 'h-6 text-[10px]' : 'h-7 text-xs')}
                  onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                >
                  Show {formatNumber(Math.min(PAGE_SIZE, hiddenCount))} more
                  <span className="ml-1 opacity-70">({formatNumber(hiddenCount)} hidden)</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  )
}
