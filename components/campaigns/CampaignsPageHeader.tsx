'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface CampaignsPageHeaderProps {
  onCreateClick: () => void
}

export function CampaignsPageHeader({ onCreateClick }: CampaignsPageHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-900 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-white/90 text-base">
          Create and manage email and SMS campaigns for player outreach.
        </p>

        <Button
          onClick={onCreateClick}
          className="bg-white text-blue-600 hover:bg-blue-50"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>
    </div>
  )
}
