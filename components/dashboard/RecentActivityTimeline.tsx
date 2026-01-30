'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import {
  Clock,
  GitBranch,
  Mail,
  MessageSquare,
  FileText,
  CreditCard,
  UserPlus,
  Activity,
  RefreshCw,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'

const activityConfig: Record<string, { icon: LucideIcon; bgColour: string; iconColour: string; label: string }> = {
  deal_created: { icon: UserPlus, bgColour: 'bg-blue-100', iconColour: 'text-blue-600', label: 'New player added' },
  stage_changed: { icon: RefreshCw, bgColour: 'bg-purple-100', iconColour: 'text-purple-600', label: 'Player status changed' },
  email_sent: { icon: Mail, bgColour: 'bg-green-100', iconColour: 'text-green-600', label: 'Email sent' },
  sms_sent: { icon: MessageSquare, bgColour: 'bg-teal-100', iconColour: 'text-teal-600', label: 'SMS sent' },
  invoice_sent: { icon: FileText, bgColour: 'bg-orange-100', iconColour: 'text-orange-600', label: 'Invoice reminder delivered' },
  payment_received: { icon: CreditCard, bgColour: 'bg-emerald-100', iconColour: 'text-emerald-600', label: 'Payment received' },
  note_added: { icon: FileText, bgColour: 'bg-slate-100', iconColour: 'text-slate-600', label: 'Note added' },
}

interface DealActivity {
  id: string
  activity_type: string
  description: string | null
  created_at: string
  deal: {
    title: string
    contact: {
      first_name: string
      last_name: string
    } | null
  } | null
  performed_by: {
    full_name: string | null
  } | null
}

export function RecentActivityTimeline() {
  const supabase = createClient()

  const { data: activities, isLoading } = useQuery({
    queryKey: ['recent-activities-timeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_activities')
        .select(
          `
          id,
          activity_type,
          description,
          created_at,
          deal:deals(title, contact:contacts(first_name, last_name)),
          performed_by:profiles(full_name)
        `
        )
        .order('created_at', { ascending: false })
        .limit(8)

      if (error) throw error
      return data as unknown as DealActivity[]
    },
    refetchInterval: 30000,
  })

  return (
    <Card className="relative overflow-hidden bg-white border border-slate-200 shadow-sm">
      {/* Subtle gradient overlay from top */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-50 to-transparent pointer-events-none" />
      
      <CardHeader className="relative z-10 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-blue-100">
            <Clock className="h-4 w-4 text-blue-600" />
          </div>
          <CardTitle className="font-oswald text-sm font-medium text-blue-900 uppercase">
            RECENT ACTIVITY
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Latest updates from your CRM
        </p>
      </CardHeader>
      <CardContent className="relative z-10 pt-0">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : activities?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="p-3 rounded-full bg-slate-100 inline-block mb-2">
              <Activity className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities?.map((activity) => {
              const config = activityConfig[activity.activity_type] || {
                icon: GitBranch,
                bgColour: 'bg-slate-100',
                iconColour: 'text-slate-600',
                label: activity.activity_type.replace(/_/g, ' '),
              }
              const Icon = config.icon
              const contactName = activity.deal?.contact
                ? `${activity.deal.contact.first_name} ${activity.deal.contact.last_name}`
                : activity.deal?.title || 'Unknown'

              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${config.bgColour} shrink-0`}>
                    <Icon className={`h-4 w-4 ${config.iconColour}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{config.label}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {activity.description || contactName}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {formatDistanceToNow(new Date(activity.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
