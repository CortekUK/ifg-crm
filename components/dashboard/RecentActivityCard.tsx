'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import {
  GitBranch,
  Mail,
  MessageSquare,
  FileText,
  CreditCard,
  UserPlus,
  Activity,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'

const activityIcons: Record<string, LucideIcon> = {
  stage_changed: GitBranch,
  email_sent: Mail,
  sms_sent: MessageSquare,
  deal_created: UserPlus,
  invoice_sent: FileText,
  payment_received: CreditCard,
  note_added: FileText,
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

export function RecentActivityCard() {
  const supabase = createClient()

  const { data: activities, isLoading } = useQuery({
    queryKey: ['recent-activities'],
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
        .limit(10)

      if (error) throw error
      return data as unknown as DealActivity[]
    },
    refetchInterval: 30000,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activities?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities?.map((activity) => {
              const Icon = activityIcons[activity.activity_type] || GitBranch
              const contactName = activity.deal?.contact
                ? `${activity.deal.contact.first_name} ${activity.deal.contact.last_name}`
                : activity.deal?.title || 'Unknown'

              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-muted">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{contactName}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.description ||
                        activity.activity_type.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
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
