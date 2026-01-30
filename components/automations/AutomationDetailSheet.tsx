'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Send, TrendingUp, Eye, Pencil, Clock } from 'lucide-react'
import { useAutomation, useAutomationEnrollments, useToggleAutomation } from '@/lib/hooks/useAutomations'
import { AutomationWorkflowPreview } from './AutomationWorkflowPreview'
import { formatDateTime } from '@/lib/utils/format'

interface AutomationDetailSheetProps {
  automationId: string | null
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
}

export function AutomationDetailSheet({
  automationId,
  isOpen,
  onClose,
  onEdit,
}: AutomationDetailSheetProps) {
  const { data: automation, isLoading } = useAutomation(automationId)
  const { data: enrollments = [] } = useAutomationEnrollments(automationId)
  const toggleAutomation = useToggleAutomation()

  const handleToggle = async (isActive: boolean) => {
    if (!automationId) return
    await toggleAutomation.mutateAsync({ automationId, isActive })
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
  const stoppedEnrollments = enrollments.filter((e) => e.status === 'stopped')

  // Calculate totals
  const totalSent = automation?.steps?.reduce(
    (sum, step) => sum + (step.stats?.sent || 0),
    0
  ) || 0
  const totalInQueue = automation?.steps?.reduce(
    (sum, step) => sum + (step.stats?.in_queue || 0),
    0
  ) || 0
  const avgOpenRate = automation?.steps?.length
    ? automation.steps
        .filter((s) => s.step_type === 'send_email' && s.stats)
        .reduce((sum, s) => sum + (s.stats?.open_rate || 0), 0) /
      (automation.steps.filter((s) => s.step_type === 'send_email' && s.stats).length || 1)
    : 0

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl">
        {isLoading || !automation ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <SheetTitle className="font-oswald text-xl uppercase">
                    {automation.name}
                  </SheetTitle>
                  <SheetDescription className="mt-1">
                    {automation.description || 'No description'}
                  </SheetDescription>
                </div>
                <div className="flex items-center gap-3">
                  {onEdit && (
                    <Button variant="outline" size="sm" onClick={onEdit}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  <Switch
                    checked={automation.is_active}
                    onCheckedChange={handleToggle}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={automation.is_active ? 'default' : 'secondary'}>
                  {automation.is_active ? 'Active' : 'Paused'}
                </Badge>
                {automation.pipeline && (
                  <Badge variant="outline">{automation.pipeline.name}</Badge>
                )}
              </div>
            </SheetHeader>

            <Tabs defaultValue="workflow" className="flex-1">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="workflow">Workflow</TabsTrigger>
                <TabsTrigger value="stats">Stats</TabsTrigger>
                <TabsTrigger value="enrolled">
                  Enrolled ({activeEnrollments.length})
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[calc(100vh-280px)] mt-4">
                <TabsContent value="workflow" className="mt-0">
                  <AutomationWorkflowPreview
                    automation={automation}
                    showStats={true}
                  />
                </TabsContent>

                <TabsContent value="stats" className="mt-0 space-y-4">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{activeEnrollments.length}</p>
                          <p className="text-xs text-muted-foreground">Currently Enrolled</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <Clock className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{totalInQueue}</p>
                          <p className="text-xs text-muted-foreground">In Queue</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Send className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{totalSent}</p>
                          <p className="text-xs text-muted-foreground">Total Sent</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Eye className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{avgOpenRate.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">Avg. Open Rate</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{completedEnrollments.length}</p>
                          <p className="text-xs text-muted-foreground">Completed</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <Users className="h-4 w-4 text-red-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{stoppedEnrollments.length}</p>
                          <p className="text-xs text-muted-foreground">Stopped / Exited</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Per-Step Stats */}
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-blue-900 uppercase">
                      Step Performance
                    </h3>
                    {automation.steps
                      ?.filter((s) => s.step_type === 'send_email')
                      .sort((a, b) => a.step_order - b.step_order)
                      .map((step, index) => (
                        <Card key={step.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium">
                                Email {index + 1}: {step.template?.name || 'Unknown'}
                              </p>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                              <div className="p-2 bg-gray-50 rounded">
                                <p className="text-lg font-bold">{step.stats?.sent || 0}</p>
                                <p className="text-xs text-muted-foreground">Sent</p>
                              </div>
                              <div className="p-2 bg-gray-50 rounded">
                                <p className="text-lg font-bold">{step.stats?.opened || 0}</p>
                                <p className="text-xs text-muted-foreground">Opened</p>
                              </div>
                              <div className="p-2 bg-gray-50 rounded">
                                <p className="text-lg font-bold">
                                  {step.stats?.open_rate?.toFixed(1) || 0}%
                                </p>
                                <p className="text-xs text-muted-foreground">Open Rate</p>
                              </div>
                              <div className="p-2 bg-gray-50 rounded">
                                <p className="text-lg font-bold">
                                  {step.stats?.click_rate?.toFixed(1) || 0}%
                                </p>
                                <p className="text-xs text-muted-foreground">Click Rate</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </TabsContent>

                <TabsContent value="enrolled" className="mt-0 space-y-4">
                  {/* Active Enrollments */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-blue-900 uppercase">
                      Currently Active ({activeEnrollments.length})
                    </h3>
                    {activeEnrollments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No contacts currently enrolled
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {activeEnrollments.slice(0, 10).map((enrollment) => {
                          const deal = enrollment.deal
                          const contact = deal?.contact
                          const name = contact
                            ? `${contact.first_name} ${contact.last_name}`
                            : deal?.title || 'Unknown'

                          return (
                            <Card key={enrollment.id}>
                              <CardContent className="p-3">
                                <div className="flex items-center gap-3">
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
                                  <div className="text-right">
                                    <Badge variant="outline" className="text-xs">
                                      Active
                                    </Badge>
                                    {enrollment.next_step_at && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Next: {formatDateTime(enrollment.next_step_at)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                        {activeEnrollments.length > 10 && (
                          <p className="text-xs text-muted-foreground text-center">
                            +{activeEnrollments.length - 10} more enrolled
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Recently Completed */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-blue-900 uppercase">
                      Recently Completed ({completedEnrollments.length})
                    </h3>
                    {completedEnrollments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No completions yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {completedEnrollments.slice(0, 5).map((enrollment) => {
                          const deal = enrollment.deal
                          const contact = deal?.contact
                          const name = contact
                            ? `${contact.first_name} ${contact.last_name}`
                            : deal?.title || 'Unknown'

                          return (
                            <div
                              key={enrollment.id}
                              className="flex items-center gap-3 p-2 rounded-lg bg-gray-50"
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="bg-green-100 text-green-600 text-xs">
                                  {getInitials(name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{name}</p>
                              </div>
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                Completed
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}