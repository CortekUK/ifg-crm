'use client'

import { TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Trash2, UserPlus, Eye, ExternalLink, MoreVertical, Undo2 } from 'lucide-react'
import { formatRelativeTime, formatDateTime } from '@/lib/utils/format'
import { trimQuotedContent } from '@/lib/utils/trimQuotedContent'
import { cn } from '@/lib/utils'
import type { EmailReply, EmailIntent } from '@/lib/types/email'

interface EmailReplyCardProps {
  reply: EmailReply
  onMatchClick: (reply: EmailReply) => void
  onViewContact: (contactId: string) => void
  onMarkSpam: (reply: EmailReply) => void
  onUnmarkSpam?: (reply: EmailReply) => void
  onViewFull: (reply: EmailReply) => void
  selectable?: boolean
  selected?: boolean
  onSelectChange?: (reply: EmailReply, selected: boolean) => void
}

// Unknown intent intentionally omitted — we render no badge in that case so
// the column doesn't fill with grey "Unknown" pills that carry no signal.
const intentConfig: Record<Exclude<EmailIntent, 'unknown'>, { label: string; className: string }> = {
  positive: { label: 'Positive', className: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
  negative: { label: 'Negative', className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
  neutral: { label: 'Neutral', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
  question: { label: 'Question', className: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' },
}

export function EmailReplyCard({
  reply,
  onMatchClick,
  onViewContact,
  onMarkSpam,
  onUnmarkSpam,
  onViewFull,
  selectable = false,
  selected = false,
  onSelectChange,
}: EmailReplyCardProps) {
  const isMatched = reply.match_status === 'auto_matched' || reply.match_status === 'manually_matched'
  const isSpam = reply.match_status === 'spam'
  const intent = reply.ai_intent as EmailIntent | null
  const intentInfo = intent && intent !== 'unknown' ? intentConfig[intent] : null
  // List previews used to dump the full quoted thread; strip it so the user
  // sees what the contact actually wrote.
  const cleanPreview = trimQuotedContent(reply.body_preview || '') || (reply.body_preview ?? '')

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email?.slice(0, 2).toUpperCase() || '??'
  }

  const displayName = reply.from_name || reply.from_email

  return (
    <TableRow
      className={cn(
        'cursor-pointer',
        isSpam && 'opacity-60',
        selected && 'bg-blue-50/50 dark:bg-blue-900/20'
      )}
      onClick={() => onViewFull(reply)}
    >
      {/* Checkbox */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        {selectable && !isSpam ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectChange?.(reply, !!checked)}
            aria-label={`Select reply from ${displayName}`}
          />
        ) : null}
      </TableCell>

      {/* From */}
      <TableCell>
        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[10px]">
              {getInitials(reply.from_name, reply.from_email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[160px]">
              {displayName}
            </p>
            {reply.from_name && (
              <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                {reply.from_email}
              </p>
            )}
          </div>
        </div>
      </TableCell>

      {/* Subject & Preview */}
      <TableCell>
        <p className={cn('text-sm font-medium truncate max-w-[280px]', isSpam && 'line-through')}>
          {reply.subject || '(No subject)'}
        </p>
        <p className={cn('text-[11px] text-muted-foreground truncate max-w-[280px]', isSpam && 'line-through')}>
          {cleanPreview || '(No content)'}
        </p>
      </TableCell>

      {/* Intent — only render a badge when classification produced a real signal */}
      <TableCell>
        {intentInfo ? (
          <Badge className={cn('text-[10px] font-medium', intentInfo.className)}>
            {intentInfo.label}
          </Badge>
        ) : (
          <span className="text-muted-foreground/50 text-xs">—</span>
        )}
      </TableCell>

      {/* Campaign */}
      <TableCell className="text-sm text-muted-foreground">
        {reply.campaign ? (
          <span className="truncate block max-w-[120px]">{reply.campaign.name}</span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </TableCell>

      {/* Pipeline — direct join on email_replies.pipeline_id (covers both
          automation and campaign sources). Falls back to the campaign-side
          join for old rows that predate the direct column being populated. */}
      <TableCell className="text-sm text-muted-foreground">
        {(() => {
          const pipeline = reply.pipeline ?? reply.campaign?.pipeline ?? null
          return pipeline ? (
            <span className="truncate block max-w-[100px]">{pipeline.name}</span>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          )
        })()}
      </TableCell>

      {/* Received — relative time ("3 minutes ago", "1 day ago").
          Hover reveals the full timestamp. */}
      <TableCell className="text-xs text-muted-foreground">
        <span title={formatDateTime(reply.received_at || reply.created_at)}>
          {formatRelativeTime(reply.received_at || reply.created_at)}
        </span>
      </TableCell>

      {/* Actions — primary action stays inline, the rest live in a kebab menu */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {!isMatched && !isSpam && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onMatchClick(reply)}
              className="h-7 px-2 text-xs"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Match
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground"
                title="More actions"
                aria-label="More actions"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onViewFull(reply)}>
                <Eye className="h-3.5 w-3.5 mr-2" />
                View reply
              </DropdownMenuItem>
              {isMatched && reply.contact && (
                <DropdownMenuItem onClick={() => onViewContact(reply.contact!.id)}>
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  Open contact
                </DropdownMenuItem>
              )}
              {!isMatched && !isSpam && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onMarkSpam(reply)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Mark as spam
                  </DropdownMenuItem>
                </>
              )}
              {isSpam && onUnmarkSpam && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onUnmarkSpam(reply)}>
                    <Undo2 className="h-3.5 w-3.5 mr-2" />
                    Restore from spam
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  )
}
