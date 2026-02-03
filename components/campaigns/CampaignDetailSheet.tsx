'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
} from 'lucide-react'
import { formatDate, formatDateLong, formatNumber } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import {
  useCampaign,
  useCampaignStats,
  useCampaignRecipients,
  useDeleteCampaign,
  useDuplicateCampaign,
  useCancelCampaign,
} from '@/lib/hooks/useCampaigns'
import { toast } from '@/lib/hooks/use-toast'
import type { Campaign } from '@/lib/types/campaigns'

interface CampaignDetailSheetProps {
  campaignId: string | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (campaign: Campaign) => void
}

const statusConfig: Record<Campaign['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700' },
  sending: { label: 'Sending', className: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700' },
  sent: { label: 'Sent', className: 'bg-green-100 dark:bg-green-900/50 text-green-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 dark:bg-red-900/50 text-red-700' },
}

export function CampaignDetailSheet({
  campaignId,
  isOpen,
  onClose,
  onEdit,
}: CampaignDetailSheetProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const { data: campaign, isLoading } = useCampaign(campaignId)
  const { data: stats, isLoading: statsLoading } = useCampaignStats(campaignId)
  const { data: recipients = [], isLoading: recipientsLoading } = useCampaignRecipients(campaignId)

  const deleteCampaign = useDeleteCampaign()
  const duplicateCampaign = useDuplicateCampaign()
  const cancelCampaign = useCancelCampaign()

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

  if (!campaignId) return null

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
                  {isLoading ? <Skeleton className="h-7 w-48" /> : campaign?.name}
                </SheetTitle>
                <SheetDescription>
                  Campaign details and performance metrics
                </SheetDescription>
              </div>
              {campaign && (
                <Badge className={cn('font-normal', statusConfig[campaign.status].className)}>
                  {statusConfig[campaign.status].label}
                </Badge>
              )}
            </div>
          </SheetHeader>

          {isLoading ? (
            <div className="flex-1 p-6 space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : campaign ? (
            <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 pt-4 shrink-0">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="recipients">
                    Recipients {recipients.length > 0 && `(${recipients.length})`}
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1">
                <TabsContent value="details" className="px-6 py-4 space-y-6 mt-0">
                  {/* Campaign Info */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                      Campaign Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">Type</p>
                        <div className="flex items-center gap-2">
                          {campaign.type === 'email' ? (
                            <Mail className="h-4 w-4 text-blue-600" />
                          ) : (
                            <MessageSquare className="h-4 w-4 text-purple-600" />
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
                            <Send className="h-4 w-4 text-green-600" />
                            <span className="font-medium">{formatDateLong(campaign.sent_at)}</span>
                          </div>
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
                      <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
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

                  {/* Stats (only for sent campaigns) */}
                  {campaign.status === 'sent' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                        Performance
                      </h3>
                      {statsLoading ? (
                        <div className="grid grid-cols-2 gap-4">
                          {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-20" />
                          ))}
                        </div>
                      ) : stats ? (
                        <div className="grid grid-cols-2 gap-4">
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Send className="h-4 w-4 text-blue-600" />
                                <span className="text-sm text-muted-foreground">Delivered</span>
                              </div>
                              <p className="text-2xl font-bold">{formatNumber(stats.delivered)}</p>
                              <p className="text-xs text-muted-foreground">
                                {stats.deliveredRate.toFixed(1)}% of {formatNumber(stats.total)}
                              </p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Eye className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-muted-foreground">Opened</span>
                              </div>
                              <p className="text-2xl font-bold">{formatNumber(stats.opened)}</p>
                              <p className="text-xs text-muted-foreground">
                                {stats.openRate.toFixed(1)}% open rate
                              </p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <MousePointer className="h-4 w-4 text-purple-600" />
                                <span className="text-sm text-muted-foreground">Clicked</span>
                              </div>
                              <p className="text-2xl font-bold">{formatNumber(stats.clicked)}</p>
                              <p className="text-xs text-muted-foreground">
                                {stats.clickRate.toFixed(1)}% click rate
                              </p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <span className="text-sm text-muted-foreground">Bounced</span>
                              </div>
                              <p className="text-2xl font-bold">{formatNumber(stats.bounced)}</p>
                              <p className="text-xs text-muted-foreground">
                                {stats.bounceRate.toFixed(1)}% bounce rate
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No stats available</p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                      Actions
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {campaign.status === 'draft' && onEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(campaign)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
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
                      {campaign.status === 'scheduled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCancelDialog(true)}
                          className="text-orange-600 hover:text-orange-700 dark:text-orange-300"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-red-600 hover:text-red-700 dark:text-red-300"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="content" className="px-6 py-4 space-y-6 mt-0">
                  <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
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
                        <div className="border rounded-lg p-4 bg-white dark:bg-slate-900 dark:bg-slate-900">
                          <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: campaign.body_html }}
                          />
                        </div>
                      ) : campaign.body_text ? (
                        <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800 dark:bg-slate-800">
                          <p className="whitespace-pre-wrap text-sm">{campaign.body_text}</p>
                        </div>
                      ) : campaign.template ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground uppercase">Using Template</p>
                          <div className="border rounded-lg p-4 bg-blue-50">
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
                        <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800 dark:bg-slate-800">
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
                  <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                    Recipients
                  </h3>

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
                          <TableHead>Contact</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Opened</TableHead>
                          <TableHead>Clicked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipients.map((recipient) => (
                          <TableRow key={recipient.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {recipient.contact?.[0]?.first_name} {recipient.contact?.[0]?.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {recipient.contact?.[0]?.email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  recipient.status === 'delivered' && 'bg-green-50 text-green-700',
                                  recipient.status === 'bounced' && 'bg-red-50 text-red-700',
                                  recipient.status === 'pending' && 'bg-gray-50 dark:bg-slate-800 text-gray-700'
                                )}
                              >
                                {recipient.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {recipient.opened_at ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {recipient.clicked_at ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : campaign.status === 'sent' ? (
                    <p className="text-muted-foreground text-center py-8">
                      No recipient data available
                    </p>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                      <p className="text-muted-foreground">
                        Recipients will appear here after the campaign is sent
                      </p>
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          ) : null}
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
    </>
  )
}
