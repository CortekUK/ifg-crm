'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: number
  trendLabel?: string
  subtitle?: string
  colour?: 'blue' | 'orange' | 'green' | 'purple' | 'red' | 'teal'
  isLoading?: boolean
}

const colourConfig = {
  blue: {
    border: 'border-l-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    iconColour: 'text-blue-600 dark:text-blue-400',
  },
  orange: {
    border: 'border-l-orange-400',
    iconBg: 'bg-orange-100 dark:bg-orange-900/50',
    iconColour: 'text-orange-600 dark:text-orange-400',
  },
  green: {
    border: 'border-l-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/50',
    iconColour: 'text-green-600 dark:text-green-400',
  },
  purple: {
    border: 'border-l-purple-400',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50',
    iconColour: 'text-purple-600 dark:text-purple-400',
  },
  red: {
    border: 'border-l-red-400',
    iconBg: 'bg-red-100 dark:bg-red-900/50',
    iconColour: 'text-red-600 dark:text-red-400',
  },
  teal: {
    border: 'border-l-teal-400',
    iconBg: 'bg-teal-100 dark:bg-teal-900/50',
    iconColour: 'text-teal-600 dark:text-teal-400',
  },
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  subtitle,
  colour = 'blue',
  isLoading = false,
}: StatsCardProps) {
  const isPositive = trend !== undefined && trend > 0
  const isNegative = trend !== undefined && trend < 0
  const config = colourConfig[colour]

  if (isLoading) {
    return (
      <Card className={cn(
        'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm border-l-4',
        config.border
      )}>
        <CardContent className="px-2.5 py-1">
          <div className="flex items-start justify-between mb-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <Skeleton className="h-7 w-20 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(
      'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow transition-shadow border-l-4',
      config.border
    )}>
      <CardContent className="px-2.5 py-1">
        <div className="flex items-start justify-between mb-1">
          <p className="font-oswald text-xs font-medium text-blue-900 dark:text-blue-100 uppercase">
            {title}
          </p>
          <div className={cn('p-1 rounded-full', config.iconBg)}>
            <Icon className={cn('h-5 w-5', config.iconColour)} />
          </div>
        </div>

        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>

        {trend !== undefined && trendLabel && (
          <div className="flex items-center gap-1.5 text-sm mt-2">
            {isPositive && <TrendingUp className="h-4 w-4 text-green-500" />}
            {isNegative && <TrendingDown className="h-4 w-4 text-red-500" />}
            <span
              className={cn(
                'font-medium',
                isPositive && 'text-green-600 dark:text-green-400',
                isNegative && 'text-red-600 dark:text-red-400',
                !isPositive && !isNegative && 'text-gray-500 dark:text-gray-400'
              )}
            >
              {isPositive && '+'}
              {trend}%
            </span>
            <span className="text-gray-400">{trendLabel}</span>
          </div>
        )}

        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}
