'use client'

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface PaymentsPageHeaderProps {
  onExport?: () => void
}

export function PaymentsPageHeader({ onExport }: PaymentsPageHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-900 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-white/90 text-base">
          Track and manage all payment transactions.
        </p>

        <Button
          onClick={onExport}
          className="bg-white text-blue-600 hover:bg-blue-50"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </div>
  )
}
