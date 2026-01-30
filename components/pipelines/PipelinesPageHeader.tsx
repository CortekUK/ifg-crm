'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { Pipeline } from '@/lib/types/pipelines'

interface PipelinesPageHeaderProps {
  pipelines: Pipeline[]
  selectedPipelineId: string | null
  onPipelineChange: (pipelineId: string) => void
  isLoading: boolean
  dealCounts: Record<string, number>
}

export function PipelinesPageHeader({
  pipelines,
  selectedPipelineId,
  onPipelineChange,
  isLoading,
  dealCounts,
}: PipelinesPageHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-900 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-white/90 text-base">
          Track deals through your recruitment stages.
        </p>

        {/* Pipeline Selector */}
        <div className="w-full sm:w-64">
          {isLoading ? (
            <Skeleton className="h-10 w-full bg-white/20" />
          ) : (
            <Select
              value={selectedPipelineId || ''}
              onValueChange={onPipelineChange}
            >
              <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <SelectValue placeholder="Select a pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name} ({dealCounts[pipeline.id] || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  )
}
