'use client'

import { useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Eye,
  Trophy,
  XCircle,
  Clock,
  Inbox,
} from 'lucide-react'
import { formatCurrency, formatRelativeTime, formatDuration } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Deal, PipelineStage } from '@/lib/types/pipelines'

interface PipelineListViewProps {
  deals: Deal[]
  stages: PipelineStage[]
  pipelineId: string | null
  isLoading: boolean
  onDealClick: (deal: Deal) => void
  onStageChange: (dealId: string, newStageId: string, oldStage?: PipelineStage, newStage?: PipelineStage) => void
  onMarkWon?: (deal: Deal) => void
  onMarkLost?: (deal: Deal) => void
  canMoveDeal?: (deal: Deal) => boolean
}

type SortKey = 'contact' | 'stage' | 'value' | 'owner' | 'time_in_stage' | 'created' | 'status'
type SortOrder = 'asc' | 'desc'

const columns: { key: SortKey | 'actions'; label: string; sortable: boolean }[] = [
  { key: 'contact', label: 'Contact', sortable: true },
  { key: 'stage', label: 'Stage', sortable: true },
  { key: 'value', label: 'Value', sortable: true },
  { key: 'owner', label: 'Owner', sortable: true },
  { key: 'time_in_stage', label: 'Time in Stage', sortable: true },
  { key: 'created', label: 'Created', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'actions', label: '', sortable: false },
]

// Avatar color palette
const avatarColors = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-red-500',
]

