'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { CUSTOM_RANGE_PREFIX, parseCustomRange } from '@/lib/hooks/useAnalytics'
import { Input } from '@/components/ui/input'

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
  const custom = parseCustomRange(dateRange)
  const today = new Date().toISOString().slice(0, 10)

  // Switching to "Custom range" seeds the last 30 days so the screen always
  // has a valid window rather than going blank while two dates are typed.
  const startCustom = () => {
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
    onDateRangeChange(`${CUSTOM_RANGE_PREFIX}${from}:${today}`)
  }
  const setCustom = (from: string, to: string) =>
    onDateRangeChange(`${CUSTOM_RANGE_PREFIX}${from}:${to}`)

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

          {custom && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="From"
                value={custom.from}
                max={custom.to || today}
                onChange={(e) => setCustom(e.target.value, custom.to)}
                className="w-[150px] bg-white/10 border-white/20 text-white"
              />
              <span className="text-white/70 text-sm">to</span>
              <Input
                type="date"
                aria-label="To"
                value={custom.to}
                min={custom.from}
                onChange={(e) => setCustom(custom.from, e.target.value)}
                className="w-[150px] bg-white/10 border-white/20 text-white"
              />
            </div>
          )}

          <Select
            value={custom ? 'custom' : dateRange}
            onValueChange={(v) => (v === 'custom' ? startCustom() : onDateRangeChange(v))}
          >
            <SelectTrigger className="w-[160px] bg-white/10 border-white/20 text-white hover:bg-white/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="custom">Custom range…</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
