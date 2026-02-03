'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Settings, Plus } from 'lucide-react'
import type { Pipeline } from '@/lib/types/pipelines'

interface PipelinesPageHeaderProps {
  pipelines: Pipeline[]
  selectedPipelineId: string | null
  onPipelineChange: (pipelineId: string) => void
  onOpenSettings: () => void
  onOpenCreate: () => void
  onAddDeal?: () => void
  isLoading: boolean
  dealCounts: Record<string, number>
}

export function PipelinesPageHeader({
  pipelines,
  selectedPipelineId,
  onPipelineChange,
  onOpenSettings,
  onOpenCreate,
  onAddDeal,
  isLoading,
  dealCounts,
}: PipelinesPageHeaderProps) {
  return (
    <div className="banner-gradient rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-white/90 text-base">
          Track deals through your recruitment stages.
        </p>

        {/* Pipeline Selector with Settings and Add buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
          
          <div className="flex items-center gap-2">
            {/* Add Deal Button - Most important action */}
            {onAddDeal && (
              <Button
                size="sm"
                onClick={onAddDeal}
                disabled={!selectedPipelineId || isLoading}
                className="bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-50 font-semibold"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Deal
              </Button>
            )}
            
            {/* Settings Button */}
            <Button
              size="sm"
              onClick={onOpenSettings}
              disabled={!selectedPipelineId || isLoading}
              className="bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-50"
            >
              <Settings className="h-4 w-4 mr-1.5" />
              Settings
            </Button>
            
            {/* Add Pipeline Button */}
            <Button
              size="sm"
              onClick={onOpenCreate}
              disabled={isLoading}
              className="bg-white text-blue-600 hover:bg-blue-50"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Pipeline
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
