'use client'

import { useState, useMemo } from 'react'
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
import { Mail, MoreHorizontal, Eye, Pencil, Copy, Trash2, ListIcon, XCircle, Loader2, GitBranch, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
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

// Predefined color palette for pipeline badges
const pipelineColors = [
  { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-700' },
  { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-700' },
  { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-700' },
  { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700' },
  { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-700' },
  { bg: 'bg-cyan-50 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-700' },
  { bg: 'bg-indigo-50 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-700' },
  { bg: 'bg-teal-50 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-700' },
]

function buildPipelineColorMap(campaigns: Campaign[]) {
  const colorMap = new Map<string, typeof pipelineColors[number]>()
  let colorIndex = 0
  for (const campaign of campaigns) {
    const id = campaign.pipeline_id
    if (id && !colorMap.has(id)) {
      colorMap.set(id, pipelineColors[colorIndex % pipelineColors.length])
      colorIndex++
    }
  }
  return colorMap
}

const statusConfig: Record<Campaign['status'], { label: string; className: string; icon?: React.ReactNode }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900' },
  sending: { label: 'Sending', className: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900', icon: <Loader2 className="h-3 w-3 animate-spin mr-1" /> },
  sent: { label: 'Sent', className: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900' },
  failed: { label: 'Failed', className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900' },
}

type CampaignSortField = 'name' | 'status' | 'recipients' | 'date'
type SortDir = 'asc' | 'desc'

function CampaignSortIcon({ field, activeField, dir }: { field: CampaignSortField; activeField: CampaignSortField; dir: SortDir }) {
  if (field !== activeField) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
  return dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
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

  const pipelineColorMap = useMemo(() => buildPipelineColorMap(campaigns), [campaigns])

  const deleteCampaign = useDeleteCampaign()
  const duplicateCampaign = useDuplicateCampaign()
  const cancelCampaign = useCancelCampaign()

  const [sortField, setSortField] = useState<CampaignSortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = (field: CampaignSortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'name' ? 'asc' : 'desc')
    }
  }

  const sortedCampaigns = useMemo(() => {
    const sorted = [...campaigns]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'status': {
          const statusOrder: Record<string, number> = { draft: 0, scheduled: 1, sending: 2, sent: 3, cancelled: 4, failed: 5 }
          cmp = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0)
          break
        }
        case 'recipients':
          cmp = (a.total_recipients || a.recipient_count || 0) - (b.total_recipients || b.recipient_count || 0)
          break
        case 'date': {
          const dateA = new Date(a.sent_at || a.scheduled_at || a.created_at).getTime()
          const dateB = new Date(b.sent_at || b.scheduled_at || b.created_at).getTime()
          cmp = dateA - dateB
          break
        }
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [campaigns, sortField, sortDir])

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
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"><Checkbox disabled /></TableHead>
              <TableHead className="min-w-[200px]">Campaign</TableHead>
              <TableHead className="w-[130px]">Audience</TableHead>
              <TableHead className="w-[100px]">Pipeline</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[80px] text-center">Recipients</TableHead>
              <TableHead className="w-[80px] text-center">Delivered</TableHead>
              <TableHead className="w-[100px]">Sent Date</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
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
      <div className="border rounded-lg p-12 text-center bg-white dark:bg-slate-900 dark:border-slate-700">
        <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No campaigns yet</h3>
        <p className="text-muted-foreground">
          Create your first campaign to start reaching out to players.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={(checked) => onSelectAll(checked === true)}
                />
              </TableHead>
              <TableHead className="min-w-[200px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('name')}>
                <div className="flex items-center gap-1">
                  Campaign <CampaignSortIcon field="name" activeField={sortField} dir={sortDir} />
                </div>
              </TableHead>
              <TableHead className="w-[130px]">Audience</TableHead>
              <TableHead className="w-[100px]">Pipeline</TableHead>
              <TableHead className="w-[90px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('status')}>
                <div className="flex items-center gap-1">
                  Status <CampaignSortIcon field="status" activeField={sortField} dir={sortDir} />
                </div>
              </TableHead>
              <TableHead className="w-[80px] text-center cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('recipients')}>
                <div className="flex items-center justify-center gap-1">
                  Recipients <CampaignSortIcon field="recipients" activeField={sortField} dir={sortDir} />
                </div>
              </TableHead>
              <TableHead className="w-[80px] text-center">Delivered</TableHead>
              <TableHead className="w-[100px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('date')}>
                <div className="flex items-center gap-1">
                  Date <CampaignSortIcon field="date" activeField={sortField} dir={sortDir} />
                </div>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCampaigns.map((campaign) => {
              const status = statusConfig[campaign.status]
              // Calculate recipient count from lists or use stored count
              const recipientLists = campaign.recipient_lists || []
              const totalRecipients = recipientLists.reduce((sum, list) => sum + (list.contact_count || 0), 0)
              const recipients = campaign.recipient_count || totalRecipients
              
              // delivered_count is updated by the Resend webhook handler when
              // an "email.delivered" event fires. If that's not configured (or
              // events haven't arrived yet), fall back to processed_recipients
              // — the count of emails the campaign runner actually pushed
               // through Resend's API. That's the most reliable "left our system"
              // signal we have without webhook acknowledgement.
              const deliveredCount =
                campaign.delivered_count ||
                campaign.processed_recipients ||
                0
              const totalSent = campaign.total_recipients || recipients
              const deliveredDisplay = campaign.status === 'sent' && totalSent > 0
                ? `${deliveredCount}/${totalSent}`
                : '-'

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
                        <div className="w-10 h-10 rounded flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                          <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <span className="font-medium block">{campaign.name}</span>
                        {(campaign.template?.subject || campaign.subject) && (
                          <span className="text-xs text-muted-foreground block truncate max-w-[200px]">
                            {campaign.template?.subject || campaign.subject}
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
                    <div className="flex flex-wrap items-center gap-1">
                      {(campaign.recipient_lists?.length ?? 0) > 0 && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {campaign.recipient_lists!.length} list{campaign.recipient_lists!.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {(campaign.recipient_tags?.length ?? 0) > 0 && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {campaign.recipient_tags!.length} tag{campaign.recipient_tags!.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {(campaign.recipient_stages?.length ?? 0) > 0 && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {campaign.recipient_stages!.length} stage{campaign.recipient_stages!.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {!campaign.recipient_lists?.length &&
                        !campaign.recipient_tags?.length &&
                        !campaign.recipient_stages?.length && (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {campaign.pipeline ? (() => {
                      const color = pipelineColorMap.get(campaign.pipeline_id!) || pipelineColors[0]
                      return (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className={cn('text-xs font-normal cursor-default', color.bg, color.text, color.border)}>
                              <GitBranch className="h-3 w-3 mr-1" />
                              {campaign.pipeline.name}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <p className="font-medium">Programme-Specific Campaign</p>
                              {campaign.pipeline.programme && (
                                <p className="text-muted-foreground">Programme: {campaign.pipeline.programme.name}</p>
                              )}
                              <p className="text-muted-foreground mt-1">Replies create deals via Smart Process</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      )
                    })() : (
                      <Badge variant="outline" className="text-xs font-normal cursor-default bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                        Generic
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge className={cn('font-normal inline-flex items-center', status.className)}>
                        {status.icon}
                        {status.label}
                      </Badge>
                      {campaign.status === 'sending' && campaign.total_recipients && campaign.total_recipients > 0 && (
                        <div className="space-y-1">
                          <Progress
                            value={(campaign.processed_recipients || 0) / campaign.total_recipients * 100}
                            className="h-1.5 w-20"
                          />
                          <span className="text-xs text-muted-foreground">
                            {formatNumber(campaign.processed_recipients || 0)}/{formatNumber(campaign.total_recipients)}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-center">
                    {campaign.status === 'sending' || campaign.status === 'sent'
                      ? formatNumber(campaign.total_recipients || recipients)
                      : formatNumber(recipients)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-center">{deliveredDisplay}</TableCell>
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
                        {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
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
              Are you sure you want to delete &quot;{deleteDialogCampaign?.name}&quot;? This action cannot be undone.
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
              Are you sure you want to cancel &quot;{cancelDialogCampaign?.name}&quot;? It will not be sent.
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
