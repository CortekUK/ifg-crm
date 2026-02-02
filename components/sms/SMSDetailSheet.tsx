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
import { Phone } from 'lucide-react'
import { formatDateLong, formatRelativeTime, formatPhoneNumber } from '@/lib/utils/format'
import type { SMSMessage, SMSIntent } from '@/lib/types/sms'

interface SMSDetailSheetProps {
  message: SMSMessage | null
  isOpen: boolean
  onClose: () => void
}

const intentConfig: Record<SMSIntent, { label: string; className: string }> = {
  positive: { label: 'Positive', className: 'bg-green-100 text-green-700' },
  negative: { label: 'Negative', className: 'bg-red-100 text-red-700' },
  neutral: { label: 'Neutral', className: 'bg-gray-100 text-gray-700' },
  unknown: { label: 'Unknown', className: 'bg-gray-100 text-gray-500' },
}

export function SMSDetailSheet({
  message,
  isOpen,
  onClose,
}: SMSDetailSheetProps) {
  if (!message) return null

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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>SMS Details</SheetTitle>
          <SheetDescription>
            Full message content and metadata
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] pr-4">
          <div className="space-y-6 mt-6">
            {/* Sender Info */}
            <div className="flex items-start gap-4">
              {message.contact ? (
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    {getInitials(message.contact.first_name, message.contact.last_name)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-gray-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{displayName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatPhoneNumber(message.phone_number)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateLong(message.created_at)} ({formatRelativeTime(message.created_at)})
                </p>
              </div>
            </div>

            {/* Status Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={intentInfo.className}>{intentInfo.label}</Badge>
              {confidence !== null && (
                <span className="text-xs text-muted-foreground">
                  {confidence}% confident
                </span>
              )}
              {message.match_status === 'unmatched' && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Unmatched
                </Badge>
              )}
              {message.match_status === 'auto_matched' && (
                <Badge variant="outline">Auto-matched</Badge>
              )}
              {message.match_status === 'manually_matched' && (
                <Badge variant="outline">Manually matched</Badge>
              )}
              {message.match_status === 'spam' && (
                <Badge variant="destructive">Spam</Badge>
              )}
              {message.pipeline && (
                <Badge variant="secondary">{message.pipeline.name}</Badge>
              )}
            </div>

            {/* Matched Contact */}
            {message.contact && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-medium text-green-800 mb-1">
                  Matched to Contact
                </p>
                <p className="text-sm text-green-700">
                  {message.contact.first_name} {message.contact.last_name}
                </p>
                {message.contact.email && (
                  <p className="text-xs text-green-600">{message.contact.email}</p>
                )}
                {message.contact.phone && (
                  <p className="text-xs text-green-600">{formatPhoneNumber(message.contact.phone)}</p>
                )}
              </div>
            )}

            <Separator />

            {/* Message Content */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Message</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {message.content || '(No content)'}
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
