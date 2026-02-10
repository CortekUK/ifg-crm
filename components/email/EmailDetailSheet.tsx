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
import { Separator } from '@/components/ui/separator'
import {
  Mail,
  ExternalLink,
  Tag,
  GitBranch,
  Sparkles,
} from 'lucide-react'
import { formatDateLong, formatRelativeTime } from '@/lib/utils/format'
import type { EmailReply, EmailIntent } from '@/lib/types/email'

interface EmailDetailSheetProps {
  reply: EmailReply | null
  isOpen: boolean
  onClose: () => void
}

const intentConfig: Record<EmailIntent, { label: string; color: string }> = {
  positive: { label: 'Positive', color: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700' },
  negative: { label: 'Negative', color: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700' },
  neutral: { label: 'Neutral', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600' },
  question: { label: 'Question', color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700' },
  unknown: { label: 'Unknown', color: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600' },
}

const statusConfig: Record<string, { label: string; className: string }> = {
  auto_matched: { label: 'Auto-matched', className: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700' },
  manually_matched: { label: 'Manually matched', className: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700' },
  spam: { label: 'Spam', className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700' },
  unmatched: { label: 'Unmatched', className: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700' },
}

export function EmailDetailSheet({
  reply,
  isOpen,
  onClose,
}: EmailDetailSheetProps) {
  if (!reply) return null

  const intent = reply.ai_intent || 'unknown'
  const intentInfo = intentConfig[intent]
  const status = statusConfig[reply.match_status] || statusConfig.unmatched

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
        {/* Header with sender info */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-start gap-3">
            <Avatar className="h-11 w-11 ring-2 ring-white dark:ring-slate-700 shadow-sm">
              <AvatarFallback className="bg-blue-500 text-white font-semibold text-sm">
                {getInitials(reply.from_name, reply.from_email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold text-gray-900 dark:text-white truncate">
                {reply.from_name || reply.from_email}
              </SheetTitle>
              {reply.from_name && (
                <p className="text-sm text-muted-foreground truncate">
                  {reply.from_email}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {formatDateLong(reply.created_at)} ({formatRelativeTime(reply.created_at)})
              </p>
            </div>
          </div>
          {/* Status badges row */}
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <Badge variant="outline" className={status.className}>
              {status.label}
            </Badge>
            <Badge variant="outline" className={intentInfo.color}>
              <Sparkles className="h-3 w-3 mr-1" />
              {intentInfo.label}
            </Badge>
            {reply.campaign && (
              <Badge variant="secondary" className="gap-1">
                <Tag className="h-3 w-3" />
                {reply.campaign.name}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-5">
            {/* Subject + Message Content - most important, shown first */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Subject</h3>
              <p className="text-base font-medium text-gray-900 dark:text-white mb-4">
                {reply.subject || '(No subject)'}
              </p>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Message</h3>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {reply.body_preview || '(No content)'}
                </p>
              </div>
            </div>

            <Separator />

            {/* Details Grid */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Details</h3>
              <div className="space-y-3">
                {/* Pipeline */}
                {reply.campaign?.pipeline && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-muted-foreground shrink-0">Pipeline</span>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{reply.campaign.pipeline.name}</span>
                      </div>
                      {reply.campaign.pipeline.programme && (
                        <p className="text-xs text-muted-foreground mt-0.5">{reply.campaign.pipeline.programme.name}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Campaign */}
                {reply.campaign && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Campaign</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{reply.campaign.name}</span>
                  </div>
                )}

                {/* Contact match */}
                {isMatched && reply.contact && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Matched Contact</span>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-green-500 text-white text-[10px] font-semibold">
                          {reply.contact.first_name?.[0]}{reply.contact.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {reply.contact.first_name} {reply.contact.last_name}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Contact email */}
                {isMatched && reply.contact?.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Contact Email</span>
                    <span className="text-sm text-gray-900 dark:text-white">{reply.contact.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
