'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { ResetAutomationModal } from '@/components/pipelines/ResetAutomationModal'
import { StopAutomationModal } from '@/components/pipelines/StopAutomationModal'
import { SendAsConfirmModal } from '@/components/pipelines/SendAsConfirmModal'
import { usePipelines, usePipelineDealCounts } from '@/lib/hooks/usePipelines'
import { usePipelineStages } from '@/lib/hooks/usePipelineStages'
import { useDeals, useMoveDeal } from '@/lib/hooks/useDeals'
import { useResetEnrollments, type ResettableEnrollment } from '@/lib/hooks/useAutomationEnrollments'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { toast } from '@/lib/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import type { PipelineStage, Deal, Pipeline } from '@/lib/types/pipelines'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'

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

  // Reset automation modal state
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [pendingMove, setPendingMove] = useState<{
    dealId: string
    newStageId: string
    oldStageName?: string
    newStageName?: string
    enrollments: ResettableEnrollment[]
  } | null>(null)

  // Stop automation modal state
  const [stopModalOpen, setStopModalOpen] = useState(false)
  const [pendingStopMove, setPendingStopMove] = useState<{
    dealId: string
    newStageId: string
    oldStageName?: string
    newStageName?: string
    enrollments: { id: string; automation_id: string; automation_name: string }[]
  } | null>(null)

  // Send-as confirm modal state (first enrollment)
  const [sendAsModalOpen, setSendAsModalOpen] = useState(false)
  const [pendingSendAsMove, setPendingSendAsMove] = useState<{
    dealId: string
    newStageId: string
    oldStageName?: string
    newStageName?: string
  } | null>(null)

  // Fetch current user (with role)
  const { data: currentUser } = useCurrentUser()
  useEffect(() => {
    if (currentUser?.id) {
      setUserId(currentUser.id)
    }
  }, [currentUser?.id])

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'
  const isSuperAdmin = currentUser?.role === 'super_admin'

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

  // Mutation for resetting automation enrollments
  const resetEnrollments = useResetEnrollments()

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

  // Save zoom level to localStorage
  const handleZoomChange = useCallback((newZoom: number) => {
    const rounded = Math.round(newZoom * 10) / 10
    setZoom(rounded)
    localStorage.setItem(KANBAN_ZOOM_KEY, rounded.toString())
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

  // Patch send_as_user_id on newly created enrollment(s) for a deal
  const patchEnrollmentSendAs = useCallback(
    async (dealId: string, targetStageId: string, sendAsUserId: string) => {
      const supabase = createClient()

      // Find automations for the target stage
      const { data: automations } = await supabase
        .from('automations')
        .select('id')
        .eq('trigger_stage_id', targetStageId)
        .eq('pipeline_id', selectedPipelineId)
        .eq('is_active', true)

      if (!automations || automations.length === 0) return

      const automationIds = automations.map(a => a.id)

      // Retry up to 3 times with increasing delays (enrollment created by DB trigger)
      const delays = [200, 400, 600]
      for (let attempt = 0; attempt < delays.length; attempt++) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]))

        const { data: enrollments } = await supabase
          .from('automation_enrollments')
          .select('id')
          .eq('deal_id', dealId)
          .in('automation_id', automationIds)
          .eq('status', 'active')

        if (enrollments && enrollments.length > 0) {
          await supabase
            .from('automation_enrollments')
            .update({ send_as_user_id: sendAsUserId })
            .in('id', enrollments.map(e => e.id))
          return
        }
      }
      console.warn('Could not find enrollment to patch send_as_user_id')
    },
    [selectedPipelineId]
  )

  // Core stage change logic - checks for automations and shows modals if needed
  const handleStageChange = useCallback(
    async (dealId: string, newStageId: string, oldStage?: PipelineStage, newStage?: PipelineStage) => {
      if (!selectedPipelineId) return

      // Check for resettable enrollments
      const supabase = createClient()

      // Find automations that trigger on the target stage
      const { data: automations } = await supabase
        .from('automations')
        .select('id, name')
        .eq('trigger_stage_id', newStageId)
        .eq('pipeline_id', selectedPipelineId)
        .eq('is_active', true)

      if (automations && automations.length > 0) {
        const automationIds = automations.map(a => a.id)
        const automationMap = new Map(automations.map(a => [a.id, a.name]))

        // Check for ANY existing enrollments (active, stopped, or completed)
        const { data: enrollments } = await supabase
          .from('automation_enrollments')
          .select('id, automation_id, status, enrolled_at, current_step_id')
          .eq('deal_id', dealId)
          .in('automation_id', automationIds)

        if (enrollments && enrollments.length > 0) {
          // Show the reset modal for any existing enrollment
          const resettableEnrollments: ResettableEnrollment[] = enrollments.map(e => ({
            id: e.id,
            automation_id: e.automation_id,
            automation_name: automationMap.get(e.automation_id) || 'Unknown Automation',
            status: e.status as 'stopped' | 'completed',
            enrolled_at: e.enrolled_at,
          }))

          setPendingMove({
            dealId,
            newStageId,
            oldStageName: oldStage?.name,
            newStageName: newStage?.name,
            enrollments: resettableEnrollments,
          })
          setResetModalOpen(true)
          return
        }
      }

      // No existing enrollment but target stage has automations - show SendAs modal
      if (automations && automations.length > 0) {
        setPendingSendAsMove({
          dealId,
          newStageId,
          oldStageName: oldStage?.name,
          newStageName: newStage?.name,
        })
        setSendAsModalOpen(true)
        return
      }

      // No trigger stage automations to restart, but check if deal has active automations
      // that might need to be stopped (moving AWAY from where automation is running)
      const { data: activeEnrollments } = await supabase
        .from('automation_enrollments')
        .select(`
          id,
          automation_id,
          automations(name)
        `)
        .eq('deal_id', dealId)
        .eq('status', 'active')

      if (activeEnrollments && activeEnrollments.length > 0) {
        // Deal has active automations - ask if user wants to stop them
        const enrollmentsWithNames = activeEnrollments.map(e => ({
          id: e.id,
          automation_id: e.automation_id,
          automation_name: (e.automations as { name: string } | { name: string }[] | null)
            ? (Array.isArray(e.automations) ? e.automations[0]?.name : (e.automations as { name: string })?.name) || 'Unknown Automation'
            : 'Unknown Automation',
        }))

        setPendingStopMove({
          dealId,
          newStageId,
          oldStageName: oldStage?.name,
          newStageName: newStage?.name,
          enrollments: enrollmentsWithNames,
        })
        setStopModalOpen(true)
        return
      }

      // No automations to worry about, proceed with move
      executeMoveDeals(dealId, newStageId, oldStage?.name, newStage?.name)
    },
    [executeMoveDeals, selectedPipelineId, isSuperAdmin]
  )

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
        await handleStageChange(draggableId, destination.droppableId, oldStage, newStage)
      }
    },
    [handleStageChange, selectedPipelineId, stages, deals, canMoveDeal]
  )

  // Handle reset modal - restart automation
  const handleResetAndMove = useCallback(async (sendAsUserId?: string | null) => {
    if (!pendingMove) return

    const supabase = createClient()

    // First, stop all existing enrollments so the trigger can re-enroll
    await supabase
      .from('automation_enrollments')
      .update({
        status: 'stopped',
        stopped_reason: 'Reset for re-enrollment',
        next_step_at: null,
      })
      .in('id', pendingMove.enrollments.map(e => e.id))

    // Now move the deal - the trigger will re-enroll from step 1
    executeMoveDeals(
      pendingMove.dealId,
      pendingMove.newStageId,
      pendingMove.oldStageName,
      pendingMove.newStageName
    )

    // If user chose to send as themselves (not deal owner), patch the new enrollment
    if (sendAsUserId) {
      patchEnrollmentSendAs(pendingMove.dealId, pendingMove.newStageId, sendAsUserId)
    }

    toast({
      title: 'Automation restarted',
      description: 'The automation sequence will restart from the beginning',
    })

    setResetModalOpen(false)
    setPendingMove(null)
  }, [pendingMove, executeMoveDeals, patchEnrollmentSendAs])

  // Handle reset modal - move without restarting
  const handleMoveWithoutReset = useCallback((sendAsUserId?: string | null) => {
    if (!pendingMove) return

    // Mark enrollments as 'active' so they won't be re-enrolled by the trigger
    // This keeps the current progress
    const supabase = createClient()

    // If super admin chose to send as themselves, also patch send_as_user_id
    const updatePayload: Record<string, unknown> = { status: 'active' }
    if (sendAsUserId) {
      updatePayload.send_as_user_id = sendAsUserId
    }

    supabase
      .from('automation_enrollments')
      .update(updatePayload)
      .in('id', pendingMove.enrollments.map(e => e.id))
      .then(() => {
        executeMoveDeals(
          pendingMove.dealId,
          pendingMove.newStageId,
          pendingMove.oldStageName,
          pendingMove.newStageName
        )
      })

    setResetModalOpen(false)
    setPendingMove(null)
  }, [pendingMove, executeMoveDeals])

  // Handle stop modal - stop automations and move
  const handleStopAndMove = useCallback(async () => {
    if (!pendingStopMove) return

    const supabase = createClient()

    // Stop all active enrollments
    await supabase
      .from('automation_enrollments')
      .update({
        status: 'stopped',
        stopped_reason: 'Manually stopped when moving deal',
        next_step_at: null,
      })
      .in('id', pendingStopMove.enrollments.map(e => e.id))

    // Now move the deal
    executeMoveDeals(
      pendingStopMove.dealId,
      pendingStopMove.newStageId,
      pendingStopMove.oldStageName,
      pendingStopMove.newStageName
    )

    toast({
      title: 'Automation stopped',
      description: 'The automation sequence has been stopped',
    })

    setStopModalOpen(false)
    setPendingStopMove(null)
  }, [pendingStopMove, executeMoveDeals])

  // Handle stop modal - keep running and move
  const handleKeepRunningAndMove = useCallback((sendAsUserId?: string | null) => {
    if (!pendingStopMove) return

    // If super admin chose to send as themselves, update existing enrollment
    if (sendAsUserId) {
      const supabase = createClient()
      supabase
        .from('automation_enrollments')
        .update({ send_as_user_id: sendAsUserId })
        .in('id', pendingStopMove.enrollments.map(e => e.id))
    }

    // Move the deal, don't stop the automation
    executeMoveDeals(
      pendingStopMove.dealId,
      pendingStopMove.newStageId,
      pendingStopMove.oldStageName,
      pendingStopMove.newStageName
    )

    setStopModalOpen(false)
    setPendingStopMove(null)
  }, [pendingStopMove, executeMoveDeals])

  // Handle send-as confirm modal (super admin first enrollment)
  const handleSendAsConfirm = useCallback(async (sendAsUserId: string | null) => {
    if (!pendingSendAsMove) return

    executeMoveDeals(
      pendingSendAsMove.dealId,
      pendingSendAsMove.newStageId,
      pendingSendAsMove.oldStageName,
      pendingSendAsMove.newStageName
    )

    // If user chose to send as themselves (not deal owner), patch the new enrollment
    if (sendAsUserId) {
      patchEnrollmentSendAs(pendingSendAsMove.dealId, pendingSendAsMove.newStageId, sendAsUserId)
    }

    setSendAsModalOpen(false)
    setPendingSendAsMove(null)
  }, [pendingSendAsMove, executeMoveDeals, patchEnrollmentSendAs])

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
      />

      {/* Stats */}
      {!isFullscreen && <PipelineStats deals={filteredDeals} lastUpdated={lastUpdated} />}

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

      {/* Reset Automation Modal */}
      {pendingMove && (
        <ResetAutomationModal
          isOpen={resetModalOpen}
          onClose={() => {
            setResetModalOpen(false)
            setPendingMove(null)
          }}
          onConfirmReset={handleResetAndMove}
          onConfirmKeep={handleMoveWithoutReset}
          enrollments={pendingMove.enrollments}
          targetStageName={pendingMove.newStageName || 'new stage'}
          isResetting={resetEnrollments.isPending}
          isSuperAdmin={isSuperAdmin}
          currentUserId={currentUser?.id}
          currentUserName={currentUser?.full_name || undefined}
        />
      )}

      {/* Stop Automation Modal */}
      {pendingStopMove && (
        <StopAutomationModal
          isOpen={stopModalOpen}
          onClose={() => {
            setStopModalOpen(false)
            setPendingStopMove(null)
          }}
          onConfirmStop={handleStopAndMove}
          onConfirmKeepRunning={handleKeepRunningAndMove}
          enrollments={pendingStopMove.enrollments}
          targetStageName={pendingStopMove.newStageName || 'new stage'}
          isSuperAdmin={isSuperAdmin}
          currentUserId={currentUser?.id}
          currentUserName={currentUser?.full_name || undefined}
        />
      )}

      {/* Send As Confirm Modal (first enrollment) */}
      {pendingSendAsMove && currentUser && (
        <SendAsConfirmModal
          isOpen={sendAsModalOpen}
          onClose={() => {
            setSendAsModalOpen(false)
            setPendingSendAsMove(null)
          }}
          onConfirm={handleSendAsConfirm}
          currentUserId={currentUser.id}
          currentUserName={currentUser.full_name || 'Me'}
          targetStageName={pendingSendAsMove.newStageName || 'new stage'}
        />
      )}
    </div>
  )
}
