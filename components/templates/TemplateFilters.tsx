'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TemplateFilters as TemplateFiltersType } from '@/lib/types/templates'

interface TemplateFiltersProps {
  filters: TemplateFiltersType
  onFiltersChange: (filters: TemplateFiltersType) => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  showUnused: boolean
  onShowUnusedChange: (showUnused: boolean) => void
  unusedCount?: number
}

export function TemplateFilters({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  showUnused,
  onShowUnusedChange,
  unusedCount,
}: TemplateFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
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

      {/* Unused chip — toggle to surface orphan templates that no automation
          step or campaign references. Useful for periodic cleanup. */}
      <Button
        type="button"
        variant={showUnused ? 'default' : 'outline'}
        size="sm"
        className={cn('h-9 gap-1.5', showUnused && 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600')}
        onClick={() => onShowUnusedChange(!showUnused)}
      >
        Unused
        {typeof unusedCount === 'number' && (
          <span className={cn(
            'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
            showUnused ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          )}>
            {unusedCount}
          </span>
        )}
      </Button>

      {/* View Mode Toggle - hidden on mobile (always list on mobile) */}
      <div className="hidden sm:flex items-center border rounded-lg p-0.5 bg-muted/30 dark:bg-slate-800/50 ml-auto">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 w-8 p-0 rounded-md',
            viewMode === 'grid' && 'bg-white dark:bg-slate-700 shadow-sm'
          )}
          onClick={() => onViewModeChange('grid')}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 w-8 p-0 rounded-md',
            viewMode === 'list' && 'bg-white dark:bg-slate-700 shadow-sm'
          )}
          onClick={() => onViewModeChange('list')}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
