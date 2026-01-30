'use client'

import { useState, useEffect, useCallback } from 'react'
import { CampaignsPageHeader } from '@/components/campaigns/CampaignsPageHeader'
import { CampaignStats } from '@/components/campaigns/CampaignStats'
import { CampaignFilters } from '@/components/campaigns/CampaignFilters'
import { CampaignsTable } from '@/components/campaigns/CampaignsTable'
import { CreateCampaignModal } from '@/components/campaigns/CreateCampaignModal'
import { useCampaigns } from '@/lib/hooks/useCampaigns'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { createClient } from '@/lib/supabase/client'
import type { CampaignFilters as CampaignFiltersType } from '@/lib/types/campaigns'

export default function CampaignsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [filters, setFilters] = useState<CampaignFiltersType>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [createModalOpen, setCreateModalOpen] = useState(false)

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <CampaignsPageHeader onCreateClick={() => setCreateModalOpen(true)} />

      {/* Stats */}
      <CampaignStats campaigns={campaigns} />

      {/* Filters */}
      <CampaignFilters filters={filters} onFiltersChange={setFilters} />

      {/* Selection Summary */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
          <span className="text-sm font-medium text-blue-700">
            {selectedIds.size} campaign{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <CampaignsTable
        campaigns={campaigns}
        isLoading={isLoading}
        selectedIds={selectedIds}
        onSelectChange={handleSelectChange}
        onSelectAll={handleSelectAll}
      />

      {/* Create Campaign Modal */}
      {userId && (
        <CreateCampaignModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          userId={userId}
        />
      )}
    </div>
  )
}