function getAvatarColor(name: string): string {
  const index = name.charCodeAt(0) % avatarColors.length
  return avatarColors[index]
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function getOwnerInitials(owner: Deal['owner']): string {
  if (!owner) return '?'
  if (owner.full_name) {
    const parts = owner.full_name.split(' ')
    return parts.map((p) => p.charAt(0)).join('').toUpperCase().slice(0, 2)
  }
  return owner.email.slice(0, 2).toUpperCase()
}

function getDealStatus(deal: Deal): 'won' | 'lost' | 'open' {
  if (deal.won_at) return 'won'
  if (deal.lost_at) return 'lost'
  return 'open'
}

function getTimeInStageColor(days: number | undefined): string {
  if (days === undefined) return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
  if (days <= 7) return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
  if (days <= 30) return 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
  return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
}

export function PipelineListView({
  deals,
  stages,
  pipelineId,
  isLoading,
  onDealClick,
  onStageChange,
  onMarkWon,
  onMarkLost,
  canMoveDeal,
}: PipelineListViewProps) {
  const [sortBy, setSortBy] = useState<SortKey>('contact')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder('asc')
    }
  }

  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'contact': {
          const nameA = a.contact
            ? `${a.contact.first_name} ${a.contact.last_name}`.toLowerCase()
            : a.title.toLowerCase()
          const nameB = b.contact
            ? `${b.contact.first_name} ${b.contact.last_name}`.toLowerCase()
            : b.title.toLowerCase()
          comparison = nameA.localeCompare(nameB)
          break
        }
        case 'stage': {
          const stageA = stages.find((s) => s.id === a.current_stage_id)
          const stageB = stages.find((s) => s.id === b.current_stage_id)
          comparison = (stageA?.display_order ?? 0) - (stageB?.display_order ?? 0)
          break
        }
        case 'value':
          comparison = a.deal_value - b.deal_value
          break
        case 'owner': {
          const ownerA = a.owner?.full_name || a.owner?.email || ''
          const ownerB = b.owner?.full_name || b.owner?.email || ''
          comparison = ownerA.localeCompare(ownerB)
          break
        }
        case 'time_in_stage':
          comparison = (a.time_in_stage ?? 0) - (b.time_in_stage ?? 0)
          break
        case 'created': {
          const dateA = new Date(a.created_at).getTime()
          const dateB = new Date(b.created_at).getTime()
          comparison = dateA - dateB
          break
        }
        case 'status': {
          const statusOrder = { won: 0, open: 1, lost: 2 }
          comparison = statusOrder[getDealStatus(a)] - statusOrder[getDealStatus(b)]
          break
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [deals, sortBy, sortOrder, stages])

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground/50" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-1 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-1 h-4 w-4" />
    )
  }

  const handleStageSelect = (deal: Deal, newStageId: string) => {
    if (newStageId === deal.current_stage_id) return
    const oldStage = stages.find((s) => s.id === deal.current_stage_id)
    const newStage = stages.find((s) => s.id === newStageId)
    onStageChange(deal.id, newStageId, oldStage, newStage)
  }

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (deals.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center bg-white dark:bg-slate-900 dark:border-slate-700">
        <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No deals found</h3>
        <p className="text-muted-foreground">
          Add a deal to this pipeline to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  col.sortable && 'cursor-pointer select-none hover:bg-muted/50'
                )}
                onClick={() => col.sortable && handleSort(col.key as SortKey)}
              >
                <div className="flex items-center">
                  {col.label}
                  {col.sortable && <SortIcon column={col.key as SortKey} />}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedDeals.map((deal) => {
            const contact = deal.contact
            const contactName = contact
              ? `${contact.first_name} ${contact.last_name}`
              : deal.title
            const initials = contact
              ? getInitials(contact.first_name, contact.last_name)
              : deal.title.slice(0, 2).toUpperCase()
            const avatarColor = getAvatarColor(contactName)
            const currentStage = stages.find((s) => s.id === deal.current_stage_id)
            const status = getDealStatus(deal)

            return (
              <TableRow
                key={deal.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onDealClick(deal)}
              >
                {/* Contact */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className={cn('h-8 w-8 ring-2 ring-background', avatarColor)}>
                      <AvatarFallback className="text-white text-xs font-semibold bg-transparent">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-medium">{contactName}</span>
                      {contact?.graduation_year && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({contact.graduation_year})
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Stage */}
                <TableCell
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Select
                    value={deal.current_stage_id}
                    onValueChange={(value) => handleStageSelect(deal, value)}
                    disabled={canMoveDeal ? !canMoveDeal(deal) : false}
                  >
                    <SelectTrigger className="w-[190px] h-8">
                      <SelectValue>
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: currentStage?.color || '#94a3b8' }}
                          />
                          <span className="truncate">
                            {currentStage?.name || 'Unknown'}
                          </span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Value */}
                <TableCell className="font-semibold text-green-600">
                  {formatCurrency(deal.deal_value)}
                </TableCell>

                {/* Owner */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 bg-muted">
                      <AvatarFallback className="text-[10px] font-medium text-muted-foreground bg-transparent">
                        {getOwnerInitials(deal.owner)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">
                      {deal.owner?.full_name || 'Unassigned'}
                    </span>
                  </div>
                </TableCell>

                {/* Time in Stage */}
                <TableCell>
                  {deal.time_in_stage !== undefined ? (
                    <Badge
                      variant="secondary"
                      className={cn('font-normal', getTimeInStageColor(deal.time_in_stage))}
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDuration(deal.time_in_stage)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Created */}
                <TableCell className="text-sm text-muted-foreground">
                  {formatRelativeTime(deal.created_at)}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'font-normal',
                      status === 'won' && 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
                      status === 'lost' && 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
                      status === 'open' && 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                    )}
                  >
                    {status === 'won' ? 'Won' : status === 'lost' ? 'Lost' : 'Open'}
                  </Badge>
                </TableCell>

                {/* Actions */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onDealClick(deal)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      {status === 'open' && (
                        <>
                          <DropdownMenuSeparator />
                          {onMarkWon && (
                            <DropdownMenuItem onClick={() => onMarkWon(deal)}>
                              <Trophy className="h-4 w-4 mr-2 text-green-600" />
                              Mark as Won
                            </DropdownMenuItem>
                          )}
                          {onMarkLost && (
                            <DropdownMenuItem onClick={() => onMarkLost(deal)}>
                              <XCircle className="h-4 w-4 mr-2 text-red-600" />
                              Mark as Lost
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
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
