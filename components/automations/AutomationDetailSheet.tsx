'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Mail, Clock, ArrowRight, Users, Send, TrendingUp, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAutomation, useAutomationEnrollments, useToggleAutomation } from '@/lib/hooks/useAutomations'
import type { AutomationStep } from '@/lib/types/automations'

interface AutomationDetailSheetProps {
  automationId: string | null
  isOpen: boolean
  onClose: () => void
}

export function AutomationDetailSheet({
  automationId,
  isOpen,
  onClose,
}: AutomationDetailSheetProps) {
  const { data: automation, isLoading } = useAutomation(automationId)
  const { data: enrollments = [] } = useAutomationEnrollments(automationId)
  const toggleAutomation = useToggleAutomation()

  const handleToggle = async (isActive: boolean) => {
    if (!automationId) return
    await toggleAutomation.mutateAsync({ automationId, isActive })
  }

  const getStepIcon = (step: AutomationStep) => {
    switch (step.step_type) {
      case 'send_email':
        return <Mail className="h-4 w-4" />
      case 'wait':
        return <Clock className="h-4 w-4" />
      case 'send_sms':
        return <Send className="h-4 w-4" />
      default:
        return <ArrowRight className="h-4 w-4" />
    }
  }

  const getStepLabel = (step: AutomationStep) => {
    switch (step.step_type) {
      case 'send_email':
        return 'Send Email'
      case 'wait':
        return `Wait ${step.delay_days} day${step.delay_days !== 1 ? 's' : ''}`
      case 'send_sms':
        return 'Send SMS'
      case 'move_to_stage':
        return 'Move to Stage'
      default:
        return step.step_type
    }
  }

  const getStepDescription = (step: AutomationStep) => {
    switch (step.step_type) {
      case 'send_email':
        return step.template?.name || 'No template selected'
      case 'wait':
        return `${step.delay_days} day${step.delay_days !== 1 ? 's' : ''} delay`
      case 'send_sms':
        return step.sms_content?.slice(0, 50) + '...' || 'No content'
      default:
        return ''
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const activeEnrollments = enrollments.filter((e) => e.status === 'active')
  const completedEnrollments = enrollments.filter((e) => e.status === 'completed')

  // Sort steps by order
  const sortedSteps = [...(automation?.steps || [])].sort((a, b) => a.step_order - b.step_order)

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg">
        {isLoading || !automation ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center justify-between">
                <SheetTitle>{automation.name}</SheetTitle>
                <Switch
                  checked={automation.is_active}
                  onCheckedChange={handleToggle}
                />
              </div>
              <SheetDescription>
                {automation.description || 'No description'}
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="h-[calc(100vh-140px)] pr-4">
              <div className="space-y-6 mt-6">
                {/* Trigger Info */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Trigger</h3>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm">
                        When deal enters{' '}
                        <span className="font-medium text-blue-600">
                          {automation.trigger_stage?.name || 'Unknown'}
                        </span>{' '}
                        stage in{' '}
                        <Badge variant="outline" className="mx-1">
                          {automation.pipeline?.name || 'Unknown'}
                        </Badge>
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Stop Conditions */}
                {automation.stop_on_stage_ids && automation.stop_on_stage_ids.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-700">Stop Conditions</h3>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">
                          Stops when deal moves to:{' '}
                          {automation.stop_on_stage_ids.map((_, i) => (
                            <Badge key={i} variant="secondary" className="ml-1">
                              Stage {i + 1}
                            </Badge>
                          ))}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Steps Visualisation */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Workflow Steps</h3>
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-0">
                        {sortedSteps.map((step, index) => (
                          <div key={step.id} className="relative">
                            {/* Connector line */}
                            {index < sortedSteps.length - 1 && (
                              <div className="absolute left-[17px] top-[40px] w-0.5 h-[calc(100%-16px)] bg-gray-200" />
                            )}

                            <div className="flex items-start gap-3 py-2">
                              {/* Step Number & Icon */}
                              <div
                                className={cn(
                                  'flex items-center justify-center w-9 h-9 rounded-full shrink-0',
                                  step.step_type === 'send_email'
                                    ? 'bg-blue-100 text-blue-600'
                                    : 'bg-gray-100 text-gray-600'
                                )}
                              >
                                {getStepIcon(step)}
                              </div>

                              {/* Step Content */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                  [{step.step_order}] {getStepLabel(step)}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {getStepDescription(step)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}

                        {sortedSteps.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No steps configured
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Stats */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Statistics</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{activeEnrollments.length}</p>
                          <p className="text-xs text-muted-foreground">Enrolled</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Send className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">0</p>
                          <p className="text-xs text-muted-foreground">Total Sent</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <TrendingUp className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{completedEnrollments.length}</p>
                          <p className="text-xs text-muted-foreground">Completed</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Eye className="h-4 w-4 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">0%</p>
                          <p className="text-xs text-muted-foreground">Open Rate</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Currently Enrolled */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Currently Enrolled ({activeEnrollments.length})
                  </h3>
                  <Card>
                    <CardContent className="p-4">
                      {activeEnrollments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No contacts currently enrolled
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {activeEnrollments.slice(0, 5).map((enrollment) => {
                            const deal = enrollment.deal as any
                            const contact = deal?.contact
                            const name = contact
                              ? `${contact.first_name} ${contact.last_name}`
                              : deal?.title || 'Unknown'

                            return (
                              <div
                                key={enrollment.id}
                                className="flex items-center gap-3"
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                                    {getInitials(name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {contact?.email || 'No email'}
                                  </p>
                                </div>
                                <Badge variant="outline" className="shrink-0">
                                  Active
                                </Badge>
                              </div>
                            )
                          })}
                          {activeEnrollments.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center">
                              +{activeEnrollments.length - 5} more enrolled
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
