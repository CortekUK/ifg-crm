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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
  MousePointer,
  AlertTriangle,
  UserMinus,
  Users,
  Calendar,
  Clock,
  Copy,
  Pencil,
  Trash2,
  XCircle,
  Loader2,
  CheckCircle,
  GitBranch,
} from 'lucide-react'
import { formatDate, formatDateTime, formatDateLong, formatNumber } from '@/lib/utils/format'
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
import type { Campaign } from '@/lib/types/campaigns'

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

  const { data: campaign, isLoading } = useCampaign(campaignId)
  const isSending = campaign?.status === 'sending'
  const { data: recipients = [], isLoading: recipientsLoading } = useCampaignRecipients(campaignId, isSending)
  const { data: recipientData } = useCalculateRecipients(campaign?.recipient_list_ids || [])

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
            <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
              <div className="px-6 pt-4 shrink-0">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="recipients">
                    Sends {recipients.length > 0 && `(${recipients.length})`}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto">
                <TabsContent value="details" className="px-6 py-4 space-y-6 mt-0">
                  {/* Campaign Info */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                      Campaign Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">Type</p>
                        <div className="flex items-center gap-2">
                          {campaign.type === 'email' ? (
                            <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <MessageSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          )}
                          <span className="capitalize font-medium">{campaign.type}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">Created</p>
                        <p className="font-medium">{formatDate(campaign.created_at)}</p>
                      </div>
                      {campaign.scheduled_at && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Scheduled</p>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{formatDateLong(campaign.scheduled_at)}</span>
                          </div>
                        </div>
                      )}
                      {campaign.sent_at && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Sent</p>
                          <div className="flex items-center gap-2">
                            <Send className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="font-medium">{formatDateLong(campaign.sent_at)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pipeline Link */}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-1">Pipeline</p>
                      {campaign.pipeline ? (
                        <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                          <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          <div>
                            <p className="font-medium text-purple-700 dark:text-purple-300">
                              {campaign.pipeline.name}
                            </p>
                            {campaign.pipeline.programme && (
                              <p className="text-xs text-purple-600 dark:text-purple-400">
                                Programme: {campaign.pipeline.programme.name}
                              </p>
                            )}
                            <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-0.5">
                              Replies create deals via Smart Process
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Generic campaign</span>
                          <span className="text-xs text-muted-foreground">(contact matching only)</span>
                        </div>
                      )}
                    </div>

                    {campaign.type === 'email' && (
                      <>
                        {campaign.subject && (
                          <div>
                            <p className="text-xs text-muted-foreground uppercase mb-1">Subject</p>
                            <p className="font-medium">{campaign.subject}</p>
                          </div>
                        )}
                        {campaign.from_name && (
                          <div>
                            <p className="text-xs text-muted-foreground uppercase mb-1">From</p>
                            <p className="font-medium">
                              {campaign.from_name}
                              {campaign.from_email && ` <${campaign.from_email}>`}
                            </p>
                          </div>
                        )}
                        {campaign.reply_to && (
                          <div>
                            <p className="text-xs text-muted-foreground uppercase mb-1">Reply-To</p>
                            <p className="font-medium">{campaign.reply_to}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Recipient Lists */}
                  {campaign.recipient_lists && campaign.recipient_lists.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                        Recipient Lists
                      </h3>
                      <div className="space-y-2">
                        {campaign.recipient_lists.map((list) => (
                          <div
                            key={list.id}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{list.name}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {formatNumber(list.contact_count || 0)} contacts
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sending Progress */}
                  {campaign.status === 'sending' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                        Sending Progress
                      </h3>
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
                    </div>
                  )}

                  {/* Stats (for sent campaigns or campaigns with send history) */}
                  {(campaign.status === 'sent' || campaign.status === 'sending' || recipients.length > 0) && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                        Performance
                      </h3>
                      {recipientsLoading ? (
                        <div className="grid grid-cols-2 gap-4">
                          {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-20" />
                          ))}
                        </div>
                      ) : statsWithRates && statsWithRates.total > 0 ? (
                        <>
                          {/* Summary row */}
                          <Card className="bg-slate-50 dark:bg-slate-800/50">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-muted-foreground">Total Emails Sent</p>
                                  <p className="text-3xl font-bold">{formatNumber(statsWithRates.total)}</p>
                                </div>
                                {statsWithRates.uniqueRecipients > 0 && statsWithRates.uniqueRecipients !== statsWithRates.total && (
                                  <div className="text-right">
                                    <p className="text-sm text-muted-foreground">Unique Recipients</p>
                                    <p className="text-xl font-semibold">{formatNumber(statsWithRates.uniqueRecipients)}</p>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>

                          <div className="grid grid-cols-2 gap-4">
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                  <span className="text-sm text-muted-foreground">Delivered</span>
                                </div>
                                <p className="text-2xl font-bold">{formatNumber(statsWithRates.delivered)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {statsWithRates.deliveredRate.toFixed(1)}% delivery rate
                                </p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Eye className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  <span className="text-sm text-muted-foreground">Opened</span>
                                </div>
                                <p className="text-2xl font-bold">{formatNumber(statsWithRates.opened)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {statsWithRates.openRate.toFixed(1)}% open rate
                                </p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <MousePointer className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                  <span className="text-sm text-muted-foreground">Clicked</span>
                                </div>
                                <p className="text-2xl font-bold">{formatNumber(statsWithRates.clicked)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {statsWithRates.clickRate.toFixed(1)}% click rate
                                </p>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                  <span className="text-sm text-muted-foreground">Bounced</span>
                                </div>
                                <p className="text-2xl font-bold">{formatNumber(statsWithRates.bounced)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {statsWithRates.bounceRate.toFixed(1)}% bounce rate
                                </p>
                              </CardContent>
                            </Card>
                            {statsWithRates.unsubscribed > 0 && (
                              <Card>
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <UserMinus className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                    <span className="text-sm text-muted-foreground">Unsubscribed</span>
                                  </div>
                                  <p className="text-2xl font-bold">{formatNumber(statsWithRates.unsubscribed)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {statsWithRates.unsubscribeRate.toFixed(1)}% unsubscribe rate
                                  </p>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No performance data available yet
                        </p>
                      )}
                    </div>
                  )}

                </TabsContent>

                <TabsContent value="content" className="px-6 py-4 space-y-6 mt-0">
                  <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                    {campaign.type === 'email' ? 'Email Content' : 'SMS Content'}
                  </h3>

                  {campaign.type === 'email' ? (
                    <div className="space-y-4">
                      {campaign.subject && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Subject</p>
                          <p className="font-medium text-lg">{campaign.subject}</p>
                        </div>
                      )}
                      {campaign.preview_text && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Preview Text</p>
                          <p className="text-sm text-muted-foreground">{campaign.preview_text}</p>
                        </div>
                      )}
                      <Separator />
                      {campaign.body_html ? (
                        <div className="border rounded-lg p-4 bg-white dark:bg-slate-900">
                          <div
                            className="prose prose-sm max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: campaign.body_html }}
                          />
                        </div>
                      ) : campaign.body_text ? (
                        <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                          <p className="whitespace-pre-wrap text-sm">{campaign.body_text}</p>
                        </div>
                      ) : campaign.template ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground uppercase">Using Template</p>
                          <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                            <p className="font-medium text-blue-700 dark:text-blue-300">{campaign.template.name}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">No content</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {campaign.sms_content ? (
                        <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                          <p className="whitespace-pre-wrap">{campaign.sms_content}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {campaign.sms_content.length} characters •{' '}
                            {Math.ceil(campaign.sms_content.length / 160)} segment(s)
                          </p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">No content</p>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="recipients" className="px-6 py-4 space-y-6 mt-0">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase">
                      Send History
                    </h3>
                    {recipients.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {recipients.length} total send{recipients.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {recipientsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : recipients.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Sent At</TableHead>
                          <TableHead>Opened</TableHead>
                          <TableHead>Clicked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipients.map((send) => {
                          // Handle contact being either object or array
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
                                    <p className="font-medium">{contactName}</p>
                                  )}
                                  <p className={cn(
                                    "text-xs",
                                    contactName ? "text-muted-foreground" : "font-medium"
                                  )}>
                                    {contactEmail}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    (send.status === 'sent' || send.status === 'delivered') && 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
                                    send.status === 'opened' && 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                                    send.status === 'clicked' && 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
                                    send.status === 'bounced' && 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
                                    send.status === 'failed' && 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
                                    send.status === 'pending' && 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800'
                                  )}
                                >
                                  {send.status === 'sent' ? 'Delivered' : send.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {send.sent_at ? (
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDateTime(send.sent_at)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {send.opened_at ? (
                                  <div className="flex items-center gap-1">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <span className="text-xs text-muted-foreground">
                                      {formatDate(send.opened_at)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {send.clicked_at ? (
                                  <div className="flex items-center gap-1">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <span className="text-xs text-muted-foreground">
                                      {formatDate(send.clicked_at)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  ) : campaign.status === 'sent' ? (
                    <p className="text-muted-foreground text-center py-8">
                      No send history available
                    </p>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                      <p className="text-muted-foreground">
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
    </>
  )
}
