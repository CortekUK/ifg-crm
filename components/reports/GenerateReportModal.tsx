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
import { Loader2, FileText, AlertCircle } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { generateReport, ReportType } from '@/lib/utils/generateReport'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { useUsers } from '@/lib/hooks/useUsers'

const reportInfo: Record<string, {
  name: string
  formats: string[]
  reportType: ReportType | null
  supportsPipelineFilter?: boolean
  supportsRecruiterFilter?: boolean
}> = {
  'contacts-export': { name: 'Contacts Export', formats: ['csv'], reportType: 'contacts' },
  'pipeline-report': { name: 'Pipeline Report', formats: ['csv'], reportType: 'pipeline', supportsPipelineFilter: true, supportsRecruiterFilter: true },
  'revenue-report': { name: 'Revenue Report', formats: ['csv'], reportType: 'revenue', supportsPipelineFilter: true },
  'campaign-performance': { name: 'Campaign Performance', formats: ['csv'], reportType: 'campaign' },
  'campaign-conversions': { name: 'Campaign Conversions', formats: ['csv'], reportType: 'campaign-conversions', supportsPipelineFilter: true },
  'recruiter-performance': { name: 'Recruiter Performance', formats: ['csv'], reportType: 'recruiter', supportsRecruiterFilter: true },
  'monthly-summary': { name: 'Monthly Summary', formats: ['csv'], reportType: 'monthly', supportsPipelineFilter: true },
  'automation-report': { name: 'Automation Report', formats: ['csv'], reportType: 'automation', supportsPipelineFilter: true },
  'sms-email-responses': { name: 'SMS/Email Responses', formats: ['csv'], reportType: 'responses' },
  'invoice-ageing': { name: 'Invoice Ageing Report', formats: ['csv'], reportType: 'invoice-ageing', supportsPipelineFilter: true },
  'sms-campaign-costs': { name: 'SMS Campaign Costs', formats: ['csv'], reportType: 'sms-costs' },
  'deposit-conversion': { name: 'Deposit Conversion Rate', formats: ['csv'], reportType: 'deposit-conversion', supportsPipelineFilter: true },
}

interface GenerateReportModalProps {
  reportId: string | null
  isOpen: boolean
  onClose: () => void
}

export function GenerateReportModal({
  reportId,
  isOpen,
  onClose,
}: GenerateReportModalProps) {
  const [format, setFormat] = useState('csv')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pipelineId, setPipelineId] = useState<string | null>(null)
  const [recruiterId, setRecruiterId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { toast } = useToast()
  const { data: pipelines = [] } = usePipelines()
  const { data: users = [] } = useUsers()

  const report = reportId ? reportInfo[reportId] : null

  // Set default dates when modal opens
  useEffect(() => {
    if (isOpen) {
      const today = new Date()
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      setDateFrom(thirtyDaysAgo.toISOString().split('T')[0])
      setDateTo(today.toISOString().split('T')[0])
      setPipelineId(null)
      setRecruiterId(null)
      setError(null)
    }
  }, [isOpen])

  const handleGenerate = async () => {
    if (!report || !report.reportType) {
      toast({
        title: 'Not available',
        description: 'This report type is not yet implemented.',
        variant: 'destructive',
      })
      return
    }

    if (!dateFrom || !dateTo) {
      setError('Please select both start and end dates')
      return
    }

    const startDate = new Date(dateFrom)
    const endDate = new Date(dateTo)
    endDate.setHours(23, 59, 59, 999) // Include the full end day

    if (startDate > endDate) {
      setError('Start date must be before end date')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      await generateReport({
        type: report.reportType,
        dateRange: { start: startDate, end: endDate },
        format: format as 'csv' | 'pdf',
        pipelineId,
        recruiterId,
      })

      toast({
        title: 'Report generated',
        description: `Your ${report.name} has been downloaded.`,
      })

      onClose()
    } catch (err) {
      console.error('Report generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate report')
      toast({
        title: 'Generation failed',
        description: 'Failed to generate the report. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  if (!report) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate {report.name}
          </DialogTitle>
          <DialogDescription>
            Configure your report settings and generate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Input value={report.name} disabled className="bg-gray-50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Date From</Label>
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
              <Label htmlFor="dateTo">Date To</Label>
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

          {/* Pipeline Filter */}
          {report.supportsPipelineFilter && (
            <div className="space-y-2">
              <Label>Programme (optional)</Label>
              <Select
                value={pipelineId || '__all__'}
                onValueChange={(v) => setPipelineId(v === '__all__' ? null : v)}
              >
                <SelectTrigger>
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
            </div>
          )}

          {/* Recruiter Filter */}
          {report.supportsRecruiterFilter && (
            <div className="space-y-2">
              <Label>Recruiter (optional)</Label>
              <Select
                value={recruiterId || '__all__'}
                onValueChange={(v) => setRecruiterId(v === '__all__' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Recruiters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Recruiters</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {report.formats.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Download Report'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
