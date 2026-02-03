'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { Mail, MessageSquare, MoreHorizontal, Eye, Pencil, Copy, Trash2, ListIcon, XCircle, Loader2 } from 'lucide-react'
import { formatDate, formatNumber } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { useDeleteCampaign, useDuplicateCampaign, useCancelCampaign } from '@/lib/hooks/useCampaigns'
import { toast } from '@/lib/hooks/use-toast'
import type { Campaign } from '@/lib/types/campaigns'

interface CampaignsTableProps {
  campaigns: Campaign[]
  isLoading: boolean
  selectedIds: Set<string>
  onSelectChange: (id: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  onViewCampaign: (campaign: Campaign) => void
  onEditCampaign: (campaign: Campaign) => void
}

const statusConfig: Record<Campaign['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900' },
  sending: { label: 'Sending', className: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 animate-pulse' },
  sent: { label: 'Sent', className: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900' },
}

export function CampaignsTable({
  campaigns,
  isLoading,
  selectedIds,
  onSelectChange,
  onSelectAll,
  onViewCampaign,
  onEditCampaign,
}: CampaignsTableProps) {
  const [deleteDialogCampaign, setDeleteDialogCampaign] = useState<Campaign | null>(null)
  const [cancelDialogCampaign, setCancelDialogCampaign] = useState<Campaign | null>(null)

  const deleteCampaign = useDeleteCampaign()
  const duplicateCampaign = useDuplicateCampaign()
  const cancelCampaign = useCancelCampaign()

  const allSelected = campaigns.length > 0 && selectedIds.size === campaigns.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < campaigns.length

  const handleDelete = async () => {
    if (!deleteDialogCampaign) return
    try {
      await deleteCampaign.mutateAsync(deleteDialogCampaign.id)
      toast({
        title: 'Campaign deleted',
        description: `"${deleteDialogCampaign.name}" has been deleted.`,
      })
      setDeleteDialogCampaign(null)
    } catch (error) {
      toast({
        title: 'Failed to delete',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleDuplicate = async (campaign: Campaign) => {
    try {
      await duplicateCampaign.mutateAsync(campaign.id)
      toast({
        title: 'Campaign duplicated',
        description: `A copy of "${campaign.name}" has been created.`,
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
    if (!cancelDialogCampaign) return
    try {
      await cancelCampaign.mutateAsync(cancelDialogCampaign.id)
      toast({
        title: 'Campaign cancelled',
        description: `"${cancelDialogCampaign.name}" has been cancelled.`,
      })
      setCancelDialogCampaign(null)
    } catch (error) {
      toast({
        title: 'Failed to cancel',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"><Checkbox disabled /></TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Open Rate</TableHead>
              <TableHead>Click Rate</TableHead>
              <TableHead>Sent Date</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (campaigns.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No campaigns yet</h3>
        <p className="text-muted-foreground">
          Create your first campaign to start reaching out to players.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={(checked) => onSelectAll(checked === true)}
                />
              </TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Open Rate</TableHead>
              <TableHead>Click Rate</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => {
              const status = statusConfig[campaign.status]
              // Calculate recipient count from lists or use stored count
              const recipientLists = campaign.recipient_lists || []
              const totalRecipients = recipientLists.reduce((sum, list) => sum + (list.contact_count || 0), 0)
              const recipients = campaign.recipient_count || totalRecipients
              
              // Use actual stats if available, otherwise show placeholder
              const openRate = campaign.status === 'sent' && campaign.open_count !== undefined
                ? `${((campaign.open_count / (campaign.delivered_count || 1)) * 100).toFixed(1)}%`
                : campaign.status === 'sent' ? '-' : '-'
              const clickRate = campaign.status === 'sent' && campaign.click_count !== undefined
                ? `${((campaign.click_count / (campaign.delivered_count || 1)) * 100).toFixed(1)}%`
                : campaign.status === 'sent' ? '-' : '-'

              return (
                <TableRow
                  key={campaign.id}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => onViewCampaign(campaign)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(campaign.id)}
                      onCheckedChange={(checked) =>
                        onSelectChange(campaign.id, checked as boolean)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {campaign.thumbnail_url ? (
                        <img
                          src={campaign.thumbnail_url}
                          alt=""
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                          {campaign.type === 'email' ? (
                            <Mail className="h-5 w-5 text-gray-400" />
                          ) : (
                            <MessageSquare className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      )}
                      <div className="space-y-1">
                        <span className="font-medium block">{campaign.name}</span>
                        {campaign.subject && (
                          <span className="text-xs text-muted-foreground block truncate max-w-[200px]">
                            {campaign.subject}
                          </span>
                        )}
                        {recipientLists.length > 0 && (
                          <div className="flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 cursor-default">
                                    <ListIcon className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {recipientLists.length} list{recipientLists.length > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs">
                                  <div className="space-y-1">
                                    {recipientLists.map((list) => (
                                      <div key={list.id} className="flex items-center justify-between gap-4 text-xs">
                                        <span>{list.name}</span>
                                        <span className="text-muted-foreground">
                                          {formatNumber(list.contact_count || 0)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {campaign.type === 'email' ? (
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="capitalize">{campaign.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('font-normal', status.className)}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatNumber(recipients)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{openRate}</TableCell>
                  <TableCell className="text-muted-foreground">{clickRate}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {campaign.sent_at
                      ? formatDate(campaign.sent_at)
                      : campaign.scheduled_at
                        ? formatDate(campaign.scheduled_at)
                        : formatDate(campaign.created_at)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewCampaign(campaign)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        {campaign.status === 'draft' && (
                          <DropdownMenuItem onClick={() => onEditCampaign(campaign)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDuplicate(campaign)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {campaign.status === 'scheduled' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setCancelDialogCampaign(campaign)}
                              className="text-orange-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteDialogCampaign(campaign)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialogCampaign} onOpenChange={() => setDeleteDialogCampaign(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialogCampaign?.name}"? This action cannot be undone.
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
      <AlertDialog open={!!cancelDialogCampaign} onOpenChange={() => setCancelDialogCampaign(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Scheduled Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel "{cancelDialogCampaign?.name}"? It will not be sent.
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
