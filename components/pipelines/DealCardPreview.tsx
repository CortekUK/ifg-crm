'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Mail,
  Phone,
  GraduationCap,
  Calendar,
  Clock,
  User,
  TrendingUp,
  MessageSquare,
  Zap,
} from 'lucide-react'
import { formatCurrency, formatRelativeTime, formatDuration } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Deal } from '@/lib/types/pipelines'

interface DealCardPreviewProps {
  deal: Deal
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

const avatarColours = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-red-500',
]

function getAvatarColour(name: string): string {
  const index = name.charCodeAt(0) % avatarColours.length
  return avatarColours[index]
}

export function DealCardPreview({ deal }: DealCardPreviewProps) {
  const contact = deal.contact
  const contactName = contact
    ? `${contact.first_name} ${contact.last_name}`
    : deal.title
  const initials = contact
    ? getInitials(contact.first_name, contact.last_name)
    : deal.title.slice(0, 2).toUpperCase()
  const avatarColour = getAvatarColour(contactName)

  // Calculate days in pipeline
  const daysInPipeline = deal.created_at
    ? Math.floor((Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar className={cn('h-12 w-12', avatarColour)}>
          <AvatarFallback className="text-white text-sm font-medium bg-transparent">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base truncate">{contactName}</p>
          <p className="text-lg font-bold text-green-600">
            {formatCurrency(deal.deal_value)}
          </p>
        </div>
      </div>

      <Separator />

      {/* Contact Details */}
      <div className="space-y-2">
        {contact?.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
        {contact?.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            <span>{contact.phone}</span>
          </div>
        )}
        {contact?.graduation_year && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" />
            <span>Class of {contact.graduation_year}</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900/30">
            <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">In Pipeline</p>
            <p className="text-sm font-medium">{daysInPipeline}d</p>
          </div>
        </div>

        {deal.time_in_stage !== undefined && (
          <div className="flex items-center gap-2">
            <div className={cn(
              'p-1.5 rounded-md',
              deal.time_in_stage > 14 ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-slate-50 dark:bg-slate-800'
            )}>
              <Clock className={cn(
                'h-3.5 w-3.5',
                deal.time_in_stage > 14 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'
              )} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">In Stage</p>
              <p className="text-sm font-medium">{formatDuration(deal.time_in_stage)}</p>
            </div>
          </div>
        )}

        {deal.win_probability !== null && deal.win_probability !== undefined && (
          <div className="flex items-center gap-2">
            <div className={cn(
              'p-1.5 rounded-md',
              deal.win_probability >= 50 ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'
            )}>
              <TrendingUp className={cn(
                'h-3.5 w-3.5',
                deal.win_probability >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Win Prob.</p>
              <p className="text-sm font-medium">{deal.win_probability}%</p>
            </div>
          </div>
        )}

        {deal.owner && (
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-purple-50 dark:bg-purple-900/30">
              <User className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Owner</p>
              <p className="text-sm font-medium truncate">
                {deal.owner.full_name?.split(' ')[0] || 'Unassigned'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Notes Preview */}
      {deal.notes && (
        <>
          <Separator />
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Notes</p>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {deal.notes}
            </p>
          </div>
        </>
      )}

      {/* Automation Status */}
      {deal.has_active_automation && (
        <>
          <Separator />
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 text-[10px]">
              <Zap className="h-2.5 w-2.5 mr-1" />
              Automation Active
            </Badge>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="pt-1">
        <p className="text-[10px] text-muted-foreground">
          Added {formatRelativeTime(deal.created_at)}
        </p>
      </div>
    </div>
  )
}
