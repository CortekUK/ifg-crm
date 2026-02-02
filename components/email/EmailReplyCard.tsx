'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Mail, Trash2, ExternalLink, UserPlus, Eye } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { EmailReply, EmailIntent } from '@/lib/types/email'

interface EmailReplyCardProps {
  reply: EmailReply
  onMatchClick: (reply: EmailReply) => void
  onViewContact: (contactId: string) => void
  onMarkSpam: (reply: EmailReply) => void
  onViewFull: (reply: EmailReply) => void
}

const intentConfig: Record<EmailIntent, { label: string; className: string }> = {
  positive: { label: 'Positive', className: 'bg-green-100 text-green-700' },
  negative: { label: 'Negative', className: 'bg-red-100 text-red-700' },
  neutral: { label: 'Neutral', className: 'bg-gray-100 text-gray-700' },
  unknown: { label: 'Unknown', className: 'bg-gray-100 text-gray-500' },
}

export function EmailReplyCard({
  reply,
  onMatchClick,
  onViewContact,
  onMarkSpam,
  onViewFull,
}: EmailReplyCardProps) {
  const isMatched = reply.match_status === 'auto_matched' || reply.match_status === 'manually_matched'
  const isSpam = reply.match_status === 'spam'
  const intent = reply.ai_intent || 'unknown'
  const intentInfo = intentConfig[intent]

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email?.slice(0, 2).toUpperCase() || '??'
  }

  const displayName = reply.from_name || reply.from_email

  return (
    <Card className={cn('hover:shadow-md transition-shadow', isSpam && 'opacity-60')}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Avatar */}
          <div className="shrink-0">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-blue-100 text-blue-600 text-sm">
                {getInitials(reply.from_name, reply.from_email)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="font-medium text-gray-900">{displayName}</span>
                {reply.from_name && (
                  <span className="text-sm text-muted-foreground">
                    &lt;{reply.from_email}&gt;
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatRelativeTime(reply.created_at)}
              </span>
            </div>

            {/* Subject */}
            <p className={cn('font-medium text-sm mb-1', isSpam && 'line-through')}>
              {reply.subject || '(No subject)'}
            </p>

            {/* Body Preview */}
            <p className={cn('text-sm text-gray-600 mb-3 line-clamp-2', isSpam && 'line-through')}>
              {reply.body_preview || reply.body_full?.slice(0, 200) || '(No content)'}
            </p>

            {/* Footer Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={intentInfo.className}>{intentInfo.label}</Badge>
                {reply.campaign && (
                  <Badge variant="outline" className="text-xs">
                    {reply.campaign.name}
                  </Badge>
                )}
                {!isMatched && !isSpam && (
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                    Unmatched
                  </Badge>
                )}
                {isMatched && reply.match_status === 'auto_matched' && (
                  <Badge variant="outline" className="text-xs">Auto-matched</Badge>
                )}
                {isMatched && reply.match_status === 'manually_matched' && (
                  <Badge variant="outline" className="text-xs">Manually matched</Badge>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewFull(reply)}
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
                      onClick={() => onMatchClick(reply)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Match
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMarkSpam(reply)}
                      className="text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}

                {isMatched && reply.contact && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewContact(reply.contact!.id)}
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
