'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Mail, ArrowRight } from 'lucide-react'

interface FollowUpsWidgetProps {
  type: 'sms' | 'email'
}

export function FollowUpsWidget({ type }: FollowUpsWidgetProps) {
  const supabase = createClient()

  const { data: count, isLoading, error } = useQuery({
    queryKey: [`followups-${type}`],
    queryFn: async () => {
      if (type === 'sms') {
        // Count SMS messages that need follow-up (status is 'open')
        const { count, error } = await supabase
          .from('sms_messages')
          .select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound')
          .eq('follow_up_status', 'open')

        if (error) {
          console.error('SMS follow-up count error:', error)
          throw error
        }

        return count || 0
      } else {
        // Count email replies that need follow-up (status is 'open')
        const { count, error } = await supabase
          .from('email_replies')
          .select('*', { count: 'exact', head: true })
          .eq('follow_up_status', 'open')

        if (error) {
          console.error('Email follow-up count error:', error)
          throw error
        }

        return count || 0
      }
    },
    refetchInterval: 30000,
  })

  const Icon = type === 'sms' ? MessageSquare : Mail
  const title = type === 'sms' ? 'SMS FOLLOW-UPS NEEDED' : 'EMAIL FOLLOW-UPS NEEDED'
  const subtitle = type === 'sms'
    ? 'SMS replies with open follow-up tasks.'
    : 'Email replies with open follow-up tasks.'
  const linkHref = type === 'sms' ? '/sms-replies?status=open' : '/email-replies?status=open'

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden bg-white border border-slate-200 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-50 to-transparent pointer-events-none" />
        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <Skeleton className="h-4 w-full mb-4" />
          <Skeleton className="h-9 w-40" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="relative overflow-hidden bg-white border border-slate-200 shadow-sm">
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
    <Card className="relative overflow-hidden bg-white border border-slate-200 shadow-sm">
      {/* Subtle gradient overlay from top */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-50 to-transparent pointer-events-none" />
      
      <CardHeader className="relative z-10 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-amber-100">
            <Icon className="h-4 w-4 text-amber-600" />
          </div>
          <CardTitle className="font-oswald text-sm font-medium text-blue-900 uppercase">
            {title}
          </CardTitle>
          {count !== undefined && count > 0 && (
            <span className="px-2.5 py-1 text-xs font-semibold bg-amber-500 text-white rounded-full uppercase">
              {count} OPEN
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative z-10 pt-0">
        <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>
        <Link href={linkHref}>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
            View open follow-ups
            <ArrowRight className="h-3 w-3 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
