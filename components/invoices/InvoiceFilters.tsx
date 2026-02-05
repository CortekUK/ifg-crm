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
import { usePipelines } from '@/lib/hooks/usePipelines'
import type { InvoiceFilters as InvoiceFiltersType } from '@/lib/types/invoices'

interface InvoiceFiltersProps {
  filters: InvoiceFiltersType
  onFiltersChange: (filters: InvoiceFiltersType) => void
}

export function InvoiceFilters({ filters, onFiltersChange }: InvoiceFiltersProps) {
  const { data: pipelines = [] } = usePipelines()

  const hasActiveFilters =
    filters.search ||
    (filters.status && filters.status !== 'all') ||
    (filters.type && filters.type !== 'all') ||
    filters.pipelineId ||
    filters.dateFrom ||
    filters.dateTo

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      status: 'all',
      type: 'all',
      pipelineId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    })
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by invoice number or contact..."
            value={filters.search || ''}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <Select
          value={filters.status || 'all'}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, status: v as InvoiceFiltersType['status'] })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select
          value={filters.type || 'all'}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, type: v as InvoiceFiltersType['type'] })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="deposit">Deposit</SelectItem>
            <SelectItem value="installment">Instalment</SelectItem>
            <SelectItem value="full_payment">Full Payment</SelectItem>
            <SelectItem value="meal_plan">Meal Plan</SelectItem>
            <SelectItem value="trip">Trip</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        {/* Programme Filter */}
        <Select
          value={filters.pipelineId || 'all'}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, pipelineId: v === 'all' ? undefined : v })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Programmes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programmes</SelectItem>
            {pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range */}
        <Input
          type="date"
          className="w-[140px]"
          value={filters.dateFrom || ''}
          onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || undefined })}
          placeholder="From"
        />
        <Input
          type="date"
          className="w-[140px]"
          value={filters.dateTo || ''}
          onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || undefined })}
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
