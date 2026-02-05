'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, UserPlus, Eye, ExternalLink } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { EmailReply, EmailIntent } from '@/lib/types/email'

interface EmailReplyCardProps {
  reply: EmailReply
  onMatchClick: (reply: EmailReply) => void
  onViewContact: (contactId: string) => void
  onMarkSpam: (reply: EmailReply) => void
  onViewFull: (reply: EmailReply) => void
  selectable?: boolean
  selected?: boolean
  onSelectChange?: (reply: EmailReply, selected: boolean) => void
}

const intentConfig: Record<EmailIntent, { label: string; className: string }> = {
  positive: { label: 'Positive', className: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
  negative: { label: 'Negative', className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
  neutral: { label: 'Neutral', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
  question: { label: 'Question', className: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' },
  unknown: { label: 'Unknown', className: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' },
}

export function EmailReplyCard({
  reply,
  onMatchClick,
  onViewContact,
  onMarkSpam,
  onViewFull,
  selectable = false,
  selected = false,
  onSelectChange,
}: EmailReplyCardProps) {
  const isMatched = reply.match_status === 'auto_matched' || reply.match_status === 'manually_matched'
  const isSpam = reply.match_status === 'spam'
  const intent = reply.ai_intent || 'unknown'
  const intentInfo = intentConfig[intent]

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email?.slice(0, 2).toUpperCase() || '??'
  }

  const displayName = reply.from_name || reply.from_email

  return (
    <tr className={cn(
      'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
      isSpam && 'opacity-60',
      selected && 'bg-blue-50/50 dark:bg-blue-900/20'
    )}>
      {/* Checkbox */}
      <td className="pl-4 pr-2 py-2.5 w-10">
        {selectable && !isSpam ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectChange?.(reply, !!checked)}
            aria-label={`Select reply from ${displayName}`}
          />
        ) : null}
      </td>

      {/* From */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-[10px]">
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
      </td>

      {/* Subject & Preview */}
      <td className="px-3 py-2.5">
        <p className={cn('text-sm font-medium truncate max-w-[280px]', isSpam && 'line-through')}>
          {reply.subject || '(No subject)'}
        </p>
        <p className={cn('text-[11px] text-muted-foreground truncate max-w-[280px]', isSpam && 'line-through')}>
          {reply.body_preview || '(No content)'}
        </p>
      </td>

      {/* Intent */}
      <td className="px-3 py-2.5">
        <Badge className={cn('text-[10px] font-medium', intentInfo.className)}>
          {intentInfo.label}
        </Badge>
      </td>

      {/* Campaign */}
      <td className="px-3 py-2.5 text-sm text-muted-foreground">
        {reply.campaign ? (
          <span className="truncate block max-w-[120px]">{reply.campaign.name}</span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </td>

      {/* Pipeline */}
      <td className="px-3 py-2.5 text-sm text-muted-foreground">
        {reply.campaign?.pipeline ? (
          <span className="truncate block max-w-[100px]">{reply.campaign.pipeline.name}</span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-2.5">
        {!isMatched && !isSpam && (
          <Badge variant="outline" className="text-[10px] bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
            Unmatched
          </Badge>
        )}
        {isMatched && (
          <Badge variant="outline" className="text-[10px] bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
            Matched
          </Badge>
        )}
        {isSpam && (
          <Badge variant="outline" className="text-[10px] bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700">
            Spam
          </Badge>
        )}
      </td>

      {/* Date */}
      <td className="px-3 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
        {formatRelativeTime(reply.created_at)}
      </td>

      {/* Actions */}
      <td className="pl-2 pr-4 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewFull(reply)}
            className="h-7 w-7 p-0 text-muted-foreground"
            title="View"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>

          {!isMatched && !isSpam && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={() => onMatchClick(reply)}
                className="h-7 px-2 text-xs"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Match
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkSpam(reply)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                title="Mark as spam"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {isMatched && reply.contact && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewContact(reply.contact!.id)}
              className="h-7 px-2 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Contact
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}
