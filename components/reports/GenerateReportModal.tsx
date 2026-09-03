'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, FileText, AlertCircle, Info } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { useUsers } from '@/lib/hooks/useUsers'
import { findReport } from '@/lib/reports/catalogue'

interface GenerateReportModalProps {
  reportId: string | null
  isOpen: boolean
  onClose: () => void
}

const PRESETS = [
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
  { id: '365d', label: 'Last 12 months', days: 365 },
  { id: 'all', label: 'All time', days: null },
  { id: 'custom', label: 'Custom range', days: null },
] as const

function isoDay(date: Date) {
  return date.toISOString().split('T')[0]
}

export function GenerateReportModal({ reportId, isOpen, onClose }: GenerateReportModalProps) {
  const [preset, setPreset] = useState<string>('90d')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pipelineId, setPipelineId] = useState<string | null>(null)
  const [recruiterId, setRecruiterId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { toast } = useToast()
  const { data: pipelines = [] } = usePipelines()
  const { data: users = [] } = useUsers()

  const report = reportId ? findReport(reportId) : undefined

  useEffect(() => {
    if (!isOpen) return
    const today = new Date()
    setPreset('90d')
    setDateFrom(isoDay(new Date(today.getTime() - 90 * 86_400_000)))
    setDateTo(isoDay(today))
    setPipelineId(null)
    setRecruiterId(null)
    setError(null)
  }, [isOpen])

  const applyPreset = (id: string) => {
    setPreset(id)
    setError(null)
    const option = PRESETS.find((p) => p.id === id)
    if (option?.days) {
      const today = new Date()
      setDateFrom(isoDay(new Date(today.getTime() - option.days * 86_400_000)))
      setDateTo(isoDay(today))
    }
  }

  const handleGenerate = async () => {
    if (!report) return

    const wholeHistory = report.snapshot || preset === 'all'
    if (!wholeHistory && (!dateFrom || !dateTo)) {
      setError('Please choose both a start and an end date.')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (!wholeHistory) {
        params.set('from', dateFrom)
        params.set('to', dateTo)
      }
      if (report.pipelineFilter && pipelineId) params.set('pipelineId', pipelineId)
      if (report.recruiterFilter && recruiterId) params.set('recruiterId', recruiterId)

      const res = await fetch(`/api/reports/${report.id}?${params.toString()}`)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Report failed (HTTP ${res.status})`)
      }

      // An empty report is not an error — the old modal showed a red
      // "Generation failed" for any period with no matching rows, which
      // is most periods when a table is still filling up.
      const rowCount = Number(res.headers.get('X-Report-Rows') ?? '0')
      if (rowCount === 0) {
        setError(
          report.snapshot
            ? 'There is nothing to report yet — no matching records exist.'
            : 'No records in that date range. Try a wider range, or "All time".',
        )
        setIsGenerating(false)
        return
      }

      const blob = await res.blob()
      const filename =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        `${report.id}.csv`

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'Report downloaded',
        description: `${report.name} — ${rowCount.toLocaleString()} ${rowCount === 1 ? 'row' : 'rows'}.`,
      })
      onClose()
    } catch (err) {
      console.error('Report generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!report) return null

  const showDates = !report.snapshot

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {report.name}
          </DialogTitle>
          <DialogDescription>{report.description}</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {report.snapshot ? (
            <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-muted-foreground dark:border-slate-700 dark:bg-slate-800/60">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This report describes the position right now, so it does not take a date range.
              </span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={preset} onValueChange={applyPreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {preset === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateFrom">From</Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value)
                        setError(null)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateTo">To</Label>
                    <Input
                      id="dateTo"
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value)
                        setError(null)
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {report.pipelineFilter && (
            <div className="space-y-2">
              <Label>Programme (optional)</Label>
              <Select
                value={pipelineId || '__all__'}
                onValueChange={(v) => setPipelineId(v === '__all__' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All programmes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All programmes</SelectItem>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {report.recruiterFilter && (
            <div className="space-y-2">
              <Label>Recruiter (optional)</Label>
              <Select
                value={recruiterId || '__all__'}
                onValueChange={(v) => setRecruiterId(v === '__all__' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All recruiters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All recruiters</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating} className="flex-1">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                'Download CSV'
              )}
            </Button>
          </div>

          {showDates && (
            <p className="text-center text-xs text-muted-foreground">
              Downloads as a CSV. Large exports may take a few seconds.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
