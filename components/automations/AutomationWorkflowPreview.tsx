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
        return 'bg-blue-100 text-blue-600'
      case 'wait':
        return 'bg-gray-100 text-gray-600'
      case 'send_sms':
        return 'bg-green-100 text-green-600'
      case 'move_to_stage':
        return 'bg-orange-100 text-orange-600'
      case 'create_deal':
        return 'bg-purple-100 text-purple-600'
      default:
        return 'bg-gray-100 text-gray-600'
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
        <div className="absolute left-[17px] top-[40px] w-0.5 h-[calc(100%-8px)] bg-gray-200" />
        <div className="flex items-start gap-3 pb-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-slate-800 text-white">
            <Zap className="h-4 w-4" />
          </div>
          <div className="flex-1 pt-1.5">
            <p className="text-sm font-medium text-gray-900">Start automation when</p>
            <p className="text-xs text-muted-foreground">
              {getTriggerDescription()}
              {automation.pipeline && (
                <span>
                  {' '}
                  in <Badge variant="outline" className="text-xs ml-1">{automation.pipeline.name}</Badge>
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
            <div className="absolute left-[17px] top-[40px] w-0.5 h-[calc(100%-8px)] bg-gray-200" />
          )}

          <div className="flex items-start gap-3 pb-3">
            <div
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                getStepIconColor(step.step_type)
              )}
            >
              {getStepIcon(step.step_type)}
            </div>

            <div className="flex-1 min-w-0">
              {/* Email Step */}
              {step.step_type === 'send_email' && (
                <Card className="border shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">
                        Send an email:{' '}
                        <span className="text-blue-600">
                          {step.template?.name || 'No template selected'}
                        </span>
                      </p>
                    </div>
                    {step.template?.subject && (
                      <p className="text-xs text-muted-foreground mb-2 truncate">
                        {step.template.subject}
                      </p>
                    )}

                    {/* Stats */}
                    {showStats && step.stats && (
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Send className="h-3 w-3" />
                          <span className="font-medium text-gray-700">
                            {step.stats.sent}
                          </span>{' '}
                          sent
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Eye className="h-3 w-3" />
                          <span className="font-medium text-gray-700">
                            {step.stats.open_rate.toFixed(1)}%
                          </span>{' '}
                          open rate
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MousePointer className="h-3 w-3" />
                          <span className="font-medium text-gray-700">
                            {step.stats.click_rate.toFixed(1)}%
                          </span>{' '}
                          click rate
                        </div>
                      </div>
                    )}

                    {/* Placeholder stats when no real data */}
                    {showStats && !step.stats && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>No data yet</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Wait Step */}
              {step.step_type === 'wait' && (
                <div className="flex items-center gap-2 py-1.5">
                  <span className="text-sm text-gray-700">
                    Wait for{' '}
                    <span className="font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {formatWaitDuration(step)}
                    </span>
                  </span>
                  {showStats && step.stats && step.stats.in_queue > 0 && (
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                      <Users className="h-3 w-3 mr-1" />
                      {step.stats.in_queue} in queue
                    </Badge>
                  )}
                </div>
              )}

              {/* Move to Stage Step */}
              {step.step_type === 'move_to_stage' && (
                <Card className="border shadow-sm bg-orange-50/50">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium text-gray-900">
                      Update deal{' '}
                      <span className="text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                        Stage
                      </span>{' '}
                      to{' '}
                      <span className="text-gray-700">
                        {automation.pipeline?.name || 'Pipeline'} &gt;{' '}
                        <span className="font-semibold">
                          {/* This would need to fetch the target stage name */}
                          Next Stage
                        </span>
                      </span>
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Create Deal Step */}
              {step.step_type === 'create_deal' && (
                <Card className="border shadow-sm bg-purple-50/50">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium text-gray-900">
                      Add a deal for contact
                    </p>
                    <p className="text-xs text-muted-foreground">
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
          <div className="flex items-start gap-3 pt-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-green-100 text-green-600">
              <ArrowRight className="h-4 w-4" />
            </div>
            <div className="flex-1 pt-1.5">
              <Card className="border shadow-sm bg-green-50/50">
                <CardContent className="p-3">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Jump to success when
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Deal stage changes to:{' '}
                    {automation.stop_stages?.map((stage, i) => (
                      <span key={stage.id}>
                        {i > 0 && ' OR '}
                        <Badge variant="outline" className="text-xs">
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
      <div className="flex items-center gap-3 pt-2 pl-3">
        <div className="w-3 h-3 rounded-full bg-gray-300" />
        <span className="text-xs text-muted-foreground">Automation ends</span>
      </div>
    </div>
  )
}
