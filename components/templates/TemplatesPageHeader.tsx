'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface TemplatesPageHeaderProps {
  onCreateClick: () => void
}

export function TemplatesPageHeader({ onCreateClick }: TemplatesPageHeaderProps) {
  // The "Import HTML" button was removed — the workflow is the editor
  // (Build / AI), and the import path was unused. The page header now
  // carries just the page lede + the primary Create CTA.
  return (
    <div className="banner-gradient rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-white/90 text-base">
          Create and manage reusable email and SMS templates.
        </p>

        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            onClick={onCreateClick}
            className="bg-white text-blue-600 hover:bg-blue-50"
          >
            <Plus className="mr-1 h-4 w-4" />
            Create
          </Button>
        </div>
      </div>
    </div>
  )
}
