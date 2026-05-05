'use client'

import { Draggable } from '@hello-pangea/dnd'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Clock, GraduationCap, User } from 'lucide-react'
import { formatCurrency, formatRelativeTime, formatDuration } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { QuickActions } from './QuickActions'
import type { Deal } from '@/lib/types/pipelines'

interface DealCardProps {
  deal: Deal
  index: number
  onClick?: () => void
  isDragDisabled?: boolean
  compact?: boolean
}

// Colour palette for avatar backgrounds
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

// Reply-intent visual mapping. The same mapping drives both the
// left-edge status bar and the small badge under the contact name, so
// they're always in sync. Colours intentionally diverge from the
// time-in-stage heuristic palette (which uses bg-green-500 etc.) so an
// intent-driven card is visually distinct from a fresh "Hot" deal.
const intentColours: Record<
  string,
  {
    bar: string
    badgeBg: string
    badgeText: string
    label: string
  }
> = {
  positive: {
    bar: 'bg-emerald-500',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    label: 'Positive',
  },
  negative: {
    bar: 'bg-rose-500',
    badgeBg: 'bg-rose-100 dark:bg-rose-900/50',
    badgeText: 'text-rose-700 dark:text-rose-300',
    label: 'Negative',
  },
  question: {
    bar: 'bg-amber-500',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/50',
    badgeText: 'text-amber-700 dark:text-amber-300',
    label: 'Question',
  },
  neutral: {
    bar: 'bg-slate-400',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    label: 'Neutral',
  },
  unsubscribe: {
    bar: 'bg-rose-800',
    badgeBg: 'bg-rose-100 dark:bg-rose-900/60',
    badgeText: 'text-rose-800 dark:text-rose-200',
    label: 'Unsubscribe',
  },
  unknown: {
    bar: 'bg-slate-400',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    label: 'Unclassified',
  },
}

// Determine status indicator color based on deal age/activity (or reply
// intent if the deal has been tagged by the inbound pipeline).
function getStatusColor(deal: Deal): { color: string; label: string } {
  // Won/Lost always wins — terminal state.
  if (deal.won_at) return { color: 'bg-green-500', label: 'Won' }
  if (deal.lost_at) return { color: 'bg-red-500', label: 'Lost' }

  // Reply intent overrides the time-in-stage heuristic. The intent gets
  // set by the resend-inbound edge function when a matched reply is
  // classified.
  if (deal.intent && intentColours[deal.intent]) {
    const i = intentColours[deal.intent]
    return { color: i.bar, label: `${i.label} reply` }
  }

  const timeInStage = deal.time_in_stage || 0

  // Hot lead (recently added or active)
  if (timeInStage <= 3) return { color: 'bg-green-500', label: 'Hot' }

  // Warm lead
  if (timeInStage <= 7) return { color: 'bg-blue-500', label: 'Active' }

  // Cooling off
  if (timeInStage <= 14) return { color: 'bg-amber-500', label: 'Follow up needed' }

  // Stale
  return { color: 'bg-red-500', label: 'Stale - needs attention' }
}

