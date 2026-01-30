'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Zap, Play, Pause, CheckCircle } from 'lucide-react'
import { formatNumber } from '@/lib/utils/format'

interface AutomationStatsProps {
  totalAutomations: number
  active: number
  paused: number
  runsThisMonth: number
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
  orange: {
    gradient: 'from-orange-50/60',
    border: 'border-l-orange-400',
    iconBg: 'bg-orange-100',
    iconColour: 'text-orange-600',
  },
  purple: {
    gradient: 'from-purple-50/60',
    border: 'border-l-purple-400',
    iconBg: 'bg-purple-100',
    iconColour: 'text-purple-600',
  },
}

export function AutomationStats({
  totalAutomations,
  active,
  paused,
  runsThisMonth,
  isLoading,
}: AutomationStatsProps) {
  const stats = [
    {
      label: 'Total Automations',
      value: totalAutomations,
      icon: Zap,
      colour: 'blue' as const,
    },
    {
      label: 'Active',
      value: active,
      icon: Play,
      colour: 'green' as const,
    },
    {
      label: 'Paused',
      value: paused,
      icon: Pause,
      colour: 'orange' as const,
    },
    {
      label: 'Runs This Month',
      value: runsThisMonth,
      icon: CheckCircle,
      colour: 'purple' as const,
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
