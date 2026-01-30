'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Users, UserPlus, Mail, UserCheck } from 'lucide-react'
import { formatNumber } from '@/lib/utils/format'

interface ContactStatsProps {
  totalContacts: number
  newThisMonth: number
  subscribed: number
  withDeals: number
  isLoading: boolean
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

export function ContactStats({
  totalContacts,
  newThisMonth,
  subscribed,
  withDeals,
  isLoading,
}: ContactStatsProps) {
  const stats = [
    {
      label: 'Total Contacts',
      value: totalContacts,
      icon: Users,
      colour: 'blue' as const,
    },
    {
      label: 'New This Month',
      value: newThisMonth,
      icon: UserPlus,
      colour: 'green' as const,
    },
    {
      label: 'Subscribed',
      value: subscribed,
      icon: Mail,
      colour: 'purple' as const,
    },
    {
      label: 'With Active Deals',
      value: withDeals,
      icon: UserCheck,
      colour: 'orange' as const,
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
                <Skeleton className="h-9 w-16" />
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        const config = colourConfig[stat.colour]
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
              <p className="text-3xl font-bold text-gray-900">
                {formatNumber(stat.value)}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
