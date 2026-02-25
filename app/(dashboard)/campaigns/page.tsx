'use client'

import { useState, useEffect, useCallback } from 'react'
import { CampaignsPageHeader } from '@/components/campaigns/CampaignsPageHeader'
import { CampaignStats } from '@/components/campaigns/CampaignStats'
import { CampaignFilters } from '@/components/campaigns/CampaignFilters'
import { CampaignsTable } from '@/components/campaigns/CampaignsTable'
import { CreateCampaignModal } from '@/components/campaigns/CreateCampaignModal'
import { CampaignDetailSheet } from '@/components/campaigns/CampaignDetailSheet'
import { useCampaigns, useBatchDeleteCampaigns } from '@/lib/hooks/useCampaigns'
import { useCampaignRealtime } from '@/lib/hooks/useCampaignRealtime'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
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
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'
import type { CampaignFilters as CampaignFiltersType } from '@/lib/types/campaigns'
import type { Campaign } from '@/lib/types/campaigns'

export default function CampaignsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [filters, setFilters] = useState<CampaignFiltersType>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null)
  const [viewCampaignId, setViewCampaignId] = useState<string | null>(null)
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false)

  const batchDeleteCampaigns = useBatchDeleteCampaigns()

  // Live updates: subscribe to campaign changes from webhooks
  useCampaignRealtime()

  // Debounce search
  const debouncedFilters = {
    ...filters,
    search: useDebouncedValue(filters.search || '', 300),
  }

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

  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useCampaigns(debouncedFilters)

  // Handle selection
  const handleSelectChange = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(campaigns.map((c) => c.id)))
      } else {
        setSelectedIds(new Set())
      }
    },
    [campaigns]
  )

  const handleViewCampaign = useCallback((campaign: Campaign) => {
    setViewCampaignId(campaign.id)
  }, [])

  const handleEditCampaign = useCallback((campaign: Campaign) => {
    setEditCampaign(campaign)
    setCreateModalOpen(true)
  }, [])

  const handleCloseCreateModal = useCallback(() => {
    setCreateModalOpen(false)
    setEditCampaign(null)
  }, [])

  const handleEditFromDetail = useCallback((campaign: Campaign) => {
    setViewCampaignId(null)
    setEditCampaign(campaign)
    setCreateModalOpen(true)
  }, [])

  const handleBatchDelete = useCallback(async () => {
    try {
      await batchDeleteCampaigns.mutateAsync(Array.from(selectedIds))
      toast({
        title: 'Campaigns deleted',
        description: `${selectedIds.size} campaign${selectedIds.size !== 1 ? 's' : ''} deleted successfully.`,
      })
      setSelectedIds(new Set())
      setShowBatchDeleteDialog(false)
    } catch (error) {
      toast({
        title: 'Failed to delete campaigns',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }, [selectedIds, batchDeleteCampaigns])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <CampaignsPageHeader onCreateClick={() => setCreateModalOpen(true)} />

      {/* Stats */}
      <CampaignStats campaigns={campaigns} isLoading={isLoading} />

      {/* Filters */}
      <CampaignFilters filters={filters} onFiltersChange={setFilters} />

      {/* Selection Summary */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {selectedIds.size} campaign{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline"
            >
              Clear selection
            </button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowBatchDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}

      {/* Table */}
      <CampaignsTable
        campaigns={campaigns}
        isLoading={isLoading}
        selectedIds={selectedIds}
        onSelectChange={handleSelectChange}
        onSelectAll={handleSelectAll}
        onViewCampaign={handleViewCampaign}
        onEditCampaign={handleEditCampaign}
      />

      {/* Create/Edit Campaign Modal */}
      {userId && (
        <CreateCampaignModal
          isOpen={createModalOpen}
          onClose={handleCloseCreateModal}
          userId={userId}
          editCampaign={editCampaign}
        />
      )}

      {/* Campaign Detail Sheet */}
      <CampaignDetailSheet
        campaignId={viewCampaignId}
        isOpen={!!viewCampaignId}
        onClose={() => setViewCampaignId(null)}
        onEdit={handleEditFromDetail}
      />

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Campaign{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} campaign{selectedIds.size !== 1 ? 's' : ''}?
              This action cannot be undone. All campaign data and recipient records will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={batchDeleteCampaigns.isPending}
            >
              {batchDeleteCampaigns.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Campaigns'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
