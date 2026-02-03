'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Send, Eye, Pencil, Clock, CheckCircle2, XCircle, UserPlus, MoreVertical, Pause, Play, X, MessageCircle, GitBranch, Ban, ArrowRight, Trash2, Loader2 } from 'lucide-react'
import { useAutomation, useAutomationEnrollments, useToggleAutomation, useUnenrollFromAutomation, usePauseEnrollment, useResumeEnrollment, useDeleteAutomation } from '@/lib/hooks/useAutomations'
import { AutomationWorkflowPreview } from './AutomationWorkflowPreview'
import { EnrollContactModal } from './EnrollContactModal'
import { formatDateTime } from '@/lib/utils/format'
import { toast } from '@/lib/hooks/use-toast'

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
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false)
  const [enrollmentToUnenroll, setEnrollmentToUnenroll] = useState<{ id: string; name: string } | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const { data: automation, isLoading } = useAutomation(automationId)
  const { data: enrollments = [] } = useAutomationEnrollments(automationId)
  const toggleAutomation = useToggleAutomation()
  const unenroll = useUnenrollFromAutomation()
  const pauseEnrollment = usePauseEnrollment()
  const resumeEnrollment = useResumeEnrollment()
  const deleteAutomation = useDeleteAutomation()

  const handleToggle = async (isActive: boolean) => {
    if (!automationId) return
    await toggleAutomation.mutateAsync({ automationId, isActive })
  }


  const handleDelete = async () => {
    if (!automationId || !automation) return

    try {
      await deleteAutomation.mutateAsync(automationId)
      toast({
        title: 'Automation deleted',
        description: `"${automation.name}" has been deleted.`,
      })
      setShowDeleteDialog(false)
      onClose()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete automation.',
        variant: 'destructive',
      })
    }
  }
  const handleUnenroll = async () => {
    if (!enrollmentToUnenroll || !automationId) return

    try {
      await unenroll.mutateAsync({
        enrollmentId: enrollmentToUnenroll.id,
        automationId,
      })
      toast({
        title: 'Contact unenrolled',
        description: `${enrollmentToUnenroll.name} has been removed from this automation.`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to unenroll contact.',
        variant: 'destructive',
      })
    }
    setEnrollmentToUnenroll(null)
  }

  const handlePauseResume = async (enrollmentId: string, currentStatus: string) => {
    if (!automationId) return

    try {
      if (currentStatus === 'active') {
        await pauseEnrollment.mutateAsync({ enrollmentId, automationId })
        toast({ title: 'Enrollment paused' })
      } else if (currentStatus === 'paused') {
        await resumeEnrollment.mutateAsync({ enrollmentId, automationId })
        toast({ title: 'Enrollment resumed' })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update enrollment.',
        variant: 'destructive',
      })
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
  const pausedEnrollments = enrollments.filter((e) => e.status === 'paused')
  const completedEnrollments = enrollments.filter((e) => e.status === 'completed')
  const stoppedEnrollments = enrollments.filter((e) => e.status === 'stopped')

  // Helper to get badge for stopped reason
  const getStoppedReasonBadge = (reason: string | null) => {
    if (!reason) {
      return {
        label: 'Stopped',
        className: 'bg-gray-100 dark:bg-gray-800 text-gray-600',
        icon: <Ban className="h-2.5 w-2.5 mr-0.5" />,
      }
    }

    const reasonLower = reason.toLowerCase()
    
    if (reasonLower.includes('replied') || reasonLower.includes('reply')) {
      return {
        label: 'Replied',
        className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700',
        icon: <MessageCircle className="h-2.5 w-2.5 mr-0.5" />,
      }
    }
    
    if (reasonLower.includes('stage') || reasonLower.includes('exit')) {
      return {
        label: 'Stage Exit',
        className: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700',
        icon: <ArrowRight className="h-2.5 w-2.5 mr-0.5" />,
      }
    }
    
    if (reasonLower.includes('manual')) {
      return {
        label: 'Unenrolled',
        className: 'bg-red-100 dark:bg-red-900/50 text-red-700',
        icon: <X className="h-2.5 w-2.5 mr-0.5" />,
      }
    }

    return {
      label: 'Stopped',
      className: 'bg-gray-100 dark:bg-gray-800 text-gray-600',
      icon: <Ban className="h-2.5 w-2.5 mr-0.5" />,
    }
  }

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
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        {isLoading || !automation ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-10 w-full" />
            <div className="space-y-3 pt-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
                    {automation.name}
                  </SheetTitle>
                  <SheetDescription className="mt-1 line-clamp-2">
                    {automation.description || 'No description provided'}
                  </SheetDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEnrollModalOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Enroll
                  </Button>
                  {onEdit && (
                    <Button variant="outline" size="sm" onClick={onEdit}>
                      <Pencil className="h-4 w-4 mr-1.5" />
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <Badge
                  className={
                    automation.is_active
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-700 hover:bg-green-100'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-gray-100'
                  }
                >
                  {automation.is_active ? 'Active' : 'Paused'}
                </Badge>
                {automation.pipeline && (
                  <Badge variant="outline">{automation.pipeline.name}</Badge>
                )}
              </div>
            </SheetHeader>

            <Tabs defaultValue="workflow" className="flex-1 flex flex-col min-h-0">
              <div className="px-6 pt-4 pb-4 border-b bg-slate-50 dark:bg-slate-800 shrink-0">
                <TabsList className="grid w-full grid-cols-3 h-10">
                  <TabsTrigger value="workflow" className="text-sm">Workflow</TabsTrigger>
                  <TabsTrigger value="stats" className="text-sm">Stats</TabsTrigger>
                  <TabsTrigger value="enrolled" className="text-sm">
                    Enrolled ({activeEnrollments.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto">
                <TabsContent value="workflow" className="mt-0 px-6 py-6 data-[state=inactive]:hidden">
                  <AutomationWorkflowPreview
                    automation={automation}
                    showStats={true}
                  />
                </TabsContent>

                <TabsContent value="stats" className="mt-0 px-6 py-6 space-y-6 data-[state=inactive]:hidden">
                  {/* Quick Stats */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                      Overview
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <Card className="border-slate-200 dark:border-slate-700">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                            <Users className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeEnrollments.length}</p>
                            <p className="text-xs text-muted-foreground">Currently Enrolled</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-slate-200 dark:border-slate-700">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="p-2.5 bg-amber-100 rounded-lg">
                            <Clock className="h-4 w-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalInQueue}</p>
                            <p className="text-xs text-muted-foreground">In Queue</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-slate-200 dark:border-slate-700">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="p-2.5 bg-green-100 rounded-lg">
                            <Send className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalSent}</p>
                            <p className="text-xs text-muted-foreground">Total Sent</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-slate-200 dark:border-slate-700">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="p-2.5 bg-purple-100 rounded-lg">
                            <Eye className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgOpenRate.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">Avg. Open Rate</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-slate-200 dark:border-slate-700">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="p-2.5 bg-green-100 rounded-lg">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedEnrollments.length}</p>
                            <p className="text-xs text-muted-foreground">Completed</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-slate-200 dark:border-slate-700">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="p-2.5 bg-red-100 rounded-lg">
                            <XCircle className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stoppedEnrollments.length}</p>
                            <p className="text-xs text-muted-foreground">Stopped / Exited</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Per-Step Stats */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                      Step Performance
                    </h3>
                    {automation.steps
                      ?.filter((s) => s.step_type === 'send_email')
                      .sort((a, b) => a.step_order - b.step_order)
                      .map((step, index) => (
                        <Card key={step.id} className="border-slate-200 dark:border-slate-700">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Email {index + 1}: {step.template?.name || 'No template'}
                              </p>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{step.stats?.sent || 0}</p>
                                <p className="text-xs text-muted-foreground">Sent</p>
                              </div>
                              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{step.stats?.opened || 0}</p>
                                <p className="text-xs text-muted-foreground">Opened</p>
                              </div>
                              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <p className="text-lg font-bold text-gray-900 dark:text-white">
                                  {step.stats?.open_rate?.toFixed(1) || 0}%
                                </p>
                                <p className="text-xs text-muted-foreground">Open Rate</p>
                              </div>
                              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <p className="text-lg font-bold text-gray-900 dark:text-white">
                                  {step.stats?.click_rate?.toFixed(1) || 0}%
                                </p>
                                <p className="text-xs text-muted-foreground">Click Rate</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    {(!automation.steps || automation.steps.filter((s) => s.step_type === 'send_email').length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No email steps in this automation
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="enrolled" className="mt-0 px-6 py-6 space-y-6 data-[state=inactive]:hidden">
                  {/* Active Enrollments */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <h3 className="text-sm font-semibold text-blue-900 uppercase">
                        Currently Active ({activeEnrollments.length})
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setIsEnrollModalOpen(true)}
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    {activeEnrollments.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          No contacts currently enrolled
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => setIsEnrollModalOpen(true)}
                        >
                          <UserPlus className="h-4 w-4 mr-1.5" />
                          Enroll Contacts
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeEnrollments.slice(0, 10).map((enrollment) => {
                          const deal = enrollment.deal
                          const contact = deal?.contact
                          const name = contact
                            ? `${contact.first_name} ${contact.last_name}`
                            : deal?.title || 'Unknown'

                          return (
                            <Card key={enrollment.id} className="border-slate-200 dark:border-slate-700">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9">
                                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-medium">
                                      {getInitials(name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {contact?.email || 'No email'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="text-right">
                                      <Badge className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 hover:bg-green-100">
                                        Active
                                      </Badge>
                                      {enrollment.next_step_at && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Next: {formatDateTime(enrollment.next_step_at)}
                                        </p>
                                      )}
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() => handlePauseResume(enrollment.id, 'active')}
                                        >
                                          <Pause className="h-4 w-4 mr-2" />
                                          Pause
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => setEnrollmentToUnenroll({ id: enrollment.id, name })}
                                          className="text-red-600"
                                        >
                                          <X className="h-4 w-4 mr-2" />
                                          Unenroll
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                        {activeEnrollments.length > 10 && (
                          <p className="text-xs text-muted-foreground text-center pt-2">
                            +{activeEnrollments.length - 10} more enrolled
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Paused Enrollments */}
                  {pausedEnrollments.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-amber-700 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                        Paused ({pausedEnrollments.length})
                      </h3>
                      <div className="space-y-2">
                        {pausedEnrollments.slice(0, 5).map((enrollment) => {
                          const deal = enrollment.deal
                          const contact = deal?.contact
                          const name = contact
                            ? `${contact.first_name} ${contact.last_name}`
                            : deal?.title || 'Unknown'

                          return (
                            <Card key={enrollment.id} className="border-amber-200 bg-amber-50/50">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9">
                                    <AvatarFallback className="bg-amber-100 dark:bg-amber-900/50 text-amber-600 text-xs font-medium">
                                      {getInitials(name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {contact?.email || 'No email'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 hover:bg-amber-100">
                                      Paused
                                    </Badge>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() => handlePauseResume(enrollment.id, 'paused')}
                                        >
                                          <Play className="h-4 w-4 mr-2" />
                                          Resume
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => setEnrollmentToUnenroll({ id: enrollment.id, name })}
                                          className="text-red-600"
                                        >
                                          <X className="h-4 w-4 mr-2" />
                                          Unenroll
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Recently Completed */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
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
                              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100"
                            >
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="bg-green-100 dark:bg-green-900/50 text-green-600 text-xs">
                                  {getInitials(name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 dark:text-white truncate">{name}</p>
                              </div>
                              <Badge className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 hover:bg-green-100">
                                Completed
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Stopped Enrollments */}
                  {stoppedEnrollments.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-red-700 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                        Stopped / Exited ({stoppedEnrollments.length})
                      </h3>
                      <div className="space-y-2">
                        {stoppedEnrollments.slice(0, 5).map((enrollment) => {
                          const deal = enrollment.deal
                          const contact = deal?.contact
                          const name = contact
                            ? `${contact.first_name} ${contact.last_name}`
                            : deal?.title || 'Unknown'
                          const stoppedBadge = getStoppedReasonBadge(enrollment.stopped_reason)

                          return (
                            <div
                              key={enrollment.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100"
                            >
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="bg-red-100 dark:bg-red-900/50 text-red-600 text-xs">
                                  {getInitials(name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 dark:text-white truncate">{name}</p>
                                {enrollment.stopped_reason && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {enrollment.stopped_reason}
                                  </p>
                                )}
                              </div>
                              <Badge className={`text-xs ${stoppedBadge.className} hover:${stoppedBadge.className}`}>
                                {stoppedBadge.icon}
                                {stoppedBadge.label}
                              </Badge>
                            </div>
                          )
                        })}
                        {stoppedEnrollments.length > 5 && (
                          <p className="text-xs text-muted-foreground text-center pt-2">
                            +{stoppedEnrollments.length - 5} more stopped
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>

            {/* Footer with toggle */}
            <div className="border-t px-6 py-4 bg-slate-50 dark:bg-slate-800 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Automation Status</p>
                  <p className="text-xs text-muted-foreground">
                    {automation.is_active ? 'Automation is running' : 'Automation is paused'}
                  </p>
                </div>
                <Switch
                  checked={automation.is_active}
                  onCheckedChange={handleToggle}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            </div>

            {/* Enroll Contact Modal */}
            <EnrollContactModal
              isOpen={isEnrollModalOpen}
              onClose={() => setIsEnrollModalOpen(false)}
              automation={automation}
            />

            {/* Unenroll Confirmation Dialog */}
            <AlertDialog open={!!enrollmentToUnenroll} onOpenChange={() => setEnrollmentToUnenroll(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unenroll from automation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove{' '}
                    <span className="font-medium">{enrollmentToUnenroll?.name}</span> from this
                    automation? They will no longer receive any scheduled emails.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleUnenroll}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Unenroll
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete automation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete{' '}
                    <span className="font-medium">"{automation?.name}"</span>?
                    This will remove the automation and all its steps. Enrolled contacts will be unenrolled.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={deleteAutomation.isPending}
                  >
                    {deleteAutomation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
