'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Search, X } from 'lucide-react'
import type { PaymentFilters as Filters } from '@/lib/types/payments'

interface PaymentFiltersProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
}

export function PaymentFilters({ filters, onFiltersChange }: PaymentFiltersProps) {
  const handleChange = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      paymentMethod: 'all',
      status: 'all',
      dateFrom: null,
      dateTo: null,
    })
  }

  const hasActiveFilters =
    filters.search ||
    filters.paymentMethod !== 'all' ||
    filters.status !== 'all' ||
    filters.dateFrom ||
    filters.dateTo

  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by contact or reference..."
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Payment Method */}
        <Select
          value={filters.paymentMethod}
          onValueChange={(v) => handleChange('paymentMethod', v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Payment Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="stripe">Stripe</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={filters.status}
          onValueChange={(v) => handleChange('status', v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="successful">Successful</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range - simplified for now */}
        <Input
          type="date"
          className="w-[140px]"
          value={filters.dateFrom?.toISOString().split('T')[0] || ''}
          onChange={(e) =>
            handleChange('dateFrom', e.target.value ? new Date(e.target.value) : null)
          }
          placeholder="From"
        />
        <Input
          type="date"
          className="w-[140px]"
          value={filters.dateTo?.toISOString().split('T')[0] || ''}
          onChange={(e) =>
            handleChange('dateTo', e.target.value ? new Date(e.target.value) : null)
          }
          placeholder="To"
        />

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </Card>
  )
}
