'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  MessageSquare,
  Calendar,
  User,
  Sparkles,
  Phone,
  ExternalLink,
  Tag,
  GitBranch,
  Target,
} from 'lucide-react'
import { formatDateLong, formatRelativeTime, formatPhoneNumber } from '@/lib/utils/format'
import type { SMSMessage, SMSIntent } from '@/lib/types/sms'

interface SMSDetailSheetProps {
  message: SMSMessage | null
  isOpen: boolean
  onClose: () => void
}

const intentConfig: Record<SMSIntent, { label: string; className: string; icon: string }> = {
  positive: { label: 'Positive Intent', className: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700', icon: '✓' },
  negative: { label: 'Negative Intent', className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700', icon: '✗' },
  neutral: { label: 'Neutral', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600', icon: '—' },
  question: { label: 'Question', className: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700', icon: '?' },
  unknown: { label: 'Unknown', className: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600', icon: '?' },
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

  const isMatched = message.match_status === 'auto_matched' || message.match_status === 'manually_matched'

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-100 dark:bg-purple-900/50">
              <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
                SMS Details
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                View full message content and metadata
              </p>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-6 space-y-6">
            {/* Sender Card */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-4">
                {message.contact ? (
                  <Avatar className="h-12 w-12 ring-2 ring-white dark:ring-slate-700 shadow-sm">
                    <AvatarFallback className="bg-purple-500 text-white font-semibold">
                      {getInitials(message.contact.first_name, message.contact.last_name)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center ring-2 ring-white dark:ring-slate-700 shadow-sm">
                    <Phone className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white text-lg">
                    {displayName}
                  </p>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{formatPhoneNumber(message.phone_number)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatDateLong(message.created_at)}</span>
                    <span className="text-slate-400 dark:text-slate-600">•</span>
                    <span>{formatRelativeTime(message.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Classification */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100 uppercase tracking-wide flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Classification
              </h3>
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${intentInfo.className}`}>
                <div className="h-10 w-10 rounded-full bg-white/50 dark:bg-black/20 flex items-center justify-center text-lg font-bold">
                  {intentInfo.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{intentInfo.label}</p>
                    {confidence !== null && (
                      <span className="text-xs opacity-70">({confidence}% confident)</span>
                    )}
                  </div>
                  <p className="text-xs opacity-80">
                    {intent === 'positive' && 'This message shows interest or positive sentiment'}
                    {intent === 'negative' && 'This message indicates disinterest or negative sentiment'}
                    {intent === 'neutral' && 'This message has neutral or unclear sentiment'}
                    {intent === 'question' && 'This message contains a question requiring response'}
                    {intent === 'unknown' && 'Unable to determine sentiment'}
                  </p>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 flex-wrap">
              {message.match_status === 'auto_matched' && (
                <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700">
                  Auto-matched
                </Badge>
              )}
              {message.match_status === 'manually_matched' && (
                <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700">
                  Manually matched
                </Badge>
              )}
              {message.match_status === 'spam' && (
                <Badge variant="destructive">Spam</Badge>
              )}
              {message.match_status === 'unmatched' && (
                <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700">
                  Unmatched
                </Badge>
              )}
            </div>

            {/* Pipeline Info */}
            {message.pipeline && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100 uppercase tracking-wide flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Programme Pipeline
                </h3>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-800/50 flex items-center justify-center">
                      <GitBranch className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-purple-900 dark:text-purple-100">
                        {message.pipeline.name}
                      </p>
                      {message.pipeline.programme && (
                        <p className="text-sm text-purple-700 dark:text-purple-400">
                          Programme: {message.pipeline.programme.name}
                        </p>
                      )}
                      <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-1">
                        Use Smart Process to create deals from this reply
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Matched Contact */}
            {isMatched && message.contact && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100 uppercase tracking-wide flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Matched Contact
                </h3>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-green-500 text-white text-sm font-semibold">
                          {message.contact.first_name?.[0]}{message.contact.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-green-900 dark:text-green-100">
                          {message.contact.first_name} {message.contact.last_name}
                        </p>
                        {message.contact.email && (
                          <p className="text-sm text-green-700 dark:text-green-400">
                            {message.contact.email}
                          </p>
                        )}
                        {message.contact.phone && (
                          <p className="text-sm text-green-700 dark:text-green-400">
                            {formatPhoneNumber(message.contact.phone)}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-green-700 dark:text-green-300 hover:text-green-800 hover:bg-green-100 dark:hover:bg-green-800/50">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Message Body */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100 uppercase tracking-wide flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Message
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
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
