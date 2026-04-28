'use client'

import { useState } from 'react'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  ExternalLink,
  Tag,
  GitBranch,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  Edit3,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'
import { formatDateLong, formatRelativeTime } from '@/lib/utils/format'
import { trimQuotedContent } from '@/lib/utils/trimQuotedContent'
import type { EmailReply, EmailIntent } from '@/lib/types/email'

interface EmailDetailSheetProps {
  reply: EmailReply | null
  isOpen: boolean
  onClose: () => void
}

// 'unknown' is intentionally absent — when the AI couldn't classify a reply we
// show no intent badge at all rather than a meaningless pill.
const intentConfig: Record<Exclude<EmailIntent, 'unknown'>, { label: string; color: string }> = {
  positive: { label: 'Positive', color: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700' },
  negative: { label: 'Negative', color: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700' },
  neutral: { label: 'Neutral', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600' },
  question: { label: 'Question', color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700' },
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
  const router = useRouter()
  const [showFullThread, setShowFullThread] = useState(false)
  const queryClient = useQueryClient()

  // Manual override — admin can correct the AI label when classification is
  // wrong. Writes directly to email_replies.ai_intent and invalidates the list
  // so chips/counts update immediately.
  const updateIntent = useMutation({
    mutationFn: async ({ id, intent }: { id: string; intent: EmailIntent | null }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('email_replies')
        .update({ ai_intent: intent })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-replies'] })
      queryClient.invalidateQueries({ queryKey: ['email-reply-counts'] })
    },
  })

  if (!reply) return null

  const intent = reply.ai_intent as EmailIntent | null
  const intentInfo = intent && intent !== 'unknown' ? intentConfig[intent] : null
  const status = statusConfig[reply.match_status] || statusConfig.unmatched

  const handleSetIntent = async (next: EmailIntent | null) => {
    try {
      await updateIntent.mutateAsync({ id: reply.id, intent: next })
      toast({ title: 'Intent updated' })
    } catch (err) {
      toast({
        title: 'Failed to update intent',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  // What the contact actually wrote — quoted history stripped so a reader
  // doesn't have to scroll past the original outbound email to find the reply.
  const trimmedReply = trimQuotedContent(reply.body || reply.body_preview || '')
  const fullText = (reply.body || reply.body_preview || '').trim()
  const hasTrimmedContent = trimmedReply.length > 0 && trimmedReply !== fullText
  const hasFullThread = !!reply.html_body || (fullText.length > 0 && fullText !== trimmedReply)

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
                {formatDateLong(reply.received_at || reply.created_at)} ({formatRelativeTime(reply.received_at || reply.created_at)})
              </p>
            </div>
          </div>
          {/* Status badges row */}
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <Badge variant="outline" className={status.className}>
              {status.label}
            </Badge>
            {/* Intent — clickable popover lets admin override the AI label.
                Always shown so an unclassified reply can also be set manually. */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full"
                  title="Click to override the AI intent label"
                >
                  {intentInfo ? (
                    <Badge variant="outline" className={`${intentInfo.color} cursor-pointer hover:opacity-80`}>
                      <Sparkles className="h-3 w-3 mr-1" />
                      {intentInfo.label}
                      <Edit3 className="h-2.5 w-2.5 ml-1 opacity-60" />
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="cursor-pointer hover:opacity-80 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Set intent
                      <Edit3 className="h-2.5 w-2.5 ml-1 opacity-60" />
                    </Badge>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-1">
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Override intent
                </div>
                {(['positive', 'question', 'negative', 'neutral'] as const).map((opt) => {
                  const cfg = intentConfig[opt]
                  const isCurrent = intent === opt
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={updateIntent.isPending}
                      onClick={() => handleSetIntent(opt)}
                      className="w-full flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-left disabled:opacity-50"
                    >
                      <Badge variant="outline" className={cfg.color}>
                        {cfg.label}
                      </Badge>
                      {isCurrent && <Check className="h-3.5 w-3.5 text-green-600" />}
                    </button>
                  )
                })}
                <div className="border-t my-1 dark:border-slate-700" />
                <button
                  type="button"
                  disabled={updateIntent.isPending}
                  onClick={() => handleSetIntent(null)}
                  className="w-full flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-muted-foreground disabled:opacity-50"
                >
                  Clear intent
                  {intent === null && <Check className="h-3.5 w-3.5 text-green-600" />}
                </button>
              </PopoverContent>
            </Popover>
            {reply.campaign && (
              <Badge variant="secondary" className="gap-1">
                <Tag className="h-3 w-3" />
                {reply.campaign.name}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* min-h-0 is required for ScrollArea to shrink below its content
            inside flex-col — without it the area grows past the viewport
            and the page becomes unscrollable. */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-5">
            {/* Subject + Message Content - most important, shown first */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Subject</h3>
              <p className="text-base font-medium text-gray-900 dark:text-white mb-4">
                {reply.subject || '(No subject)'}
              </p>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Message</h3>
                {hasFullThread && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFullThread((v) => !v)}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showFullThread ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5 mr-1" /> Hide full thread
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5 mr-1" /> Show full thread
                      </>
                    )}
                  </Button>
                )}
              </div>
              {showFullThread && reply.html_body ? (
                <iframe
                  title="Email body"
                  sandbox=""
                  srcDoc={reply.html_body}
                  className="w-full min-h-[400px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
                />
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {(showFullThread ? fullText : trimmedReply) || '(No content)'}
                  </p>
                  {!showFullThread && hasTrimmedContent && (
                    <p className="mt-3 text-[11px] text-muted-foreground italic">
                      Quoted history hidden — click <span className="font-medium">Show full thread</span> to expand.
                    </p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Details Grid */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Details</h3>
              <div className="space-y-3">
                {/* Pipeline — prefer the direct join, fall back to the
                    campaign's pipeline for legacy rows. */}
                {(() => {
                  const pipeline = reply.pipeline ?? reply.campaign?.pipeline ?? null
                  if (!pipeline) return null
                  return (
                    <div className="flex items-start justify-between">
                      <span className="text-sm text-muted-foreground shrink-0">Pipeline</span>
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{pipeline.name}</span>
                        </div>
                        {pipeline.programme && (
                          <p className="text-xs text-muted-foreground mt-0.5">{pipeline.programme.name}</p>
                        )}
                      </div>
                    </div>
                  )
                })()}

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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => router.push(`/contacts?id=${reply.contact!.id}`)}
                      >
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
