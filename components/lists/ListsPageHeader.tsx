'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface ListsPageHeaderProps {
  onCreateClick: () => void
}

export function ListsPageHeader({ onCreateClick }: ListsPageHeaderProps) {
  return (
    <div className="banner-gradient rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-white/90 text-base">
          Organise your contacts into targeted lists for campaigns and automations.
        </p>

        <Button
          onClick={onCreateClick}
          className="bg-white text-blue-600 hover:bg-blue-50"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create List
        </Button>
      </div>
    </div>
  )
}
