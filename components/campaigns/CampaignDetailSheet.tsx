'use client'

import { useState, useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Mail,
  MessageSquare,
  Send,
  Eye,
  Users,
  Calendar,
  Clock,
  Copy,
  Pencil,
  Trash2,
  XCircle,
  Loader2,
  GitBranch,
} from 'lucide-react'
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import {
  useCampaign,
  useCampaignRecipients,
  useDeleteCampaign,
  useDuplicateCampaign,
  useCancelCampaign,
  useSendCampaign,
  useResendCampaign,
  useCalculateRecipients,
} from '@/lib/hooks/useCampaigns'
import { useCampaignDetailRealtime } from '@/lib/hooks/useCampaignRealtime'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/lib/hooks/use-toast'
import { TemplatePreviewModal } from '@/components/templates/TemplatePreviewModal'
import type { Campaign } from '@/lib/types/campaigns'
import type { Template } from '@/lib/types/templates'

interface CampaignDetailSheetProps {
  campaignId: string | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (campaign: Campaign) => void
}

const statusConfig: Record<Campaign['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  sending: { label: 'Sending', className: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' },
  sent: { label: 'Sent', className: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
  failed: { label: 'Failed', className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
}

export function CampaignDetailSheet({
  campaignId,
  isOpen,
  onClose,
  onEdit,
}: CampaignDetailSheetProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showResendDialog, setShowResendDialog] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [sendStatusFilter, setSendStatusFilter] = useState<string | null>(null)

  const { data: campaign, isLoading } = useCampaign(campaignId)
  const isSending = campaign?.status === 'sending'
  const { data: recipients = [], isLoading: recipientsLoading } = useCampaignRecipients(campaignId, isSending)
  const { data: recipientData } = useCalculateRecipients(
    campaign?.recipient_list_ids || [],
    campaign?.recipient_tag_ids || [],
    campaign?.recipient_stage_ids || []
  )

  // Live updates: subscribe to email_sends changes for this campaign
  useCampaignDetailRealtime(campaignId)

  // Calculate stats from recipients data for reliability
  const statsWithRates = useMemo(() => {
    if (recipients.length === 0) return null

    const stats = {
      total: recipients.length,
      sent: recipients.filter(r => ['sent', 'delivered', 'opened', 'clicked'].includes(r.status)).length,
      delivered: recipients.filter(r =>
        ['sent', 'delivered', 'opened', 'clicked'].includes(r.status)
      ).length,
      opened: recipients.filter(r => !!r.opened_at || r.status === 'opened' || r.status === 'clicked').length,
      clicked: recipients.filter(r => !!r.clicked_at || r.status === 'clicked').length,
      bounced: recipients.filter(r => r.status === 'bounced').length,
      unsubscribed: recipients.filter(r => r.status === 'complained').length,
      failed: recipients.filter(r => r.status === 'failed').length,
      uniqueRecipients: new Set(recipients.map(r => r.recipient_contact_id).filter(Boolean)).size,
    }

    return {
      ...stats,
      deliveredRate: stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0,
      openRate: stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0,
      clickRate: stats.delivered > 0 ? (stats.clicked / stats.delivered) * 100 : 0,
      bounceRate: stats.total > 0 ? (stats.bounced / stats.total) * 100 : 0,
      unsubscribeRate: stats.total > 0 ? (stats.unsubscribed / stats.total) * 100 : 0,
    }
  }, [recipients])

  const filteredRecipients = useMemo(() => {
    if (!sendStatusFilter) return recipients
    switch (sendStatusFilter) {
      case 'delivered':
        return recipients.filter(r =>
          ['sent', 'delivered', 'opened', 'clicked'].includes(r.status)
        )
      case 'opened':
        return recipients.filter(r => !!r.opened_at || r.status === 'opened' || r.status === 'clicked')
      case 'clicked':
        return recipients.filter(r => !!r.clicked_at || r.status === 'clicked')
      case 'bounced':
        return recipients.filter(r => r.status === 'bounced')
      case 'failed':
        return recipients.filter(r => r.status === 'failed')
      default:
        return recipients
    }
  }, [recipients, sendStatusFilter])

  const deleteCampaign = useDeleteCampaign()
  const duplicateCampaign = useDuplicateCampaign()
  const cancelCampaign = useCancelCampaign()
  const sendCampaign = useSendCampaign()
  const resendCampaign = useResendCampaign()

  const handleDelete = async () => {
    if (!campaignId) return
    try {
      await deleteCampaign.mutateAsync(campaignId)
      toast({
        title: 'Campaign deleted',
        description: 'The campaign has been permanently deleted.',
      })
      setShowDeleteDialog(false)
      onClose()
    } catch (error) {
      toast({
        title: 'Failed to delete',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleDuplicate = async () => {
    if (!campaignId) return
    try {
      await duplicateCampaign.mutateAsync(campaignId)
      toast({
        title: 'Campaign duplicated',
        description: 'A copy of the campaign has been created as a draft.',
      })
    } catch (error) {
      toast({
        title: 'Failed to duplicate',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleCancel = async () => {
    if (!campaignId) return
    try {
      await cancelCampaign.mutateAsync(campaignId)
      toast({
        title: 'Campaign cancelled',
        description: 'The scheduled campaign has been cancelled.',
      })
      setShowCancelDialog(false)
    } catch (error) {
      toast({
        title: 'Failed to cancel',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleSend = async () => {
    if (!campaignId) return
    try {
      await sendCampaign.mutateAsync(campaignId)
      toast({
        title: 'Campaign sending',
        description: `Campaign is now being sent to ${formatNumber(recipientData?.count || 0)} recipients.`,
      })
      setShowSendDialog(false)
    } catch (error) {
      toast({
        title: 'Failed to send',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleResend = async () => {
    if (!campaignId) return
    try {
      await resendCampaign.mutateAsync(campaignId)
      toast({
        title: 'Campaign resending',
        description: `Campaign is being resent to all recipients.`,
      })
      setShowResendDialog(false)
    } catch (error) {
      toast({
        title: 'Failed to resend',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  if (!campaignId) return null

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-start justify-between pr-8">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white truncate">
                    {isLoading ? <Skeleton className="h-7 w-48" /> : campaign?.name}
                  </SheetTitle>
                  {campaign && (
                    <Badge className={cn('font-normal shrink-0', statusConfig[campaign.status].className)}>
                      {statusConfig[campaign.status].label}
                    </Badge>
                  )}
                </div>
                <SheetDescription>
                  Campaign details and performance metrics
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {isLoading ? (
            <div className="flex-1 p-6 space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : campaign ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="px-6 pt-4 pb-4 border-b bg-slate-50 dark:bg-slate-800 shrink-0">
                <TabsList className="grid w-full grid-cols-2 h-10">
                  <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
                  <TabsTrigger value="emails" className="text-sm">
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    Emails {recipients.length > 0 && `(${recipients.length})`}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto">
                <TabsContent value="overview" className="mt-0 px-6 py-4 space-y-5 data-[state=inactive]:hidden">
                  {/* Campaign metadata */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div className="flex items-center gap-2">
                      {campaign.type === 'email' ? (
                        <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      )}
                      <span className="capitalize text-sm font-medium">{campaign.type}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-medium">{formatDate(campaign.created_at)}</span>
                    </div>
                    {campaign.scheduled_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Scheduled</span>
                        <span className="font-medium">{formatDate(campaign.scheduled_at)}</span>
                      </div>
                    )}
                    {campaign.sent_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <Send className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        <span className="text-muted-foreground">Sent</span>
                        <span className="font-medium">{formatDate(campaign.sent_at)}</span>
                      </div>
                    )}
                  </div>

                  {/* Pipeline */}
                  {campaign.pipeline && (
                    <div className="flex items-center gap-2 p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                      <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-300 truncate">
                          {campaign.pipeline.name}
                          {campaign.pipeline.programme && (
                            <span className="font-normal text-purple-600 dark:text-purple-400"> — {campaign.pipeline.programme.name}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Content — what actually goes out. The subject shown is
                      the template's, because process-campaigns uses
                      `template.subject || campaign.subject`; showing the
                      campaign's own subject here implied an override that
                      never applied. */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                      Content
                    </h3>

                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-muted-foreground uppercase shrink-0 w-14">Subject</span>
                      <p className="font-medium text-sm">
                        {campaign.template?.subject || campaign.subject || (
                          <span className="text-muted-foreground font-normal">Not set</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-muted-foreground uppercase shrink-0 w-14">From</span>
                      <p className="text-sm">
                        {campaign.from_name || campaign.from_user?.full_name || 'IFG Team'}
                      </p>
                    </div>

                    {campaign.template ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-3 border rounded-lg bg-blue-50 dark:bg-blue-950">
                          <Mail className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
                            {campaign.template.name}
                          </span>
                          <Badge variant="outline" className="text-xs ml-auto shrink-0">Template</Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setShowEmailPreview(true)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview email
                        </Button>
                      </div>
                    ) : campaign.body_html || campaign.body_text ? (
                      <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-800 max-h-40 overflow-y-auto">
                        <p className="whitespace-pre-wrap text-sm">
                          {campaign.body_text || 'Inline HTML content'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No template selected — this campaign has nothing to send.
                      </p>
                    )}
                  </div>

                  {/* Audience — lists, tags and pipeline stages */}
                  {(campaign.recipient_lists?.length ||
                    campaign.recipient_tags?.length ||
                    campaign.recipient_stages?.length) ? (
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase">
                          Audience
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {formatNumber(recipientData?.count || 0)} contacts
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {campaign.recipient_lists?.map((list) => (
                          <div
                            key={list.id}
                            className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="text-sm font-medium truncate">{list.name}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">List</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatNumber(list.contact_count || 0)}
                            </span>
                          </div>
                        ))}
                        {campaign.recipient_tags?.map((tag) => (
                          <div
                            key={tag.id}
                            className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: tag.color || '#94a3b8' }}
                              />
                              <span className="text-sm font-medium truncate">{tag.name}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">Tag</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatNumber(tag.contact_count || 0)}
                            </span>
                          </div>
                        ))}
                        {campaign.recipient_stages?.map((stage) => (
                          <div
                            key={stage.id}
                            className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: stage.color || '#94a3b8' }}
                              />
                              <span className="text-sm font-medium truncate">
                                {stage.pipeline_name ? `${stage.pipeline_name} — ` : ''}
                                {stage.name}
                              </span>
                              <Badge variant="outline" className="text-[10px] shrink-0">Stage</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatNumber(stage.deal_count || 0)} deals
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Sending Progress */}
                  {campaign.status === 'sending' && (
                    <Card className="bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Loader2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
                          <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Campaign is sending...</span>
                        </div>
                        <Progress
                          value={campaign.total_recipients ? (campaign.processed_recipients || 0) / campaign.total_recipients * 100 : 0}
                          className="h-2 mb-2"
                        />
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-yellow-800 dark:text-yellow-200">
                            {formatNumber(campaign.processed_recipients || 0)} of {formatNumber(campaign.total_recipients || 0)} sent
                          </span>
                          <span className="text-yellow-600 dark:text-yellow-400">
                            {campaign.total_recipients ? Math.round((campaign.processed_recipients || 0) / campaign.total_recipients * 100) : 0}%
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Performance Stats — summary banner style */}
                  {(campaign.status === 'sent' || campaign.status === 'sending' || recipients.length > 0) && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                        Performance
                      </h3>
                      {recipientsLoading ? (
                        <Skeleton className="h-[72px]" />
                      ) : statsWithRates && statsWithRates.total > 0 ? (
                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-2 py-3">
                          <div className="grid grid-cols-3 text-center divide-x divide-slate-200 dark:divide-slate-700">
                            <div className="px-2">
                              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(statsWithRates.total)}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Sent</p>
                            </div>
                            <button onClick={() => { setSendStatusFilter('delivered'); setActiveTab('emails') }} className="px-2 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(statsWithRates.delivered)}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Delivered</p>
                            </button>
                            <button onClick={() => { setSendStatusFilter('bounced'); setActiveTab('emails') }} className="px-2 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(statsWithRates.bounced)}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Bounced</p>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No performance data available yet
                        </p>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="emails" className="mt-0 px-6 py-4 space-y-4 data-[state=inactive]:hidden">
                  {/* Filter pills */}
                  {recipients.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">Filter:</span>
                      {[
                        { key: null, label: 'All' },
                        { key: 'delivered', label: 'Delivered' },
                        { key: 'bounced', label: 'Bounced' },
                      ].map((f) => (
                        <button
                          key={f.key ?? 'all'}
                          onClick={() => setSendStatusFilter(f.key)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                            sendStatusFilter === f.key
                              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {recipientsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : filteredRecipients.length > 0 ? (
                    <>
                      <div className="text-xs text-muted-foreground">
                        {filteredRecipients.length} email{filteredRecipients.length !== 1 ? 's' : ''}
                        {sendStatusFilter ? ` (${sendStatusFilter})` : ''}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Sent At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRecipients.map((send) => {
                            const contact = Array.isArray(send.contact)
                              ? send.contact[0]
                              : send.contact
                            const contactName = contact
                              ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                              : ''
                            const contactEmail = send.recipient_email || contact?.email || ''

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
                                      {contactEmail}
                                    </p>
                                  </div>
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
                                      send.status === 'pending' && 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800'
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
                  ) : recipients.length > 0 && sendStatusFilter ? (
                    <div className="text-center py-12">
                      <Mail className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No emails with status &quot;{sendStatusFilter}&quot;
                      </p>
                    </div>
                  ) : campaign.status === 'sent' ? (
                    <p className="text-muted-foreground text-center py-8">
                      No send history available
                    </p>
                  ) : (
                    <div className="text-center py-8">
                      <Mail className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Send history will appear here after the campaign is sent
                      </p>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          ) : null}

          {/* Footer Actions */}
          {campaign && (
            <SheetFooter className="border-t px-6 py-4 bg-slate-50 dark:bg-slate-900 shrink-0">
              <div className="flex items-center justify-between w-full gap-3">
                {/* Primary Actions */}
                <div className="flex items-center gap-2">
                  {(campaign.status === 'draft' || campaign.status === 'scheduled') && campaign.type === 'email' && (
                    <Button
                      onClick={() => setShowSendDialog(true)}
                      disabled={!campaign.recipient_list_ids?.length}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Now
                    </Button>
                  )}
                  {campaign.status === 'sent' && campaign.type === 'email' && (
                    <Button
                      onClick={() => setShowResendDialog(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Again
                    </Button>
                  )}
                  {(campaign.status === 'draft' || campaign.status === 'scheduled') && onEdit && (
                    <Button
                      variant="outline"
                      onClick={() => onEdit(campaign)}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleDuplicate}
                    disabled={duplicateCampaign.isPending}
                  >
                    {duplicateCampaign.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    Duplicate
                  </Button>
                </div>

                {/* Destructive Actions */}
                <div className="flex items-center gap-2">
                  {campaign.status === 'scheduled' && (
                    <Button
                      variant="outline"
                      onClick={() => setShowCancelDialog(true)}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-950"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteCampaign.isPending}
            >
              {deleteCampaign.isPending ? (
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

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Scheduled Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this scheduled campaign? It will not be sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Scheduled</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={cancelCampaign.isPending}
            >
              {cancelCampaign.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel Campaign'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Campaign Now?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;re about to send &quot;{campaign?.name}&quot; to {formatNumber(recipientData?.count || 0)} recipients.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="rounded-lg border p-4 space-y-2 bg-slate-50 dark:bg-slate-800">
              {campaign?.subject && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subject</span>
                  <span className="font-medium truncate max-w-[200px]">{campaign.subject}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Recipients</span>
                <span className="font-medium">{formatNumber(recipientData?.count || 0)} contacts</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lists</span>
                <span className="font-medium">{campaign?.recipient_list_ids?.length || 0} selected</span>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSend}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={sendCampaign.isPending}
            >
              {sendCampaign.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Yes, Send Now'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resend Confirmation Dialog */}
      <AlertDialog open={showResendDialog} onOpenChange={setShowResendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will resend &quot;{campaign?.name}&quot; to all {formatNumber(campaign?.total_recipients || recipients.length)} recipients again.
              Recipients who already received the email will receive it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResend}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={resendCampaign.isPending}
            >
              {resendCampaign.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resending...
                </>
              ) : (
                'Yes, Resend'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Same preview component the Templates page uses, so "what will they
          get?" looks identical everywhere. */}
      <TemplatePreviewModal
        template={(campaign?.template as unknown as Template) ?? null}
        open={showEmailPreview}
        onOpenChange={setShowEmailPreview}
      />
    </>
  )
}
