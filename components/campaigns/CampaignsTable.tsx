'use client'

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
import { Skeleton } from '@/components/ui/skeleton'
import { Mail, MessageSquare, MoreHorizontal, Eye, Pencil, Copy, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Campaign } from '@/lib/types/campaigns'

interface CampaignsTableProps {
  campaigns: Campaign[]
  isLoading: boolean
  selectedIds: Set<string>
  onSelectChange: (id: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
}

const statusConfig: Record<Campaign['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  sending: { label: 'Sending', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
  sent: { label: 'Sent', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
}

export function CampaignsTable({
  campaigns,
  isLoading,
  selectedIds,
  onSelectChange,
  onSelectAll,
}: CampaignsTableProps) {
  const allSelected = campaigns.length > 0 && selectedIds.size === campaigns.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < campaigns.length

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
        <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No campaigns yet</h3>
        <p className="text-muted-foreground">
          Create your first campaign to start reaching out to players.
        </p>
      </div>
    )
  }

  return (
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
            <TableHead>Sent Date</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => {
            const status = statusConfig[campaign.status]
            // Placeholder stats
            const recipients = Math.floor(Math.random() * 5000) + 500
            const openRate = campaign.type === 'email' && campaign.status === 'sent' 
              ? `${(Math.random() * 30 + 15).toFixed(1)}%` 
              : '-'
            const clickRate = campaign.type === 'email' && campaign.status === 'sent'
              ? `${(Math.random() * 10 + 2).toFixed(1)}%`
              : '-'

            return (
              <TableRow key={campaign.id} className="hover:bg-muted/50">
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(campaign.id)}
                    onCheckedChange={(checked) =>
                      onSelectChange(campaign.id, checked as boolean)
                    }
                    onClick={(e) => e.stopPropagation()}
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
                    <span className="font-medium">{campaign.name}</span>
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
                  {recipients.toLocaleString('en-GB')}
                </TableCell>
                <TableCell className="text-muted-foreground">{openRate}</TableCell>
                <TableCell className="text-muted-foreground">{clickRate}</TableCell>
                <TableCell className="text-muted-foreground">
                  {campaign.sent_at ? formatDate(campaign.sent_at) : 'Not sent'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
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
  )
}
