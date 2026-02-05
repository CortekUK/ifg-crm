'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Send, Mail, MessageSquare, Eye } from 'lucide-react'
import { formatNumber } from '@/lib/utils/format'
import type { Campaign } from '@/lib/types/campaigns'

interface CampaignStatsProps {
  campaigns: Campaign[]
  isLoading?: boolean
}

interface StatItem {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  colour: 'blue' | 'green' | 'purple' | 'orange'
  subtitle?: string
}

const colourConfig = {
  blue: {
    gradient: 'from-blue-50/60 dark:from-blue-950/60',
    border: 'border-l-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    iconColour: 'text-blue-600 dark:text-blue-400',
  },
  green: {
    gradient: 'from-green-50/60 dark:from-green-950/60',
    border: 'border-l-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/50',
    iconColour: 'text-green-600 dark:text-green-400',
  },
  purple: {
    gradient: 'from-purple-50/60 dark:from-purple-950/60',
    border: 'border-l-purple-400',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50',
    iconColour: 'text-purple-600 dark:text-purple-400',
  },
  orange: {
    gradient: 'from-orange-50/60 dark:from-orange-950/60',
    border: 'border-l-orange-400',
    iconBg: 'bg-orange-100 dark:bg-orange-900/50',
    iconColour: 'text-orange-600 dark:text-orange-400',
  },
}

export function CampaignStats({ campaigns, isLoading }: CampaignStatsProps) {
  // Calculate stats from campaigns data
  const totalCampaigns = campaigns.length
  const sentCampaigns = campaigns.filter((c) => c.status === 'sent')
  const scheduledCampaigns = campaigns.filter((c) => c.status === 'scheduled')
  const draftCampaigns = campaigns.filter((c) => c.status === 'draft')
  
  // Calculate total recipients from sent campaigns
  const totalRecipients = sentCampaigns.reduce((sum, c) => {
    const listRecipients = c.recipient_lists?.reduce((s, l) => s + (l.contact_count || 0), 0) || 0
    return sum + (c.recipient_count || listRecipients)
  }, 0)
  
  // Calculate average open rate from campaigns with stats
  const campaignsWithStats = sentCampaigns.filter(c => c.open_count !== undefined && c.delivered_count)
  const avgOpenRate = campaignsWithStats.length > 0
    ? campaignsWithStats.reduce((sum, c) => {
        const rate = (c.open_count! / (c.delivered_count || 1)) * 100
        return sum + rate
      }, 0) / campaignsWithStats.length
    : 0

  const stats = [
    {
      label: 'Total Campaigns',
      value: formatNumber(totalCampaigns),
      icon: Send,
      colour: 'blue' as const,
      subtitle: `${sentCampaigns.length} sent, ${scheduledCampaigns.length} scheduled`,
    },
    {
      label: 'Sent This Month',
      value: formatNumber(sentCampaigns.length),
      icon: Mail,
      colour: 'green' as const,
      subtitle: `${formatNumber(totalRecipients)} total recipients`,
    },
    {
      label: 'Drafts',
      value: formatNumber(draftCampaigns.length),
      icon: MessageSquare,
      colour: 'purple' as const,
      subtitle: 'Awaiting completion',
    },
    {
      label: 'Avg Open Rate',
      value: avgOpenRate > 0 ? `${avgOpenRate.toFixed(1)}%` : '-',
      icon: Eye,
      colour: 'orange' as const,
      subtitle: campaignsWithStats.length > 0 ? `From ${campaignsWithStats.length} campaigns` : 'No data yet',
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const config = colourConfig[stat.colour]
          return (
            <Card key={i} className={cn(
              'relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm border-l-4',
              config.border
            )}>
              <div className={cn(
                'absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent pointer-events-none',
                config.gradient
              )} />
              <CardContent className="relative z-10 p-5">
                <div className="flex items-start justify-between mb-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-4 w-32 mt-2" />
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        const config = colourConfig[stat.colour]
        return (
          <Card key={stat.label} className={cn(
            'relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow transition-shadow border-l-4',
            config.border
          )}>
            <div className={cn(
              'absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent pointer-events-none',
              config.gradient
            )} />
            <CardContent className="relative z-10 p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="font-oswald text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  {stat.label}
                </p>
                <div className={cn('p-2.5 rounded-full', config.iconBg)}>
                  <Icon className={cn('h-5 w-5', config.iconColour)} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              {stat.subtitle && (
                <p className="text-sm text-muted-foreground mt-2">
                  {stat.subtitle}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
