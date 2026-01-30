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
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Pencil, Zap } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/format'
import type { Automation } from '@/lib/types/automations'

interface AutomationsTableProps {
  automations: Automation[]
  isLoading: boolean
  onView: (automation: Automation) => void
  onEdit: (automation: Automation) => void
  onToggle: (automationId: string, isActive: boolean) => void
}

export function AutomationsTable({
  automations,
  isLoading,
  onView,
  onEdit,
  onToggle,
}: AutomationsTableProps) {
  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workflow</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Pipeline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Enrolled</TableHead>
              <TableHead className="text-right">Completed</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead className="w-[70px]"></TableHead>
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
      <div className="border rounded-lg p-12 text-center">
        <Zap className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No automations yet</h3>
        <p className="text-muted-foreground">
          Create your first automation to streamline your follow-ups.
        </p>
      </div>
    )
  }

  const getStepsSummary = (automation: Automation) => {
    const steps = automation.steps || []
    const emailSteps = steps.filter((s) => s.step_type === 'send_email').length
    const totalDays = steps
      .filter((s) => s.step_type === 'wait')
      .reduce((sum, s) => sum + s.delay_days, 0)
    return `${emailSteps}-step email sequence over ${totalDays} days`
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Workflow</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Pipeline</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Enrolled</TableHead>
            <TableHead className="text-right">Completed</TableHead>
            <TableHead>Last Run</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {automations.map((automation) => (
            <TableRow key={automation.id}>
              {/* Workflow */}
              <TableCell>
                <div>
                  <p className="font-medium text-gray-900">{automation.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {automation.description || getStepsSummary(automation)}
                  </p>
                </div>
              </TableCell>

              {/* Trigger */}
              <TableCell className="text-sm text-muted-foreground">
                {automation.trigger_stage ? (
                  <>Deal enters <span className="font-medium text-gray-700">{automation.trigger_stage.name}</span> stage</>
                ) : (
                  'No trigger set'
                )}
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
              <TableCell>
                <Switch
                  checked={automation.is_active}
                  onCheckedChange={(checked) => onToggle(automation.id, checked)}
                />
              </TableCell>

              {/* Enrolled */}
              <TableCell className="text-right font-medium">
                0
              </TableCell>

              {/* Completed */}
              <TableCell className="text-right text-muted-foreground">
                0
              </TableCell>

              {/* Last Run */}
              <TableCell className="text-sm text-muted-foreground">
                Never
              </TableCell>

              {/* Actions */}
              <TableCell>
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
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
