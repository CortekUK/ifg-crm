'use client'

import { Card, CardContent } from '@/components/ui/card'
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
  const confidence = message.ai_intent_confidence
    ? Math.round(message.ai_intent_confidence * 100)
    : null

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || ''
    const last = lastName?.[0] || ''
    return (first + last).toUpperCase() || '??'
  }

  const displayName = message.contact
    ? `${message.contact.first_name} ${message.contact.last_name}`
    : formatPhoneNumber(message.phone_number)

  return (
    <Card className={cn(
      'hover:shadow-md transition-shadow',
      isSpam && 'opacity-60',
      selected && 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
    )}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Checkbox for selection */}
          {selectable && !isSpam && (
            <div className="shrink-0 flex items-start pt-1">
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelectChange?.(message, !!checked)}
                aria-label={`Select message from ${displayName}`}
              />
            </div>
          )}

          {/* Avatar / Phone Icon */}
          <div className="shrink-0">
            {message.contact ? (
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-sm">
                  {getInitials(message.contact.first_name, message.contact.last_name)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Phone className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 dark:text-white">{displayName}</span>
                {message.pipeline && (
                  <Badge variant="outline" className="text-xs">
                    {message.pipeline.name}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded shrink-0">
                {formatRelativeTime(message.created_at)}
              </span>
            </div>

            {/* Message Content */}
            <p className={cn('text-sm text-gray-600 dark:text-gray-400 mb-3', isSpam && 'line-through')}>
              {message.content}
            </p>

            {/* Footer Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={intentInfo.className}>{intentInfo.label}</Badge>
                {confidence !== null && (
                  <span className="text-xs text-muted-foreground">
                    {confidence}% confident
                  </span>
                )}
                {!isMatched && !isSpam && (
                  <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700">
                    Unmatched
                  </Badge>
                )}
                {isMatched && message.match_status === 'auto_matched' && (
                  <Badge variant="outline" className="text-xs">Auto-matched</Badge>
                )}
                {isMatched && message.match_status === 'manually_matched' && (
                  <Badge variant="outline" className="text-xs">Manually matched</Badge>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewFull(message)}
                  className="text-muted-foreground"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>

                {!isMatched && !isSpam && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onMatchClick(message)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Match
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMarkSpam(message)}
                      className="text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}

                {isMatched && message.contact && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewContact(message.contact!.id)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Contact
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
