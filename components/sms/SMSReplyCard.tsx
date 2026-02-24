'use client'

import { TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { Phone, Trash2, ExternalLink, UserPlus, Eye } from 'lucide-react'
import { formatRelativeTime, formatPhoneNumber } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { SMSMessage, SMSIntent } from '@/lib/types/sms'

interface SMSReplyCardProps {
  message: SMSMessage
  onMatchClick: (message: SMSMessage) => void
  onViewContact: (contactId: string) => void
  onMarkSpam: (message: SMSMessage) => void
  onViewFull: (message: SMSMessage) => void
  selectable?: boolean
  selected?: boolean
  onSelectChange?: (message: SMSMessage, selected: boolean) => void
}

const intentConfig: Record<SMSIntent, { label: string; className: string }> = {
  positive: { label: 'Positive', className: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
  negative: { label: 'Negative', className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
  neutral: { label: 'Neutral', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
  question: { label: 'Question', className: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' },
  unknown: { label: 'Unknown', className: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' },
}

export function SMSReplyCard({
  message,
  onMatchClick,
  onViewContact,
  onMarkSpam,
  onViewFull,
  selectable = false,
  selected = false,
  onSelectChange,
}: SMSReplyCardProps) {
  const isMatched = message.match_status === 'auto_matched' || message.match_status === 'manually_matched'
  const isSpam = message.match_status === 'spam'
  const intent = message.ai_intent || 'unknown'
  const intentInfo = intentConfig[intent]

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || ''
    const last = lastName?.[0] || ''
    return (first + last).toUpperCase() || '??'
  }

  const displayName = message.contact
    ? `${message.contact.first_name} ${message.contact.last_name}`
    : formatPhoneNumber(message.phone_number)

  return (
    <TableRow
      className={cn(
        'cursor-pointer',
        isSpam && 'opacity-60',
        selected && 'bg-blue-50/50 dark:bg-blue-900/20'
      )}
      onClick={() => onViewFull(message)}
    >
      {/* Checkbox */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        {selectable && !isSpam ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectChange?.(message, !!checked)}
            aria-label={`Select message from ${displayName}`}
          />
        ) : null}
      </TableCell>

      {/* From */}
      <TableCell>
        <div className="flex items-center gap-2.5">
          {message.contact ? (
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 text-[10px]">
                {getInitials(message.contact.first_name, message.contact.last_name)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
              <Phone className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[140px]">
              {displayName}
            </p>
            {message.contact && (
              <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                {formatPhoneNumber(message.phone_number)}
              </p>
            )}
          </div>
        </div>
      </TableCell>

      {/* Message */}
      <TableCell>
        <p className={cn('text-sm truncate max-w-[320px]', isSpam && 'line-through')}>
          {message.content}
        </p>
      </TableCell>

      {/* Intent */}
      <TableCell>
        <Badge className={cn('text-[10px] font-medium', intentInfo.className)}>
          {intentInfo.label}
        </Badge>
      </TableCell>

      {/* Pipeline */}
      <TableCell className="text-sm text-muted-foreground">
        {message.pipeline ? (
          <span className="truncate block max-w-[100px]">{message.pipeline.name}</span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </TableCell>

      {/* Status */}
      <TableCell>
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
      </TableCell>

      {/* Date */}
      <TableCell className="text-xs text-muted-foreground">
        {formatRelativeTime(message.created_at)}
      </TableCell>

      {/* Actions */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewFull(message)}
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
                onClick={() => onMatchClick(message)}
                className="h-7 px-2 text-xs"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Match
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkSpam(message)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                title="Mark as spam"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {isMatched && message.contact && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewContact(message.contact!.id)}
              className="h-7 px-2 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Contact
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
