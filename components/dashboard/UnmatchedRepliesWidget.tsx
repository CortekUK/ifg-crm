'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, Mail, ArrowRight, User } from 'lucide-react'

interface SMSMessage {
  id: string
  phone_number: string
  content: string
  created_at: string
}

interface EmailReply {
  id: string
  from_email: string
  from_name: string | null
  subject: string
  body_preview: string
  created_at: string
}

interface UnmatchedRepliesWidgetProps {
  type: 'sms' | 'email'
}

export function UnmatchedRepliesWidget({ type }: UnmatchedRepliesWidgetProps) {
  const supabase = createClient()

  const { data, isLoading, error } = useQuery({
    queryKey: [`unmatched-${type}-preview`],
    queryFn: async () => {
      if (type === 'sms') {
        const { data: messages, error: msgError } = await supabase
          .from('sms_messages')
          .select('id, phone_number, content, created_at')
          .eq('match_status', 'unmatched')
          .eq('direction', 'inbound')
          .order('created_at', { ascending: false })
          .limit(3)

        if (msgError) {
          console.error('SMS fetch error:', msgError)
          throw msgError
        }
        
        const { count, error: countError } = await supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('match_status', 'unmatched')
          .eq('direction', 'inbound')

        if (countError) {
          console.error('SMS count error:', countError)
        }

        return { messages: (messages || []) as SMSMessage[], count: count || 0 }
      } else {
        const { data: emails, error: emailError } = await supabase
          .from('email_replies')
          .select('id, from_email, from_name, subject, body_preview, created_at')
          .eq('match_status', 'unmatched')
          .order('created_at', { ascending: false })
          .limit(3)

        if (emailError) {
          console.error('Email fetch error:', emailError)
          throw emailError
        }

        const { count, error: countError } = await supabase
          .from('email_replies')
          .select('*', { count: 'exact', head: true })
          .eq('match_status', 'unmatched')

        if (countError) {
          console.error('Email count error:', countError)
        }

        return { messages: (emails || []) as EmailReply[], count: count || 0 }
      }
    },
    refetchInterval: 30000,
  })

  const Icon = type === 'sms' ? MessageSquare : Mail
  const title = type === 'sms' ? 'UNMATCHED SMS REPLIES' : 'UNMATCHED EMAIL REPLIES'
  const subtitle = type === 'sms' 
    ? 'Recent messages awaiting response.' 
    : 'Recent emails awaiting response.'
  const linkHref = type === 'sms' ? '/sms-replies' : '/email-replies'

  // Show error state
  if (error) {
    return (
      <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-50 to-transparent pointer-events-none" />
        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-slate-100">
              <Icon className="h-4 w-4 text-slate-600" />
            </div>
            <CardTitle className="font-oswald text-sm font-medium text-blue-900 uppercase">
              {title}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 pt-0">
          <p className="text-sm text-red-500">Failed to load data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
      {/* Subtle gradient overlay from top */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-50 to-transparent pointer-events-none" />
      
      <CardHeader className="relative z-10 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-100">
              <Icon className="h-4 w-4 text-orange-600" />
            </div>
            <CardTitle className="font-oswald text-sm font-medium text-blue-900 uppercase">
              {title}
            </CardTitle>
            {data && data.count > 0 && (
              <span className="px-2.5 py-1 text-xs font-semibold bg-red-500 text-white rounded-full uppercase">
                {data.count} TO REVIEW
              </span>
            )}
          </div>
          <Link href={linkHref}>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">
              Review Replies
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </CardHeader>
      <CardContent className="relative z-10 pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-100">
                <div className="flex justify-between mb-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-7 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : !data || data.messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="p-3 rounded-full bg-slate-100 inline-block mb-2">
              <Icon className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm">No unmatched replies</p>
          </div>
        ) : (
          <div className="space-y-3">
            {type === 'sms' ? (
              // SMS Messages
              (data.messages as SMSMessage[]).map((message) => (
                <div
                  key={message.id}
                  className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 hover:border-slate-200 dark:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-full bg-slate-100">
                        <User className="h-3 w-3 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
                          Unknown number
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {message.phone_number}
                        </p>
                      </div>
                    </div>
                    <Link href={linkHref}>
                      <Button variant="outline" size="sm" className="text-xs h-7 shrink-0">
                        Match
                      </Button>
                    </Link>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {message.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))
            ) : (
              // Email Replies
              (data.messages as EmailReply[]).map((email) => (
                <div
                  key={email.id}
                  className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 hover:border-slate-200 dark:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-full bg-slate-100">
                        <User className="h-3 w-3 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
                          {email.from_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {email.from_email}
                        </p>
                      </div>
                    </div>
                    <Link href={linkHref}>
                      <Button variant="outline" size="sm" className="text-xs h-7 shrink-0">
                        Match
                      </Button>
                    </Link>
                  </div>
                  <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
                    {email.subject}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {email.body_preview}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(email.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
