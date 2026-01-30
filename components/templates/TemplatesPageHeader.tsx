'use client'

import { Button } from '@/components/ui/button'
import { Upload, Plus } from 'lucide-react'

interface TemplatesPageHeaderProps {
  onImportClick: () => void
  onCreateClick: () => void
}

export function TemplatesPageHeader({
  onImportClick,
  onCreateClick,
}: TemplatesPageHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-900 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-white/90 text-base">
          Create and manage reusable email and SMS templates.
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onImportClick}
            className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import HTML
          </Button>
          <Button
            onClick={onCreateClick}
            className="bg-white text-blue-600 hover:bg-blue-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>
    </div>
  )
}
