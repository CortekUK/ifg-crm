'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Send, Mail, MessageSquare, Eye, TrendingUp, TrendingDown } from 'lucide-react'
import { formatNumber } from '@/lib/utils/format'
import type { Campaign } from '@/lib/types/campaigns'

interface CampaignStatsProps {
  campaigns: Campaign[]
  isLoading?: boolean
}

const colourConfig = {
  blue: {
    gradient: 'from-blue-50/60',
    border: 'border-l-blue-400',
    iconBg: 'bg-blue-100',
    iconColour: 'text-blue-600',
  },
  green: {
    gradient: 'from-green-50/60',
    border: 'border-l-green-400',
    iconBg: 'bg-green-100',
    iconColour: 'text-green-600',
  },
  purple: {
    gradient: 'from-purple-50/60',
    border: 'border-l-purple-400',
    iconBg: 'bg-purple-100',
    iconColour: 'text-purple-600',
  },
  orange: {
    gradient: 'from-orange-50/60',
    border: 'border-l-orange-400',
    iconBg: 'bg-orange-100',
    iconColour: 'text-orange-600',
  },
}

export function CampaignStats({ campaigns, isLoading }: CampaignStatsProps) {
  // Calculate stats
  const totalCampaigns = campaigns.length
  const emailCampaigns = campaigns.filter((c) => c.type === 'email')
  const smsCampaigns = campaigns.filter((c) => c.type === 'sms')
  
  // Placeholder values for sent counts (would come from campaign_recipients in real app)
  const emailsSent = emailCampaigns.filter((c) => c.status === 'sent').length * 1250
  const smsSent = smsCampaigns.filter((c) => c.status === 'sent').length * 850
  const avgOpenRate = 24.5 // Placeholder

  const stats = [
    {
      label: 'Total Campaigns',
      value: formatNumber(totalCampaigns),
      icon: Send,
      colour: 'blue' as const,
      trend: 12,
    },
    {
      label: 'Emails Sent',
      value: formatNumber(emailsSent),
      icon: Mail,
      colour: 'green' as const,
      trend: 8,
    },
    {
      label: 'SMS Sent',
      value: formatNumber(smsSent),
      icon: MessageSquare,
      colour: 'purple' as const,
      trend: 15,
    },
    {
      label: 'Avg Open Rate',
      value: `${avgOpenRate}%`,
      icon: Eye,
      colour: 'orange' as const,
      trend: 3,
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const config = colourConfig[stat.colour]
          return (
            <Card key={i} className={cn(
              'relative overflow-hidden bg-white border border-slate-200 shadow-sm border-l-4',
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
        const isPositive = stat.trend > 0
        return (
          <Card key={stat.label} className={cn(
            'relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow transition-shadow border-l-4',
            config.border
          )}>
            <div className={cn(
              'absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent pointer-events-none',
              config.gradient
            )} />
            <CardContent className="relative z-10 p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="font-oswald text-xs font-medium text-blue-900 uppercase">
                  {stat.label}
                </p>
                <div className={cn('p-2.5 rounded-full', config.iconBg)}>
                  <Icon className={cn('h-5 w-5', config.iconColour)} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              <div className="flex items-center gap-1.5 text-sm mt-2">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                  {isPositive && '+'}{stat.trend}%
                </span>
                <span className="text-gray-400">vs last month</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
