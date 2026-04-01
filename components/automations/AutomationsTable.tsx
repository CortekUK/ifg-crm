'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Copy,
  Trash2,
  Zap,
  Mail,
  Users,
  Clock,
  FileCheck,
  Video,
  ReceiptPoundSterling,
  AlertTriangle,
  PartyPopper,
  Plane,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Automation } from '@/lib/types/automations'

interface AutomationsTableProps {
  automations: Automation[]
  isLoading: boolean
  onView: (automation: Automation) => void
  onEdit: (automation: Automation) => void
  onToggle: (automationId: string, isActive: boolean) => void
  onDuplicate: (automationId: string) => void
  onDelete: (automation: Automation) => void
}

type AutomationSortField = 'name' | 'enrolled' | 'last_run'
type SortDir = 'asc' | 'desc'

function AutomationSortIcon({ field, activeField, dir }: { field: AutomationSortField; activeField: AutomationSortField; dir: SortDir }) {
  if (field !== activeField) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
  return dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
}

export function AutomationsTable({
  automations,
  isLoading,
  onView,
  onEdit,
  onToggle,
  onDuplicate,
  onDelete,
}: AutomationsTableProps) {
  const [sortField, setSortField] = useState<AutomationSortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const toggleSort = (field: AutomationSortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'name' ? 'asc' : 'desc')
    }
  }

  const sortedAutomations = useMemo(() => {
    const sorted = [...automations]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'enrolled':
          cmp = (a.total_enrolled || 0) - (b.total_enrolled || 0)
          break
        case 'last_run':
          cmp = (a.last_run_at ? new Date(a.last_run_at).getTime() : 0) - (b.last_run_at ? new Date(b.last_run_at).getTime() : 0)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [automations, sortField, sortDir])

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workflow</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Pipeline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px] text-center">Enrolled</TableHead>
              <TableHead className="w-[80px] text-center">In Queue</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                <TableCell><Skeleton className="h-5 w-8 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-8 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (automations.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center bg-white dark:bg-slate-900 dark:border-slate-700">
        <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No automations yet</h3>
        <p className="text-muted-foreground">
          Create your first automation to streamline your follow-ups.
        </p>
      </div>
    )
  }

  const getStepsSummary = (automation: Automation) => {
    const steps = automation.steps || []
    const emailSteps = steps.filter((s) => s.step_type === 'send_email').length
    const waitSteps = steps.filter((s) => s.step_type === 'wait')
    const totalDays = waitSteps.reduce((sum, s) => sum + (s.delay_days || 0), 0)
    
    if (emailSteps === 0) {
      if (automation.automation_type === 'deal_creation') {
        return 'Auto-creates deals from form submissions'
      }
      return 'No email steps configured'
    }
    return `${emailSteps}-email sequence over ${totalDays} days`
  }

  const getTriggerLabel = (automation: Automation) => {
    if (automation.automation_type === 'deal_creation') {
      return 'Form submission'
    }
    if (automation.trigger_type === 'enters_stage') {
      return (
        <>
          Deal enters{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {automation.trigger_stage?.name || 'Unknown'}
          </span>
        </>
      )
    }
    if (automation.trigger_type === 'stage_change') {
      return (
        <>
          Deal moves to{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {automation.trigger_stage?.name || 'Unknown'}
          </span>
        </>
      )
    }
    if (automation.trigger_type === 'invoice_created') {
      return 'Invoice created'
    }
    if (automation.trigger_type === 'invoice_overdue') {
      return 'Invoice overdue'
    }
    if (automation.trigger_type === 'payment_received') {
      return 'Payment received'
    }
    if (automation.trigger_type === 'time_before_date') {
      const daysText = automation.config?.days_before
        ? `${automation.config.days_before} days before`
        : 'Before'
      const dateField = automation.config?.date_field?.replace(/_/g, ' ') || 'date'
      return `${daysText} ${dateField}`
    }
    return 'No trigger set'
  }

  const getTotalInQueue = (automation: Automation) => {
    return automation.steps?.reduce((sum, step) => sum + (step.stats?.in_queue || 0), 0) || 0
  }

  const getTypeIcon = (type: string | undefined) => {
    switch (type) {
      case 'deal_creation':
        return <Users className="h-4 w-4" />
      case 'initial_contact':
      case 'follow_up':
        return <Mail className="h-4 w-4" />
      case 'application_received':
        return <FileCheck className="h-4 w-4" />
      case 'interview_reminder':
      case 'post_interview':
        return <Video className="h-4 w-4" />
      case 'deposit_invoice':
        return <ReceiptPoundSterling className="h-4 w-4" />
      case 'payment_overdue':
        return <AlertTriangle className="h-4 w-4" />
      case 'welcome_sequence':
        return <PartyPopper className="h-4 w-4" />
      case 'pre_departure':
        return <Plane className="h-4 w-4" />
      default:
        return <Zap className="h-4 w-4" />
    }
  }

  const getTypeIconColor = (type: string | undefined) => {
    switch (type) {
      case 'deal_creation':
        return 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
      case 'initial_contact':
      case 'follow_up':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
      case 'application_received':
        return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
      case 'interview_reminder':
      case 'post_interview':
        return 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
      case 'deposit_invoice':
        return 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
      case 'payment_overdue':
        return 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
      case 'welcome_sequence':
        return 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
      case 'pre_departure':
        return 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400'
      default:
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
    }
  }

  return (
    <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('name')}>
              <div className="flex items-center gap-1">
                Workflow <AutomationSortIcon field="name" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-[120px]">Trigger</TableHead>
            <TableHead className="w-[110px]">Pipeline</TableHead>
            <TableHead className="w-[70px]">Status</TableHead>
            <TableHead className="w-[80px] text-center cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('enrolled')}>
              <div className="flex items-center justify-center gap-1">
                Enrolled <AutomationSortIcon field="enrolled" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-[80px] text-center">In Queue</TableHead>
            <TableHead className="w-[130px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('last_run')}>
              <div className="flex items-center gap-1">
                Last Run <AutomationSortIcon field="last_run" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAutomations.map((automation) => {
            const inQueue = getTotalInQueue(automation)
            
            return (
              <TableRow key={automation.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800" onClick={() => onView(automation)}>
                {/* Workflow */}
                <TableCell>
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded mt-0.5 ${getTypeIconColor(automation.automation_type)}`}>
                      {getTypeIcon(automation.automation_type)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{automation.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {getStepsSummary(automation)}
                      </p>
                    </div>
                  </div>
                </TableCell>

                {/* Trigger */}
                <TableCell className="text-sm text-muted-foreground">
                  {getTriggerLabel(automation)}
                </TableCell>

                {/* Pipeline */}
                <TableCell>
                  {automation.pipeline ? (
                    <Badge variant="outline">{automation.pipeline.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={automation.is_active}
                    onCheckedChange={(checked) => onToggle(automation.id, checked)}
                    className="data-[state=checked]:bg-green-500"
                  />
                </TableCell>

                {/* Enrolled */}
                <TableCell className="text-center">
                  <span className="font-medium">{automation.total_enrolled || 0}</span>
                </TableCell>

                {/* In Queue */}
                <TableCell className="text-center">
                  {inQueue > 0 ? (
                    <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                      <Clock className="h-3 w-3 mr-1" />
                      {inQueue}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>

                {/* Last Run */}
                <TableCell className="text-sm text-muted-foreground">
                  {automation.last_run_at
                    ? formatDateTime(automation.last_run_at)
                    : 'Never'}
                </TableCell>

                {/* Actions */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(automation)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(automation)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDuplicate(automation.id)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(automation)}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/30"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}