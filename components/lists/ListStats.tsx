'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { ListIcon, Users, Crown } from 'lucide-react'
import { formatNumber } from '@/lib/utils/format'

interface ListStatsProps {
  totalLists: number
  totalContacts: number
  largestListName: string
  largestListCount: number
  isLoading: boolean
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
  amber: {
    gradient: 'from-amber-50/60 dark:from-amber-950/60',
    border: 'border-l-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    iconColour: 'text-amber-600 dark:text-amber-400',
  },
}

export function ListStats({
  totalLists,
  totalContacts,
  largestListName,
  largestListCount,
  isLoading,
}: ListStatsProps) {
  const stats = [
    {
      label: 'Total Lists',
      value: totalLists,
      icon: ListIcon,
      colour: 'blue' as const,
    },
    {
      label: 'Total Contacts in Lists',
      value: totalContacts,
      icon: Users,
      colour: 'green' as const,
    },
    {
      label: 'Largest List',
      value: largestListCount,
      subtitle: largestListName || 'None',
      icon: Crown,
      colour: 'amber' as const,
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
                <Skeleton className="h-9 w-16" />
                {stat.subtitle && <Skeleton className="h-4 w-32 mt-1" />}
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatNumber(stat.value)}
              </p>
              {stat.subtitle && (
                <p className="text-sm text-muted-foreground mt-1 truncate" title={stat.subtitle}>
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
