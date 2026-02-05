'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePipelines } from '@/lib/hooks/usePipelines'

interface AnalyticsPageHeaderProps {
  dateRange: string
  onDateRangeChange: (range: string) => void
  pipelineId: string | null
  onPipelineChange: (id: string | null) => void
}

export function AnalyticsPageHeader({
  dateRange,
  onDateRangeChange,
  pipelineId,
  onPipelineChange,
}: AnalyticsPageHeaderProps) {
  const { data: pipelines = [] } = usePipelines()

  return (
    <div className="banner-gradient rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-white/90 text-base">
          Insights and metrics for your recruitment performance.
        </p>

        <div className="flex gap-3">
          <Select
            value={pipelineId || '__all__'}
            onValueChange={(v) => onPipelineChange(v === '__all__' ? null : v)}
          >
            <SelectTrigger className="w-[180px] bg-white/10 border-white/20 text-white hover:bg-white/20">
              <SelectValue placeholder="All Programmes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Programmes</SelectItem>
              {pipelines.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={onDateRangeChange}>
            <SelectTrigger className="w-[160px] bg-white/10 border-white/20 text-white hover:bg-white/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
