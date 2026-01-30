'use client'

import { useState } from 'react'
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
import { Loader2, FileText } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'

const reportInfo: Record<string, { name: string; formats: string[] }> = {
  'contacts-export': { name: 'Contacts Export', formats: ['csv'] },
  'pipeline-report': { name: 'Pipeline Report', formats: ['csv', 'pdf'] },
  'revenue-report': { name: 'Revenue Report', formats: ['csv', 'pdf'] },
  'campaign-performance': { name: 'Campaign Performance', formats: ['csv', 'pdf'] },
  'recruiter-performance': { name: 'Recruiter Performance', formats: ['csv', 'pdf'] },
  'monthly-summary': { name: 'Monthly Summary', formats: ['pdf'] },
  'automation-report': { name: 'Automation Report', formats: ['csv'] },
  'sms-email-responses': { name: 'SMS/Email Responses', formats: ['csv'] },
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
  const [isGenerating, setIsGenerating] = useState(false)

  const { toast } = useToast()

  const report = reportId ? reportInfo[reportId] : null

  const handleGenerate = async () => {
    setIsGenerating(true)

    // Simulate generation
    await new Promise((resolve) => setTimeout(resolve, 1000))

    toast({
      title: 'Coming soon',
      description: 'Report generation will be available soon.',
    })

    setIsGenerating(false)
    onClose()
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
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

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
                'Generate Report'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
