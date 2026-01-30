'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface AutomationsPageHeaderProps {
  onCreateClick: () => void
}

export function AutomationsPageHeader({ onCreateClick }: AutomationsPageHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-900 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-white/90 text-base">
          Automate follow-ups and email sequences for your recruitment pipeline.
        </p>

        <Button
          onClick={onCreateClick}
          className="bg-white text-blue-600 hover:bg-blue-50"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Automation
        </Button>
      </div>
    </div>
  )
}