export function DealCard({ deal, index, onClick, isDragDisabled, compact = false }: DealCardProps) {
  const contact = deal.contact
  const contactName = contact
    ? `${contact.first_name} ${contact.last_name}`
    : deal.title
  const initials = contact
    ? getInitials(contact.first_name, contact.last_name)
    : deal.title.slice(0, 2).toUpperCase()
  const avatarColour = getAvatarColour(contactName)
  const status = getStatusColor(deal)

  return (
    <Draggable draggableId={deal.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => {
        // Custom style for smooth drop animation
        const style = {
          ...provided.draggableProps.style,
          // Add transition only when not actively dragging (for smooth drop)
          transition: snapshot.isDropAnimating
            ? 'all 0.25s cubic-bezier(0.2, 0, 0, 1)'
            : provided.draggableProps.style?.transition,
        }

        return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={style}
            onClick={onClick}
            className={cn(
              'group relative bg-card rounded-lg border cursor-pointer',
              'hover:shadow-md hover:border-primary/30',
              'transition-[shadow,border-color] duration-200',
              snapshot.isDragging && 'shadow-xl border-primary/50 z-50',
              snapshot.isDropAnimating && 'shadow-md',
              // No hover-translate / scale — the slight upward shift
              // combined with the previous padding transition read as
              // the card zooming on itself. Stick to shadow + border
              // tint as the only hover affordance.
              compact ? 'p-2 mb-1' : 'p-3 mb-2'
            )}
          >
            {/* Status Indicator Bar */}
            <div
              className={cn(
                'absolute left-0 rounded-full transition-all',
                status.color,
                compact ? 'top-2 bottom-2 w-0.5' : 'top-3 bottom-3 w-1'
              )}
            />

            {/* Quick Actions - Visible on Hover (hidden in compact) */}
            {!compact && (
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <QuickActions deal={deal} onView={onClick} />
              </div>
            )}

            {/* Main Content */}
            <div className={cn(
              'flex items-center',
              compact ? 'gap-2 pl-1.5' : 'gap-3 pl-2 items-start'
            )}>
              <Avatar className={cn(
                'ring-2 ring-background flex-shrink-0',
                avatarColour,
                compact ? 'h-6 w-6' : 'h-10 w-10'
              )}>
                <AvatarFallback className={cn(
                  "text-white font-semibold bg-transparent",
                  compact ? "text-[9px]" : "text-xs"
                )}>
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className={cn(
                "flex-1 min-w-0",
                // Constant pr-2 (no hover transition). The previous
                // hover-only pr-28 caused a visible padding shift when
                // the user hovered, which read as the card zooming in
                // on its own content. The QuickActions buttons that
                // appear on hover are absolutely positioned, so they
                // don't need this column to make room.
                !compact && "pr-2"
              )}>
                <p className={cn(
                  "font-medium truncate leading-tight",
                  compact ? "text-[11px]" : "text-sm"
                )}>{contactName}</p>
                {/* Reply intent badge — appears once a reply has been
                    classified and assigned to this deal. Tells the
                    recruiter at a glance whether the contact is
                    interested, asking a question, or unsubscribing. */}
                {deal.intent && intentColours[deal.intent] && (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full font-semibold',
                      intentColours[deal.intent].badgeBg,
                      intentColours[deal.intent].badgeText,
                      compact ? 'mt-0.5 px-1.5 text-[9px]' : 'mt-1 px-2 py-0.5 text-[10px]',
                    )}
                  >
                    {intentColours[deal.intent].label}
                  </span>
                )}
                <p className={cn(
                  "font-semibold text-green-600",
                  compact ? "text-[11px]" : "text-base mt-0.5"
                )}>
                  {formatCurrency(deal.deal_value)}
                </p>
              </div>
            </div>

            {/* Metadata Row - hidden in compact */}
            {!compact && (
              <div className="flex items-center gap-3 mt-3 pl-2 text-muted-foreground">
                {/* Graduation Year */}
                {contact?.graduation_year && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-xs">
                          <GraduationCap className="h-3 w-3" />
                          <span>{contact.graduation_year}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        Graduation year
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* Time in Stage */}
                {deal.time_in_stage !== undefined && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
                          deal.time_in_stage <= 7 && 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
                          deal.time_in_stage > 7 && deal.time_in_stage <= 30 && 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
                          deal.time_in_stage > 30 && 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                        )}>
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(deal.time_in_stage)}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        Time in current stage
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Owner */}
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <Avatar className="h-5 w-5 bg-muted">
                          <AvatarFallback className="text-[9px] font-medium text-muted-foreground bg-transparent">
                            {getOwnerInitials(deal.owner)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {deal.owner?.full_name || 'Unassigned'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Time Since Created */}
                <span className="text-[10px] text-muted-foreground/70">
                  {formatRelativeTime(deal.created_at)}
                </span>
              </div>
            )}
          </div>
        )
      }}
    </Draggable>
  )
}
