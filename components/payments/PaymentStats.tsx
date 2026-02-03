'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { PoundSterling, Clock, XCircle, TrendingUp } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils/format'

interface PaymentStatsProps {
  totalReceived: number
  pending: number
  failedCount: number
  avgTransaction: number
  isLoading?: boolean
}

const colourConfig = {
  green: {
    gradient: 'from-green-50/60 dark:from-green-950/60',
    border: 'border-l-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/50',
    iconColour: 'text-green-600 dark:text-green-400',
  },
  orange: {
    gradient: 'from-orange-50/60 dark:from-orange-950/60',
    border: 'border-l-orange-400',
    iconBg: 'bg-orange-100 dark:bg-orange-900/50',
    iconColour: 'text-orange-600 dark:text-orange-400',
  },
  red: {
    gradient: 'from-red-50/60 dark:from-red-950/60',
    border: 'border-l-red-400',
    iconBg: 'bg-red-100 dark:bg-red-900/50',
    iconColour: 'text-red-600 dark:text-red-400',
  },
  blue: {
    gradient: 'from-blue-50/60 dark:from-blue-950/60',
    border: 'border-l-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    iconColour: 'text-blue-600 dark:text-blue-400',
  },
}

export function PaymentStats({
  totalReceived,
  pending,
  failedCount,
  avgTransaction,
  isLoading,
}: PaymentStatsProps) {
  const stats = [
    {
      label: 'Total Received',
      value: formatCurrency(totalReceived),
      icon: PoundSterling,
      colour: 'green' as const,
    },
    {
      label: 'Pending',
      value: formatCurrency(pending),
      icon: Clock,
      colour: 'orange' as const,
    },
    {
      label: 'Failed',
      value: formatNumber(failedCount),
      icon: XCircle,
      colour: 'red' as const,
    },
    {
      label: 'Avg Transaction',
      value: formatCurrency(avgTransaction),
      icon: TrendingUp,
      colour: 'blue' as const,
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
                <Skeleton className="h-9 w-24" />
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
                <p className="font-oswald text-xs font-medium text-blue-900 dark:text-blue-100 uppercase">
                  {stat.label}
                </p>
                <div className={cn('p-2.5 rounded-full', config.iconBg)}>
                  <Icon className={cn('h-5 w-5', config.iconColour)} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
