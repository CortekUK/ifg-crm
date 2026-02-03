'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Mail,
  Clock,
  ArrowRight,
  Send,
  Eye,
  MousePointer,
  Users,
  Zap,
  Plus,
  CheckCircle2,
} from 'lucide-react'
import type { AutomationStep, Automation } from '@/lib/types/automations'

interface AutomationWorkflowPreviewProps {
  automation: Automation
  showStats?: boolean
  compact?: boolean
}

export function AutomationWorkflowPreview({
  automation,
  showStats = true,
  compact = false,
}: AutomationWorkflowPreviewProps) {
  const sortedSteps = [...(automation.steps || [])].sort(
    (a, b) => a.step_order - b.step_order
  )

  const getTriggerDescription = () => {
    if (automation.automation_type === 'deal_creation') {
      return 'Contact submits form'
    }
    if (automation.trigger_type === 'enters_stage') {
      return `Deal enters "${automation.trigger_stage?.name || 'Unknown'}" stage`
    }
    if (automation.trigger_type === 'stage_change') {
      return `Deal moves to "${automation.trigger_stage?.name || 'Unknown'}" stage`
    }
    return 'Unknown trigger'
  }

  const getStepIcon = (stepType: AutomationStep['step_type']) => {
    switch (stepType) {
      case 'send_email':
        return <Mail className="h-4 w-4" />
      case 'wait':
        return <Clock className="h-4 w-4" />
      case 'send_sms':
        return <Send className="h-4 w-4" />
      case 'move_to_stage':
        return <ArrowRight className="h-4 w-4" />
      case 'create_deal':
        return <Plus className="h-4 w-4" />
      default:
        return <Zap className="h-4 w-4" />
    }
  }

  const getStepIconColor = (stepType: AutomationStep['step_type']) => {
    switch (stepType) {
      case 'send_email':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600'
      case 'wait':
        return 'bg-slate-100 text-slate-600'
      case 'send_sms':
        return 'bg-green-100 dark:bg-green-900/50 text-green-600'
      case 'move_to_stage':
        return 'bg-orange-100 dark:bg-orange-900/50 text-orange-600'
      case 'create_deal':
        return 'bg-purple-100 dark:bg-purple-900/50 text-purple-600'
      default:
        return 'bg-slate-100 text-slate-600'
    }
  }

  const formatWaitDuration = (step: AutomationStep) => {
    const days = step.delay_days || 0
    const hours = step.delay_hours || 0
    if (days > 0 && hours > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`
    }
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}`
    }
    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`
    }
    return 'Immediately'
  }

  return (
    <div className={cn('space-y-0', compact && 'space-y-0')}>
      {/* Trigger */}
      <div className="relative">
        <div className="absolute left-[19px] top-[44px] w-0.5 h-[calc(100%-12px)] bg-slate-200" />
        <div className="flex items-start gap-4 pb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-slate-800 text-white shadow-sm">
            <Zap className="h-4 w-4" />
          </div>
          <div className="flex-1 pt-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Start automation when</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {getTriggerDescription()}
              {automation.pipeline && (
                <span className="inline-flex items-center ml-1.5">
                  in <Badge variant="outline" className="text-xs ml-1.5 font-normal">{automation.pipeline.name}</Badge>
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Steps */}
      {sortedSteps.map((step, index) => (
        <div key={step.id} className="relative">
          {/* Connector line */}
          {index < sortedSteps.length - 1 && (
            <div className="absolute left-[19px] top-[44px] w-0.5 h-[calc(100%-12px)] bg-slate-200" />
          )}

          <div className="flex items-start gap-4 pb-4">
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm',
                getStepIconColor(step.step_type)
              )}
            >
              {getStepIcon(step.step_type)}
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              {/* Email Step */}
              {step.step_type === 'send_email' && (
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Send an email:{' '}
                        {step.template ? (
                          <span className="text-blue-600 font-medium">
                            {step.template.name}
                          </span>
                        ) : (
                          <span className="text-blue-600 font-medium cursor-pointer hover:underline">
                            Select template →
                          </span>
                        )}
                      </p>
                    </div>
                    {step.template?.subject && (
                      <p className="text-xs text-muted-foreground mb-3 truncate">
                        Subject: {step.template.subject}
                      </p>
                    )}

                    {/* Stats */}
                    {showStats && step.stats && (
                      <div className="flex items-center gap-4 text-xs pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Send className="h-3 w-3" />
                          <span className="font-semibold text-gray-700 dark:text-gray-300 dark:text-gray-300">
                            {step.stats.sent ?? 0}
                          </span>{' '}
                          sent
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Eye className="h-3 w-3" />
                          <span className="font-semibold text-gray-700 dark:text-gray-300 dark:text-gray-300">
                            {(step.stats.open_rate ?? 0).toFixed(1)}%
                          </span>{' '}
                          opened
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MousePointer className="h-3 w-3" />
                          <span className="font-semibold text-gray-700 dark:text-gray-300 dark:text-gray-300">
                            {(step.stats.click_rate ?? 0).toFixed(1)}%
                          </span>{' '}
                          clicked
                        </div>
                      </div>
                    )}

                    {/* Placeholder stats when no real data */}
                    {showStats && !step.stats && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2 border-t border-slate-100">
                        <Clock className="h-3 w-3" />
                        No data yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Wait Step */}
              {step.step_type === 'wait' && (
                <div className="flex items-center gap-2 py-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300 dark:text-gray-300">
                    Wait for{' '}
                    <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      {formatWaitDuration(step)}
                    </span>
                  </span>
                  {showStats && step.stats && step.stats.in_queue > 0 && (
                    <Badge className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 hover:bg-amber-100">
                      <Users className="h-3 w-3 mr-1" />
                      {step.stats.in_queue} waiting
                    </Badge>
                  )}
                </div>
              )}

              {/* Move to Stage Step */}
              {step.step_type === 'move_to_stage' && (
                <Card className="border-orange-200 shadow-sm bg-orange-50/50">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Move deal to stage:{' '}
                      <span className="text-orange-600 font-semibold">
                        {/* This would need to fetch the target stage name */}
                        Next Stage
                      </span>
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Create Deal Step */}
              {step.step_type === 'create_deal' && (
                <Card className="border-purple-200 shadow-sm bg-purple-50/50">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Create a deal for contact
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Round-robin assignment to selected recruiters
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Exit Conditions */}
      {automation.stop_on_stage_ids && automation.stop_on_stage_ids.length > 0 && (
        <div className="relative">
          <div className="flex items-start gap-4 pt-1 pb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-green-100 dark:bg-green-900/50 text-green-600 shadow-sm">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="flex-1 pt-0.5">
              <Card className="border-green-200 shadow-sm bg-green-50/50">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Exit early when
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Deal moves to:{' '}
                    {automation.stop_stages?.map((stage, i) => (
                      <span key={stage.id}>
                        {i > 0 && <span className="mx-1">or</span>}
                        <Badge variant="outline" className="text-xs font-normal">
                          {stage.name}
                        </Badge>
                      </span>
                    )) || (
                      <span className="text-muted-foreground">
                        {automation.stop_on_stage_ids.length} stage(s) selected
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Automation ends indicator */}
      <div className="flex items-center gap-4 pt-1 pl-1">
        <div className="w-8 flex justify-center">
          <div className="w-3 h-3 rounded-full bg-slate-300" />
        </div>
        <span className="text-xs text-muted-foreground font-medium">Automation ends</span>
      </div>
    </div>
  )
}
