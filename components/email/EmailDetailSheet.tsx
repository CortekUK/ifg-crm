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
  Mail,
  Calendar,
  User,
  Sparkles,
  MessageSquare,
  ExternalLink,
  Tag
} from 'lucide-react'
import { formatDateLong, formatRelativeTime } from '@/lib/utils/format'
import type { EmailReply, EmailIntent } from '@/lib/types/email'

interface EmailDetailSheetProps {
  reply: EmailReply | null
  isOpen: boolean
  onClose: () => void
}

const intentConfig: Record<EmailIntent, { label: string; className: string; icon: string }> = {
  positive: { label: 'Positive Intent', className: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700', icon: '✓' },
  negative: { label: 'Negative Intent', className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700', icon: '✗' },
  neutral: { label: 'Neutral', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600', icon: '—' },
  question: { label: 'Question', className: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700', icon: '?' },
  unknown: { label: 'Unknown', className: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600', icon: '?' },
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

  const isMatched = reply.match_status === 'auto_matched' || reply.match_status === 'manually_matched'

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
                Email Details
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                View full email content and metadata
              </p>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-6 space-y-6">
            {/* Sender Card */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12 ring-2 ring-white dark:ring-slate-700 shadow-sm">
                  <AvatarFallback className="bg-blue-500 text-white font-semibold">
                    {getInitials(reply.from_name, reply.from_email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white text-lg">
                    {reply.from_name || reply.from_email}
                  </p>
                  {reply.from_name && (
                    <p className="text-sm text-muted-foreground">
                      {reply.from_email}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatDateLong(reply.created_at)}</span>
                    <span className="text-slate-400 dark:text-slate-600">•</span>
                    <span>{formatRelativeTime(reply.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Classification */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase tracking-wide flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Classification
              </h3>
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${intentInfo.className}`}>
                <div className="h-10 w-10 rounded-full bg-white/50 dark:bg-black/20 flex items-center justify-center text-lg font-bold">
                  {intentInfo.icon}
                </div>
                <div>
                  <p className="font-semibold">{intentInfo.label}</p>
                  <p className="text-xs opacity-80">
                    {intent === 'positive' && 'This reply shows interest or positive sentiment'}
                    {intent === 'negative' && 'This reply indicates disinterest or negative sentiment'}
                    {intent === 'neutral' && 'This reply has neutral or unclear sentiment'}
                    {intent === 'question' && 'This reply contains a question requiring response'}
                    {intent === 'unknown' && 'Unable to determine sentiment'}
                  </p>
                </div>
              </div>
            </div>

            {/* Status & Campaign */}
            <div className="flex items-center gap-2 flex-wrap">
              {reply.match_status === 'auto_matched' && (
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                  Auto-matched
                </Badge>
              )}
              {reply.match_status === 'manually_matched' && (
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                  Manually matched
                </Badge>
              )}
              {reply.match_status === 'spam' && (
                <Badge variant="destructive">Spam</Badge>
              )}
              {reply.match_status === 'unmatched' && (
                <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700">
                  Unmatched
                </Badge>
              )}
              {reply.campaign && (
                <Badge variant="secondary" className="gap-1">
                  <Tag className="h-3 w-3" />
                  {reply.campaign.name}
                </Badge>
              )}
            </div>

            {/* Matched Contact */}
            {isMatched && reply.contact && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase tracking-wide flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Matched Contact
                </h3>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-green-500 text-white text-sm font-semibold">
                          {reply.contact.first_name?.[0]}{reply.contact.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-green-900 dark:text-green-100">
                          {reply.contact.first_name} {reply.contact.last_name}
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-400">
                          {reply.contact.email}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-green-700 dark:text-green-300 hover:text-green-800 hover:bg-green-100 dark:hover:bg-green-800/50">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Subject */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase tracking-wide flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Subject
              </h3>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {reply.subject || '(No subject)'}
              </p>
            </div>

            {/* Message Body */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase tracking-wide flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Message
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
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
