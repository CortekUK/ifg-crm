'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { formatDateLong, formatRelativeTime } from '@/lib/utils/format'
import type { EmailReply, EmailIntent } from '@/lib/types/email'

interface EmailDetailSheetProps {
  reply: EmailReply | null
  isOpen: boolean
  onClose: () => void
}

const intentConfig: Record<EmailIntent, { label: string; className: string }> = {
  positive: { label: 'Positive', className: 'bg-green-100 text-green-700' },
  negative: { label: 'Negative', className: 'bg-red-100 text-red-700' },
  neutral: { label: 'Neutral', className: 'bg-gray-100 text-gray-700' },
  unknown: { label: 'Unknown', className: 'bg-gray-100 text-gray-500' },
}

export function EmailDetailSheet({
  reply,
  isOpen,
  onClose,
}: EmailDetailSheetProps) {
  if (!reply) return null

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

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Email Details</SheetTitle>
          <SheetDescription>
            Full email content and metadata
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] pr-4">
          <div className="space-y-6 mt-6">
            {/* Sender Info */}
            <div className="flex items-start gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-blue-100 text-blue-600">
                  {getInitials(reply.from_name, reply.from_email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">
                  {reply.from_name || reply.from_email}
                </p>
                {reply.from_name && (
                  <p className="text-sm text-muted-foreground">
                    {reply.from_email}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateLong(reply.created_at)} ({formatRelativeTime(reply.created_at)})
                </p>
              </div>
            </div>

            {/* Status Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={intentInfo.className}>{intentInfo.label}</Badge>
              {reply.match_status === 'auto_matched' && (
                <Badge variant="outline">Auto-matched</Badge>
              )}
              {reply.match_status === 'manually_matched' && (
                <Badge variant="outline">Manually matched</Badge>
              )}
              {reply.match_status === 'spam' && (
                <Badge variant="destructive">Spam</Badge>
              )}
              {reply.campaign && (
                <Badge variant="secondary">{reply.campaign.name}</Badge>
              )}
            </div>

            {/* Matched Contact */}
            {reply.contact && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800 mb-1">
                  Matched to Contact
                </p>
                <p className="text-sm text-green-700">
                  {reply.contact.first_name} {reply.contact.last_name}
                </p>
                <p className="text-xs text-green-600">{reply.contact.email}</p>
              </div>
            )}

            <Separator />

            {/* Subject */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Subject</h3>
              <p className="text-lg font-medium text-gray-900">
                {reply.subject || '(No subject)'}
              </p>
            </div>

            {/* Body */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Message</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {reply.body_full || reply.body_preview || '(No content)'}
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
