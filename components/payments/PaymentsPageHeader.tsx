'use client'

import { Button } from '@/components/ui/button'
import { Download, Plus } from 'lucide-react'

interface PaymentsPageHeaderProps {
  onExport?: () => void
  onRecordPayment?: () => void
}

export function PaymentsPageHeader({ onExport, onRecordPayment }: PaymentsPageHeaderProps) {
  return (
    <div className="banner-gradient rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-white/90 text-base">
          Track and manage all payment transactions.
        </p>

        <div className="flex items-center gap-2">
          <Button
            onClick={onExport}
            variant="outline"
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={onRecordPayment}
            className="bg-white text-blue-600 hover:bg-blue-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </div>
    </div>
  )
}
