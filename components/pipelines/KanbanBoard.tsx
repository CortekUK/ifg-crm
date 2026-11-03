'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { DragDropContext, DropResult } from '@hello-pangea/dnd'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { KanbanColumn } from './KanbanColumn'
import { useColumnPreferences } from '@/lib/hooks/useColumnPreferences'
import { LayoutGrid, RefreshCw } from 'lucide-react'
import type { PipelineStage, Deal } from '@/lib/types/pipelines'
import { neighboursAt, positionBetween } from '@/lib/utils/deal-ordering'

interface KanbanBoardProps {
  stages: PipelineStage[]
  deals: Deal[]
  pipelineId: string | null
  isLoading: boolean
  zoom?: number
  onDragEnd: (result: DropResult, boardPosition?: number | null) => void
  onAddClick: (stage: PipelineStage) => void
  onDealClick?: (deal: Deal) => void
  canMoveDeal?: (deal: Deal) => boolean
  onOpenSettings?: () => void
  /** The deal just moved, so its destination column can reveal it. */
  revealDealId?: string | null
}

// Sideways scroll while a card is held near either edge of the board.
const EDGE_ZONE_PX = 160
const MAX_SPEED_PX_PER_SEC = 650
const RAMP_UP_MS = 500

/**
 * Scrolls the board while a card is dragged near its edges: gently at first and
 * faster the closer the pointer is, so a stage can be aimed at as it comes into
 * view.
 *
 * Follows the pointer, not the library's auto-scroller, which goes by the
 * middle of the card. A card grabbed by its left side has its middle past the
 * board by the time the pointer reaches the edge, and scrolling stopped there.
 * The library still sees every scroll here, because the board is the scroll
 * parent it watches during a drag (see handleBeforeCapture).
 */
