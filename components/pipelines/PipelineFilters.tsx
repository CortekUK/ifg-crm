'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Deal } from '@/lib/types/pipelines'
import type { ViewMode } from '@/lib/hooks/usePipelineViewPreference'

interface PipelineFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  ownerFilter: string
  onOwnerFilterChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  deals: Deal[]
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function PipelineFilters({
  search,
  onSearchChange,
  ownerFilter,
  onOwnerFilterChange,
  statusFilter,
  onStatusFilterChange,
  deals,
  viewMode,
  onViewModeChange,
}: PipelineFiltersProps) {
  // Extract unique owners from deals
  const owners = useMemo(() => {
    const ownerMap = new Map<string, { id: string; name: string }>()
    deals.forEach((deal) => {
      if (deal.owner && deal.deal_owner_id) {
        ownerMap.set(deal.deal_owner_id, {
          id: deal.deal_owner_id,
          name: deal.owner.full_name || deal.owner.email,
        })
      }
    })
    return Array.from(ownerMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [deals])

  const hasFilters = search || ownerFilter !== 'all' || statusFilter !== 'all'

  const handleClearFilters = () => {
    onSearchChange('')
    onOwnerFilterChange('all')
    onStatusFilterChange('all')
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      {/* Filter Dropdowns */}
      <div className="flex flex-wrap gap-2">
        {/* Owner Filter */}
        <Select value={ownerFilter} onValueChange={onOwnerFilterChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Owners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {owners.map((owner) => (
              <SelectItem key={owner.id} value={owner.id}>
                {owner.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-xs ml-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search deals..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Deal Freshness Legend */}
      <div className="hidden md:flex items-center gap-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Hot</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Follow up</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>Stale</span>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center border rounded-lg p-1 bg-muted/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewModeChange('kanban')}
          className={cn(
            'h-7 px-2',
            viewMode === 'kanban' && 'bg-background shadow-sm'
          )}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewModeChange('list')}
          className={cn(
            'h-7 px-2',
            viewMode === 'list' && 'bg-background shadow-sm'
          )}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
