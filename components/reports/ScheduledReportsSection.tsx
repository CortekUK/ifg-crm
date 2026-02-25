'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { Clock, Plus, Trash2, Loader2, CalendarClock } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'
import {
  useScheduledReports,
  useCreateScheduledReport,
  useToggleScheduledReport,
  useDeleteScheduledReport,
} from '@/lib/hooks/useScheduledReports'

const REPORT_TYPES = [
  { value: 'contacts-export', label: 'Contacts Export' },
  { value: 'pipeline-report', label: 'Pipeline Report' },
  { value: 'revenue-report', label: 'Revenue Report' },
  { value: 'campaign-performance', label: 'Campaign Performance' },
  { value: 'recruiter-performance', label: 'Recruiter Performance' },
  { value: 'monthly-summary', label: 'Monthly Summary' },
  { value: 'automation-report', label: 'Automation Report' },
  { value: 'invoice-ageing', label: 'Invoice Ageing Report' },
]

function formatRelativeDate(dateStr: string | null) {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays)
    if (absDays === 0) return 'Today'
    if (absDays === 1) return 'Yesterday'
    return `${absDays} days ago`
  }
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return `In ${diffDays} days`
}

export function ScheduledReportsSection() {
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [newReport, setNewReport] = useState({
    report_type: '',
    report_name: '',
    frequency: '' as 'daily' | 'weekly' | 'monthly' | '',
    recipients: '',
  })

  const { data: reports = [], isLoading } = useScheduledReports()
  const createMutation = useCreateScheduledReport()
  const toggleMutation = useToggleScheduledReport()
  const deleteMutation = useDeleteScheduledReport()

  const handleCreate = () => {
    if (!newReport.report_type || !newReport.report_name || !newReport.frequency || !newReport.recipients.trim()) {
      toast({ title: 'Missing fields', description: 'Please fill in all fields.', variant: 'destructive' })
      return
    }

    const recipients = newReport.recipients.split(',').map((e) => e.trim()).filter(Boolean)
    if (recipients.length === 0) {
      toast({ title: 'No recipients', description: 'Please enter at least one email.', variant: 'destructive' })
      return
    }

    createMutation.mutate(
      {
        report_type: newReport.report_type,
        report_name: newReport.report_name,
        frequency: newReport.frequency as 'daily' | 'weekly' | 'monthly',
        recipients,
      },
      {
        onSuccess: () => {
          toast({ title: 'Schedule created', description: `"${newReport.report_name}" has been scheduled.` })
          setCreateOpen(false)
          setNewReport({ report_type: '', report_name: '', frequency: '', recipients: '' })
        },
        onError: (err) => {
          toast({ title: 'Failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
        },
      }
    )
  }

  const handleDelete = () => {
    if (!deleteId) return
    deleteMutation.mutate(deleteId, {
      onSuccess: () => {
        toast({ title: 'Schedule deleted' })
        setDeleteId(null)
      },
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Scheduled Reports
            </CardTitle>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New Schedule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading...
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No scheduled reports yet.</p>
              <p className="text-xs mt-1">Create a schedule to automatically send reports by email.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Switch
                      checked={report.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: report.id, is_active: checked })
                      }
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{report.report_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {report.frequency}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}
                        </span>
                        {report.next_run_at && report.is_active && (
                          <span className="text-xs text-muted-foreground">
                            Next: {formatRelativeDate(report.next_run_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-red-600"
                    onClick={() => setDeleteId(report.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule a Report</DialogTitle>
            <DialogDescription>
              The report will be generated and emailed to recipients on the chosen frequency.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select
                value={newReport.report_type}
                onValueChange={(v) => {
                  const label = REPORT_TYPES.find((r) => r.value === v)?.label || ''
                  setNewReport((p) => ({ ...p, report_type: v, report_name: p.report_name || label }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select report..." />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Schedule Name</Label>
              <Input
                value={newReport.report_name}
                onChange={(e) => setNewReport((p) => ({ ...p, report_name: e.target.value }))}
                placeholder="e.g. Weekly Pipeline Summary"
              />
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={newReport.frequency}
                onValueChange={(v) => setNewReport((p) => ({ ...p, frequency: v as typeof p.frequency }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily (8:00 AM)</SelectItem>
                  <SelectItem value="weekly">Weekly (Monday 8:00 AM)</SelectItem>
                  <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Recipients</Label>
              <Input
                value={newReport.recipients}
                onChange={(e) => setNewReport((p) => ({ ...p, recipients: e.target.value }))}
                placeholder="email@example.com, another@example.com"
              />
              <p className="text-xs text-muted-foreground">Comma-separated email addresses</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this scheduled report. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
