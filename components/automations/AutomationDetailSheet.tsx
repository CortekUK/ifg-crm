'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Users, Send, Eye, Pencil, Clock, CheckCircle2, XCircle, UserPlus, MoreVertical, Pause, Play, X, MessageCircle, GitBranch, Ban, ArrowRight, Trash2, Loader2, MousePointer, Mail } from 'lucide-react'
import { useAutomation, useAutomationEnrollments, useToggleAutomation, useUnenrollFromAutomation, usePauseEnrollment, useResumeEnrollment, useDeleteAutomation } from '@/lib/hooks/useAutomations'
import { useAutomationEmailStats, useAutomationEmailSends } from '@/lib/hooks/useAutomationEmailStats'
import { useAutomationReplies, useAutomationExited } from '@/lib/hooks/useAutomationOutcomes'
import { FormWebhookUrlBlock } from './FormWebhookUrlBlock'
import { useEmailSendsRealtime } from '@/lib/hooks/useCampaignRealtime'
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
  const router = useRouter()
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false)
  const [enrollmentToUnenroll, setEnrollmentToUnenroll] = useState<{ id: string; name: string } | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [emailStatusFilter, setEmailStatusFilter] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [showAllActive, setShowAllActive] = useState(false)

  const { data: automation, isLoading } = useAutomation(automationId)
  const { data: enrollments = [] } = useAutomationEnrollments(automationId)
  // For deal_creation automations, follow the deal-id chain so the
  // Emails / Replies / Exited tabs surface activity driven by the
  // initial_contact automation that runs on the same deals — otherwise
  // those tabs are empty (deal_creation has no email steps of its own).
  const followDealChain = automation?.automation_type === 'deal_creation'
  const { data: emailStats } = useAutomationEmailStats(automationId, { followDealChain })
  const { data: emailSends = [], isLoading: sendsLoading } = useAutomationEmailSends(
    automationId,
    emailStatusFilter,
    { followDealChain },
  )
  const { data: automationReplies = [], isLoading: repliesLoading } = useAutomationReplies(
    automationId,
    { followDealChain },
  )
  // For deal_creation, trigger_stage_id is null (form-submission triggers
  // aren't tied to a stage). Fall back to config.initial_stage_id, the
  // stage where the newly-created deal lands. Anything past that counts
  // as "exited the funnel".
  const exitAnchorStageId =
    automation?.trigger_stage_id ??
    ((automation?.config as { initial_stage_id?: string | null } | null)?.initial_stage_id ?? null)
  const { data: exitedDeals = [], isLoading: exitedLoading } = useAutomationExited(
    automationId,
    exitAnchorStageId,
    automation?.pipeline_id ?? null,
  )
  const toggleAutomation = useToggleAutomation()

  // Live updates: subscribe to email_sends changes for automation stats
  useEmailSendsRealtime()
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

  // Helper to get current step info for an enrollment
  const getCurrentStepInfo = (currentStepId: string | null) => {
    if (!currentStepId || !automation?.steps) return null
    const step = automation.steps.find(s => s.id === currentStepId)
    if (!step) return null

    // Find the step position among all steps
    const sortedSteps = [...automation.steps].sort((a, b) => a.step_order - b.step_order)
    const stepIndex = sortedSteps.findIndex(s => s.id === currentStepId)

    // Count email steps for labeling
    const emailSteps = sortedSteps.filter(s => s.step_type === 'send_email')
    const emailIndex = emailSteps.findIndex(s => s.id === currentStepId)

    if (step.step_type === 'send_email') {
      return {
        label: `Email ${emailIndex + 1}`,
        description: step.template?.name || 'Email step'
      }
    } else if (step.step_type === 'wait') {
      return {
        label: `Wait step`,
        description: step.delay_days ? `${step.delay_days}d delay` : `${step.delay_hours}h delay`
      }
    } else if (step.step_type === 'move_to_stage') {
      return {
        label: 'Move stage',
        description: 'Moving to next stage'
      }
    }
    return {
      label: `Step ${stepIndex + 1}`,
      description: step.step_type.replace(/_/g, ' ')
    }
  }

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

  // Calculate totals from real email_sends data. Open / click figures are
  // intentionally not surfaced — pixel-based open tracking and link rewriting
  // aren't reliable through the SES backend, so the numbers were misleading
  // (often 0% even on engaged sequences). We focus on what we can prove:
  // delivered, failed, bounced.
  const totalSent = emailStats?.totalSent || 0
  const totalDelivered = emailStats?.totalDelivered || 0
  const totalFailed = emailStats?.totalFailed || 0
  const totalBounced = emailStats?.totalBounced || 0

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
              <div className="flex items-start justify-between gap-4 pr-10">
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
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="px-6 pt-4 pb-4 border-b bg-slate-50 dark:bg-slate-800 shrink-0">
                {automation.trigger_type === 'form_submission' ? (
                  // Deal Creation + Initial Contact gets a fuller tab strip
                  // — Emails / Replies / Exited surface the contact-side of
                  // the funnel that the original "Deals Created" view
                  // didn't expose. Compact text so 5 tabs fit comfortably.
                  <TabsList className="grid w-full grid-cols-5 h-10">
                    <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                    <TabsTrigger value="enrolled" className="text-xs">
                      Deals ({completedEnrollments.length})
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="text-xs">
                      <Mail className="h-3 w-3 mr-1" />
                      Emails
                    </TabsTrigger>
                    <TabsTrigger value="replies" className="text-xs">
                      Replies ({automationReplies.length})
                    </TabsTrigger>
                    <TabsTrigger value="exited" className="text-xs">
                      Exited ({exitedDeals.length})
                    </TabsTrigger>
                  </TabsList>
                ) : (
                  <TabsList className="grid w-full grid-cols-3 h-10">
                    <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
                    <TabsTrigger value="activity" className="text-sm">
                      <Mail className="h-3.5 w-3.5 mr-1" />
                      Emails
                    </TabsTrigger>
                    <TabsTrigger value="enrolled" className="text-sm">
                      Enrolled ({activeEnrollments.length})
                    </TabsTrigger>
                  </TabsList>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                <TabsContent value="overview" className="mt-0 px-6 py-5 space-y-5 data-[state=inactive]:hidden">
                  {/* Workflow Preview */}
                  <AutomationWorkflowPreview
                    automation={automation}
                    showStats={true}
                  />

                  {/* Performance Stats */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                      {automation.trigger_type === 'form_submission' ? 'Summary' : 'Performance'}
                    </h3>

                    {automation.trigger_type === 'form_submission' ? (
                      /* Deal Creation automation — simple summary */
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-3">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/50">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{completedEnrollments.length}</p>
                            <p className="text-[11px] text-muted-foreground">Deals Created</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-3">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50">
                            <GitBranch className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">{automation.pipeline?.name || '—'}</p>
                            <p className="text-[11px] text-muted-foreground">Pipeline</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Email sequence automation — full stats */
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50">
                              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{activeEnrollments.length}</p>
                              <p className="text-[11px] text-muted-foreground">Enrolled</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/50">
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{completedEnrollments.length}</p>
                              <p className="text-[11px] text-muted-foreground">Completed</p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2 py-3">
                          <div className="grid grid-cols-4 text-center divide-x divide-slate-200 dark:divide-slate-700">
                            <div className="px-2">
                              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalSent}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Sent</p>
                            </div>
                            <button onClick={() => { setEmailStatusFilter('delivered'); setActiveTab('activity') }} className="px-2 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalDelivered}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Delivered</p>
                            </button>
                            <button onClick={() => { setEmailStatusFilter('failed'); setActiveTab('activity') }} className="px-2 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalFailed}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Failed</p>
                            </button>
                            <button onClick={() => { setEmailStatusFilter('bounced'); setActiveTab('activity') }} className="px-2 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalBounced}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Bounced</p>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Webhook URL — only meaningful for form-triggered
                      automations (deal_creation / list_assignment). Lives
                      on the read-only Overview so a recruiter can recover
                      the URL after deleting and recreating an automation
                      without having to dig through AC's webhook history. */}
                  {automation.trigger_type === 'form_submission' && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                        Webhook URL
                      </h3>
                      <FormWebhookUrlBlock
                        formId={(automation.config as { form_id?: string } | null)?.form_id}
                        formSource={
                          (automation.config as { form_source?:
                            | 'activecampaign'
                            | 'gravity_forms'
                            | 'wpforms'
                            | 'contact_form_7'
                            | 'elementor_forms'
                            | 'generic'
                            | null
                          } | null)?.form_source
                        }
                      />
                    </div>
                  )}

                  {/* Per-Step Stats */}
                  {automation.steps && automation.steps.filter((s) => s.step_type === 'send_email').length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                        Step Performance
                      </h3>
                      <div className="space-y-2">
                        {automation.steps
                          .filter((s) => s.step_type === 'send_email')
                          .sort((a, b) => a.step_order - b.step_order)
                          .map((step, index) => {
                            const stepStats = emailStats?.byStep[step.id]
                            return (
                              <div key={step.id} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    Email {index + 1}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {step.template?.name || 'No template'}
                                  </p>
                                </div>
                                <div className="grid grid-cols-4 text-center divide-x divide-slate-100 dark:divide-slate-800 px-1 py-2">
                                  <div className="px-1">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{stepStats?.sent || 0}</p>
                                    <p className="text-[10px] text-muted-foreground">Sent</p>
                                  </div>
                                  <div className="px-1">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{stepStats?.delivered || 0}</p>
                                    <p className="text-[10px] text-muted-foreground">Delivered</p>
                                  </div>
                                  <div className="px-1">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{stepStats?.failed || 0}</p>
                                    <p className="text-[10px] text-muted-foreground">Failed</p>
                                  </div>
                                  <div className="px-1">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{stepStats?.bounced || 0}</p>
                                    <p className="text-[10px] text-muted-foreground">Bounced</p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="activity" className="mt-0 px-6 py-4 space-y-4 data-[state=inactive]:hidden">
                  {/* Filter pills */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Filter:</span>
                    {[
                      { key: null, label: 'All' },
                      { key: 'delivered', label: 'Delivered' },
                      { key: 'failed', label: 'Failed' },
                      { key: 'bounced', label: 'Bounced' },
                    ].map((f) => (
                      <button
                        key={f.key ?? 'all'}
                        onClick={() => setEmailStatusFilter(f.key)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                          emailStatusFilter === f.key
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {sendsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : emailSends.length > 0 ? (
                    <>
                      <div className="text-xs text-muted-foreground">
                        {emailSends.length} email{emailSends.length !== 1 ? 's' : ''}
                        {emailStatusFilter ? ` (${emailStatusFilter})` : ''}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Step</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Sent At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {emailSends.map((send) => {
                            const contactName = send.contact
                              ? `${send.contact.first_name || ''} ${send.contact.last_name || ''}`.trim()
                              : ''

                            // Find step label
                            const sortedEmailSteps = automation?.steps
                              ?.filter((s) => s.step_type === 'send_email')
                              .sort((a, b) => a.step_order - b.step_order) || []
                            const stepIndex = sortedEmailSteps.findIndex((s) => s.id === send.step_id)
                            const step = sortedEmailSteps[stepIndex]
                            const stepLabel = stepIndex >= 0
                              ? `Email ${stepIndex + 1}`
                              : '-'

                            return (
                              <TableRow key={send.id}>
                                <TableCell>
                                  <div>
                                    {contactName && (
                                      <p className="font-medium text-sm">{contactName}</p>
                                    )}
                                    <p className={cn(
                                      'text-xs',
                                      contactName ? 'text-muted-foreground' : 'font-medium text-sm'
                                    )}>
                                      {send.recipient_email}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {stepLabel}
                                  </Badge>
                                  {step?.template?.name && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[100px]" title={step.template.name}>
                                      {step.template.name}
                                    </p>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-xs',
                                      (send.status === 'sent' || send.status === 'delivered') && 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
                                      send.status === 'opened' && 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                                      send.status === 'clicked' && 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
                                      send.status === 'bounced' && 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
                                      send.status === 'failed' && 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
                                    )}
                                  >
                                    {send.status === 'sent' ? 'Delivered' : send.status.charAt(0).toUpperCase() + send.status.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {send.sent_at ? (
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {formatDateTime(send.sent_at)}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <Mail className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        {emailStatusFilter
                          ? `No emails with status "${emailStatusFilter}"`
                          : 'No emails sent yet'}
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="enrolled" className="mt-0 px-6 py-6 space-y-6 data-[state=inactive]:hidden">
                  {/* Active Enrollments */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase">
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
                        <Users className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
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
                        {(showAllActive ? activeEnrollments : activeEnrollments.slice(0, 10)).map((enrollment) => {
                          const deal = enrollment.deal
                          const contact = deal?.contact
                          const name = contact
                            ? `${contact.first_name} ${contact.last_name}`
                            : deal?.title || 'Unknown'
                          const stepInfo = getCurrentStepInfo(enrollment.current_step_id)

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
                                      {stepInfo ? (
                                        <Badge variant="outline" className="text-xs mb-1">
                                          <GitBranch className="h-2.5 w-2.5 mr-1" />
                                          {stepInfo.label}
                                        </Badge>
                                      ) : (
                                        <Badge className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 hover:bg-green-100">
                                          Active
                                        </Badge>
                                      )}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs text-muted-foreground"
                            onClick={() => setShowAllActive((s) => !s)}
                          >
                            {showAllActive
                              ? 'Show less'
                              : `Show all ${activeEnrollments.length}`}
                          </Button>
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
                            <Card key={enrollment.id} className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
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
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
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
                              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
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
                          const isReplyExit = stoppedBadge.label === 'Replied' && contact?.id

                          return (
                            <div
                              key={enrollment.id}
                              role={isReplyExit ? 'button' : undefined}
                              tabIndex={isReplyExit ? 0 : undefined}
                              onClick={isReplyExit ? () => router.push(`/replies?contactId=${contact!.id}`) : undefined}
                              onKeyDown={isReplyExit ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  router.push(`/replies?contactId=${contact!.id}`)
                                }
                              } : undefined}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 transition-colors',
                                isReplyExit && 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-800'
                              )}
                              title={isReplyExit ? 'View their reply' : undefined}
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

                {/* Replies — incoming responses to any email this
                    automation sent. Helpful on Deal Creation + Initial
                    Contact where the recruiter wants to see who actually
                    wrote back. Intent badge is colour-coded so the row
                    reads at a glance. */}
                <TabsContent
                  value="replies"
                  className="mt-0 px-6 py-4 space-y-3 data-[state=inactive]:hidden"
                >
                  {repliesLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : automationReplies.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageCircle className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No replies received yet.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Contact</TableHead>
                          <TableHead>Intent</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Received</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {automationReplies.map((r) => {
                          const name = r.contact
                            ? `${r.contact.first_name ?? ''} ${r.contact.last_name ?? ''}`.trim()
                            : r.from_name || r.from_email
                          const intent = r.ai_intent || 'unclassified'
                          // Click → /replies?contactId=<id> deep link. The
                          // replies page already auto-opens the most
                          // recent matched reply for that contact when the
                          // query param is present, so a row click lands
                          // the user directly on the message body.
                          const onRowClick = () => {
                            if (r.contact?.id) {
                              router.push(`/replies?contactId=${r.contact.id}`)
                            } else {
                              router.push('/replies')
                            }
                          }
                          return (
                            <TableRow
                              key={r.id}
                              onClick={onRowClick}
                              className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            >
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{name || '—'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {r.contact?.email || r.from_email}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-xs capitalize',
                                    intent === 'positive' &&
                                      'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
                                    intent === 'negative' &&
                                      'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
                                    intent === 'question' &&
                                      'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                                    intent === 'unsubscribe' &&
                                      'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                                  )}
                                >
                                  {intent}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm truncate max-w-[180px]" title={r.subject ?? ''}>
                                  {r.subject || '(no subject)'}
                                </p>
                                {r.body_preview && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                    {r.body_preview}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDateTime(r.received_at)}
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {/* Exited — deals that have moved past the automation's
                    initial stage (or closed won / lost). The recruiter
                    uses this to confirm the automation is actually
                    pulling people forward through the pipeline. */}
                <TabsContent
                  value="exited"
                  className="mt-0 px-6 py-4 space-y-3 data-[state=inactive]:hidden"
                >
                  {exitedLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : exitedDeals.length === 0 ? (
                    <div className="text-center py-12">
                      <ArrowRight className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No deals have moved past {automation.trigger_stage?.name || 'the initial stage'} yet.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Contact</TableHead>
                          <TableHead>Now in</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Exited</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exitedDeals.map((d) => {
                          const name = d.contact
                            ? `${d.contact.first_name ?? ''} ${d.contact.last_name ?? ''}`.trim() ||
                              d.contact.email ||
                              '—'
                            : '—'
                          return (
                            <TableRow key={d.enrollment_id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{name}</p>
                                  {d.contact?.email && (
                                    <p className="text-xs text-muted-foreground">{d.contact.email}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {d.current_stage?.name || '—'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-xs capitalize',
                                    d.status === 'won' &&
                                      'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
                                    d.status === 'lost' &&
                                      'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
                                  )}
                                >
                                  {d.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {d.exited_at ? (
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDateTime(d.exited_at)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
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
