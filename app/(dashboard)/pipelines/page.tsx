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
import { Button } from '@/components/ui/button'
import { GitBranch, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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
  // Backward stage moves get a confirmation popup — they auto-stop any
  // active automation enrollment and may re-trigger the stage's
  // automation again, which is a destructive enough operation to gate
  // on a click.
  const [pendingBackwardMove, setPendingBackwardMove] = useState<{
    dealId: string
    newStageId: string
    oldStage: PipelineStage
    newStage: PipelineStage
  } | null>(null)

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

  // Set default pipeline when data loads, OR when the currently-selected
  // pipeline disappears (e.g. just deleted). Without the second branch the
  // page hangs onto a stale UUID and shows an empty board until refresh.
  useEffect(() => {
    if (pipelines.length === 0) return
    const stillExists = selectedPipelineId && pipelines.some(p => p.id === selectedPipelineId)
    if (stillExists) return

    const stored = localStorage.getItem(PIPELINE_STORAGE_KEY)
    const next = stored && pipelines.some(p => p.id === stored)
      ? stored
      : pipelines[0].id
    setSelectedPipelineId(next)
    localStorage.setItem(PIPELINE_STORAGE_KEY, next)
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

      // List-view stage changes go through the same backward-confirmation
      // gate as drag-drop. The kanban path already gates earlier, so by
      // the time it calls handleStageChange the move is confirmed; only
      // the list view triggers the dialog here.
      const isBackward =
        oldStage &&
        newStage &&
        newStage.display_order < oldStage.display_order &&
        newStage.stage_type !== 'lost'
      if (isBackward) {
        setPendingBackwardMove({
          dealId,
          newStageId,
          oldStage,
          newStage,
        })
        return
      }

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

  // Confirm callback fired by the backward-move dialog. Bypasses the
  // backward check (we know it's intentional) and runs the same DB
  // updates handleStageChange would have done.
  const confirmBackwardMove = useCallback(async () => {
    if (!pendingBackwardMove || !selectedPipelineId) return
    const { dealId, newStageId, oldStage, newStage } = pendingBackwardMove
    setPendingBackwardMove(null)

    const supabase = createClient()
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
          stopped_reason: 'Auto-stopped on backward stage move',
          next_step_at: null,
        })
        .in('id', activeEnrollments.map((e) => e.id))
    }

    // If we're moving to a stage that sits BEFORE Contact Response in
    // this pipeline, wipe the deal's intent. Reasoning: the recruiter
    // is re-running the outreach, so the previous reply's intent is
    // stale context — the next reply needs to be classified fresh and
    // the card shouldn't keep showing a green/red badge from a stale
    // conversation. If there's no Contact Response stage configured we
    // skip the wipe (no anchor to compare against).
    const responseStage = stages.find((s) => s.name === 'Contact Response')
    if (responseStage && newStage.display_order < responseStage.display_order) {
      await supabase
        .from('deals')
        .update({ intent: null })
        .eq('id', dealId)
    }

    executeMoveDeals(dealId, newStageId, oldStage.name, newStage.name)
  }, [pendingBackwardMove, selectedPipelineId, executeMoveDeals, stages])

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

        // Backward move (lower display_order) → confirmation gate.
        // Skip the gate when the destination is "Lost" (stage_type='lost')
        // since dropping a deal into Lost is a deliberate finishing
        // action, not a regression.
        const isBackward =
          oldStage &&
          newStage &&
          newStage.display_order < oldStage.display_order &&
          newStage.stage_type !== 'lost'

        if (isBackward) {
          setPendingBackwardMove({
            dealId: draggableId,
            newStageId: destination.droppableId,
            oldStage,
            newStage,
          })
          return
        }

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

  // No pipelines exist (fresh install or all deleted) — show a focused empty
  // state instead of the full board, which would otherwise render as a
  // dropdown-with-no-options + an empty kanban grid.
  if (!pipelinesLoading && pipelines.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center text-center py-20 px-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="h-16 w-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
            <GitBranch className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="font-oswald text-2xl font-bold uppercase text-gray-900 dark:text-white mb-2">
            No pipelines yet
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Pipelines organise your deals into stages — Initial Lead, Engaged, Won, etc.
            Create one to start tracking contacts through your recruitment process.
          </p>
          {isAdmin ? (
            <Button
              onClick={() => setCreatePipelineModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create your first pipeline
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Ask an admin to create a pipeline before you can manage deals.
            </p>
          )}
        </div>

        <CreatePipelineModal
          isOpen={createPipelineModalOpen}
          onClose={() => setCreatePipelineModalOpen(false)}
        />
      </div>
    )
  }

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
          isAdmin={isAdmin}
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
        isAdmin={isAdmin}
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
          onOpenSettings={() => setSettingsModalOpen(true)}
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

      {/* Backward stage move confirmation. The deal will be moved
          backwards in the pipeline, any active automation enrollment
          will be stopped, and the destination stage's automation (if
          any) will re-trigger via the on_deal_stage_change DB trigger.
          That second part is the real reason we gate this — re-firing
          a sequence on a deal that already finished it is rarely
          intended, so make the user confirm. */}
      <AlertDialog
        open={!!pendingBackwardMove}
        onOpenChange={(open) => {
          if (!open) setPendingBackwardMove(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move deal backwards?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingBackwardMove ? (
                <>
                  This will move the deal from{' '}
                  <strong>{pendingBackwardMove.oldStage.name}</strong> back to{' '}
                  <strong>{pendingBackwardMove.newStage.name}</strong>.
                  <br />
                  <br />
                  Any active automation on this deal will be stopped, and any
                  automation attached to{' '}
                  <strong>{pendingBackwardMove.newStage.name}</strong> will
                  re-trigger from the start.
                  {(() => {
                    const responseStage = stages.find((s) => s.name === 'Contact Response')
                    if (
                      responseStage &&
                      pendingBackwardMove.newStage.display_order < responseStage.display_order
                    ) {
                      return (
                        <>
                          <br />
                          <br />
                          The deal's reply intent tag will be cleared so the
                          next reply is classified fresh.
                        </>
                      )
                    }
                    return null
                  })()}
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBackwardMove}>
              Move and re-trigger
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
