'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { History } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/format'
import type { AutomationLog, AutomationFilters, Automation } from '@/lib/types/automations'

interface RunHistoryTableProps {
  logs: AutomationLog[]
  automations: Automation[]
  isLoading: boolean
  filters: AutomationFilters
  onFiltersChange: (filters: AutomationFilters) => void
}

const statusConfig = {
  pending: { label: 'Pending', className: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' },
  sent: { label: 'Sent', className: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
  failed: { label: 'Failed', className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
  skipped: { label: 'Skipped', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
}

export function RunHistoryTable({
  logs,
  automations,
  isLoading,
  filters,
  onFiltersChange,
}: RunHistoryTableProps) {
  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || ''
    const last = lastName?.[0] || ''
    return (first + last).toUpperCase() || '??'
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select
          value={filters.workflow || 'all'}
          onValueChange={(v) => onFiltersChange({ ...filters, workflow: v })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Workflows" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Workflows</SelectItem>
            {automations.map((automation) => (
              <SelectItem key={automation.id} value={automation.id}>
                {automation.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status || 'all'}
          onValueChange={(v) => onFiltersChange({ ...filters, status: v as AutomationFilters['status'] })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : logs.length === 0 ? (
        <div className="border rounded-lg p-12 text-center bg-white dark:bg-slate-900 dark:border-slate-700">
          <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No run history yet</h3>
          <p className="text-muted-foreground">
            Automation runs will appear here once your automations start sending emails.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const contact = log.deal?.contact
                const status = statusConfig[log.status]
                const automationId = log.step?.automation_id
                // The nested join doesn't pull the automation's full steps
                // array, so log.step.automation.steps is always undefined and
                // we got "X of 0" everywhere. The page passes the full
                // automations list (with steps joined) — use it as the source
                // of truth for both the workflow name and total step count.
                const automation = automationId
                  ? automations.find((a) => a.id === automationId)
                  : null
                const automationName =
                  automation?.name || log.step?.automation?.name || 'Unknown'
                const stepOrder = log.step?.step_order || 0
                const totalSteps = automation?.steps?.length ?? 0

                return (
                  <TableRow key={log.id}>
                    {/* Workflow */}
                    <TableCell className="font-medium">
                      {automationName}
                    </TableCell>

                    {/* Contact */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs">
                            {getInitials(contact?.first_name, contact?.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {contact
                            ? `${contact.first_name} ${contact.last_name}`
                            : log.deal?.title || 'Unknown'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Step */}
                    <TableCell className="text-sm text-muted-foreground">
                      Email {stepOrder} of {totalSteps}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge className={status.className}>{status.label}</Badge>
                    </TableCell>

                    {/* Sent At */}
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(log.sent_at)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