function scrollBoardNearEdges(board: HTMLElement) {
  let pointerX = 0
  let running = false

  const run = () => {
    running = true
    let lastTime = performance.now()
    let enteredZoneAt: number | null = null
    let owed = 0

    const tick = (now: number) => {
      if (!board.dataset.cardDragging) {
        running = false
        return
      }
      const { left, right } = board.getBoundingClientRect()
      const fromLeft = pointerX - left
      const fromRight = right - pointerX
      const direction = fromRight < EDGE_ZONE_PX ? 1 : fromLeft < EDGE_ZONE_PX ? -1 : 0

      if (direction === 0) {
        enteredZoneAt = null
        owed = 0
      } else {
        enteredZoneAt ??= now
        const depth = 1 - Math.max(0, direction === 1 ? fromRight : fromLeft) / EDGE_ZONE_PX
        const ramp = Math.min(1, (now - enteredZoneAt) / RAMP_UP_MS)
        // Whole pixels only: scrollLeft can round a small step away entirely.
        owed += direction * depth * depth * ramp * MAX_SPEED_PX_PER_SEC * ((now - lastTime) / 1000)
        const step = Math.trunc(owed)
        board.scrollLeft += step
        owed -= step
      }
      lastTime = now
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  const follow = (x: number) => {
    if (!board.dataset.cardDragging) return
    pointerX = x
    if (!running) run()
  }
  const onMouseMove = (event: MouseEvent) => follow(event.clientX)
  const onTouchMove = (event: TouchEvent) => follow(event.touches[0]?.clientX ?? pointerX)

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('touchmove', onTouchMove, { passive: true })
  return () => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('touchmove', onTouchMove)
  }
}

// Off so the two do not scroll the board at once. See scrollBoardNearEdges.
const LIBRARY_AUTO_SCROLL = { disabled: true }

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

function EmptyState({ onOpenSettings }: { onOpenSettings?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-80 bg-muted/30 rounded-xl border-2 border-dashed border-muted">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <LayoutGrid className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">No stages configured</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        This pipeline doesn&apos;t have any stages yet. Configure stages to start tracking deals.
      </p>
      <Button variant="outline" className="mt-4" onClick={onOpenSettings} disabled={!onOpenSettings}>
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
  zoom = 1,
  onDragEnd,
  onAddClick,
  onDealClick,
  canMoveDeal,
  onOpenSettings,
  revealDealId = null,
}: KanbanBoardProps) {
  const {
    isLoaded: prefsLoaded,
    toggleColumnCollapsed,
    isColumnCollapsed,
    setColumnSort,
    getColumnSort,
  } = useColumnPreferences(pipelineId)

  // What each column currently has on screen, kept in a ref because it is only
  // ever read inside onDragEnd. Holding it as state would re-render every
  // column each time one of them filtered its own list.
  const visibleByStage = useRef<Record<string, Deal[]>>({})
  const registerVisibleDeals = useCallback((stageId: string, deals: Deal[]) => {
    visibleByStage.current[stageId] = deals
  }, [])

  /**
   * Makes the board the scroll parent for the length of a drag, so any stage
   * can be reached.
   *
   * @hello-pangea/dnd follows one scroll parent per droppable, the closest one
   * with overflow auto or scroll, and measures it when the drag starts. Columns
   * scroll their own cards, which would make each column that parent and leave
   * the board's sideways scroll untracked: its measurements went stale and cards
   * dropped in the wrong stage. So the columns stop being scrollers during a
   * drag (see the column body in KanbanColumn) and the board takes over.
   *
   * This has to happen in onBeforeCapture, the last moment before it measures.
   * Written to the element rather than state, because a re-render would land
   * after the measuring. The cost is that a column cannot scroll its own cards
   * during a drag.
   */
  const handleBeforeCapture = useCallback(() => {
    if (scrollerRef.current) scrollerRef.current.dataset.cardDragging = 'true'
  }, [])

  /**
   * Turn "dropped at index 3 of the Follow Up column" into a board_position.
   *
   * rbd reports an index into the list the user is looking at, which is not
   * the stage's full contents once a search, a date filter or the page size
   * has narrowed it — hence reading the column's own visible list rather than
   * dealsByStage.
   */
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      // The columns scroll their own cards again the moment this one lands.
      delete scrollerRef.current?.dataset.cardDragging
      const { destination, draggableId } = result
      if (!destination) {
        onDragEnd(result)
        return
      }
      const visible = visibleByStage.current[destination.droppableId] ?? []
      const { before, after } = neighboursAt(visible, destination.index, draggableId)
      onDragEnd(result, positionBetween(before, after))
    },
    [onDragEnd],
  )

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const stageIdSet = new Set(stages.map(s => s.id))
    const grouped = stages.reduce<Record<string, Deal[]>>((acc, stage) => {
      acc[stage.id] = deals.filter((deal) => deal.current_stage_id === stage.id)
      return acc
    }, {})

    // Put unmatched deals in the first stage column so they're visible
    if (stages.length > 0) {
      const unmatchedDeals = deals.filter(d => !stageIdSet.has(d.current_stage_id))
      if (unmatchedDeals.length > 0) {
        const firstStageId = stages[0].id
        grouped[firstStageId] = [...(grouped[firstStageId] || []), ...unmatchedDeals]
      }
    }

    return grouped
  }, [stages, deals])

  const scrollerRef = useRef<HTMLDivElement>(null)

  // Fill whatever is left of the viewport below wherever the board starts.
  //
  // Measured, not calc()'d: a calc() against a guessed header height goes
  // wrong the moment anything above the board changes.
  //
  // And re-measured on LAYOUT changes, not just window resizes. Measuring
  // once on mount was wrong — the stats row and the filter bar above the
  // board load their data afterwards and push it down, so the height stayed
  // as if the board still started near the top of the page, the board ran
  // off the bottom of the screen, and the document kept scrolling. Which is
  // the whole thing this was meant to stop.
  //
  // Writes the style directly rather than through state: this fires on every
  // layout change and a re-render per frame would be wasted work.
  //
  // Keyed on boardVisible because the loading skeleton has no scroller. Running
  // only on mount found nothing to measure, so the board never got a height.
  const boardVisible = !isLoading && prefsLoaded && stages.length > 0

  useEffect(() => {
    const el = scrollerRef.current
    return el ? scrollBoardNearEdges(el) : undefined
  }, [boardVisible])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const apply = () => {
      const top = el.getBoundingClientRect().top
      el.style.height = `${Math.max(320, window.innerHeight - top - 16)}px`
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(document.body)
    window.addEventListener('resize', apply)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', apply)
    }
  }, [boardVisible])

  if (isLoading || !prefsLoaded) {
    return <LoadingSkeleton />
  }

  if (stages.length === 0) {
    return <EmptyState onOpenSettings={onOpenSettings} />
  }

  // Bumped from 320 → 360 — at 320 the deal cards' name + intent badge +
  // owner avatar + time-in-stage row all squeezed against each other
  // (especially at the user's default 90% zoom = 288px). 360 gives the
  // contact name and the bottom metadata row enough room without making
  // the board feel sparse.
  const columnWidth = Math.round(360 * zoom)
  const gap = Math.round(16 * zoom)
  const compact = zoom < 0.8

  return (
    <DragDropContext
      onBeforeCapture={handleBeforeCapture}
      onDragEnd={handleDragEnd}
      autoScrollerOptions={LIBRARY_AUTO_SCROLL}
    >
      {/* The board scrolls, not the page.
          UNIVERSITY 2027 holds 365 deals in Dormant alone, so the tallest
          column used to stretch the document and the stage headers scrolled
          away with it — you lost sight of which column you were in.
          During a drag this is the only scroll container in the tree, which
          is what @hello-pangea/dnd requires (see handleBeforeCapture).
          Height is measured rather than hard-coded: a calc() against a guessed
          header height goes wrong the moment anything above it changes. */}
      <div ref={scrollerRef} className="w-full overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex h-full" style={{ gap }}>
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
              canMoveDeal={canMoveDeal}
              columnWidth={columnWidth}
              compact={compact}
              revealDealId={revealDealId}
              onVisibleDealsChange={registerVisibleDeals}
            />
          ))}
        </div>
      </div>
    </DragDropContext>
  )
}
