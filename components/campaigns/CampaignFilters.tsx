'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, GitBranch } from 'lucide-react'
import { usePipelines } from '@/lib/hooks/usePipelines'
import type { CampaignFilters as CampaignFiltersType } from '@/lib/types/campaigns'

interface CampaignFiltersProps {
  filters: CampaignFiltersType
  onFiltersChange: (filters: CampaignFiltersType) => void
}

export function CampaignFilters({ filters, onFiltersChange }: CampaignFiltersProps) {
  const { data: pipelines = [] } = usePipelines()

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search campaigns..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Type Filter */}
      <Select
        value={filters.type || 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, type: value as CampaignFiltersType['type'] })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="email">Email</SelectItem>
          <SelectItem value="sms">SMS</SelectItem>
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select
        value={filters.status || 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, status: value as CampaignFiltersType['status'] })
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="scheduled">Scheduled</SelectItem>
          <SelectItem value="sending">Sending</SelectItem>
          <SelectItem value="sent">Sent</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      {/* Pipeline Filter */}
      <Select
        value={filters.pipelineId || 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, pipelineId: value as CampaignFiltersType['pipelineId'] })
        }
      >
        <SelectTrigger className="w-[180px]">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="All Pipelines" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Pipelines</SelectItem>
          <SelectItem value="generic">Generic Only</SelectItem>
          {pipelines.map((pipeline) => (
            <SelectItem key={pipeline.id} value={pipeline.id}>
              {pipeline.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
