'use client'

import { Button } from '@/components/ui/button'
import { Plus, CalendarClock } from 'lucide-react'

interface InvoicesPageHeaderProps {
  onCreateClick: () => void
  onCreatePaymentPlan?: () => void
}

export function InvoicesPageHeader({ onCreateClick, onCreatePaymentPlan }: InvoicesPageHeaderProps) {
  return (
    <div className="banner-gradient rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-white/90 text-base">
          Manage invoices and track payments from players.
        </p>

        <div className="flex items-center gap-2">
          <Button
            onClick={onCreatePaymentPlan}
            variant="outline"
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            <CalendarClock className="h-4 w-4 mr-2" />
            Payment Plan
          </Button>
          <Button
            onClick={onCreateClick}
            className="bg-white text-blue-600 hover:bg-blue-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>
    </div>
  )
}
