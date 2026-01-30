'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search } from 'lucide-react'
import type { TemplateFilters as TemplateFiltersType } from '@/lib/types/templates'

interface TemplateFiltersProps {
  filters: TemplateFiltersType
  onFiltersChange: (filters: TemplateFiltersType) => void
}

export function TemplateFilters({ filters, onFiltersChange }: TemplateFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Category Filter */}
      <Select
        value={filters.category || 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, category: value as TemplateFiltersType['category'] })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="automation">Automation</SelectItem>
          <SelectItem value="campaign">Campaign</SelectItem>
          <SelectItem value="transactional">Transactional</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
