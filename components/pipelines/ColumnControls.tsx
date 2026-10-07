'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  MoreHorizontal,
  ArrowUpDown,
  ChevronLeft,
  Plus,
  Download,
} from 'lucide-react'
import type { SortOption } from '@/lib/hooks/useColumnPreferences'
import type { PipelineStage } from '@/lib/types/pipelines'

interface ColumnControlsProps {
  stage: PipelineStage
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
  onCollapse: () => void
  onAddDeal: () => void
  dealCount: number
}

export function ColumnControls({
  stage,
  sortBy,
  onSortChange,
  onCollapse,
  onAddDeal,
  dealCount,
}: ColumnControlsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          {stage.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onAddDeal}>
          <Plus className="h-4 w-4 mr-2" />
          Add deal
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onCollapse}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Collapse column
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          <ArrowUpDown className="h-3 w-3" />
          Sort by
        </DropdownMenuLabel>

        <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
          <DropdownMenuRadioItem value="value-desc" className="text-sm">
            Value (High to Low)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="value-asc" className="text-sm">
            Value (Low to High)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="date-desc" className="text-sm">
            Date Added (Newest)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="date-asc" className="text-sm">
            Date Added (Oldest)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="name-asc" className="text-sm">
            Name (A-Z)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="activity-desc" className="text-sm">
            Last Activity
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled={dealCount === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export ({dealCount})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
