'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: { value: number; label: string }
  colour?: 'blue' | 'orange' | 'green' | 'purple' | 'red' | 'teal'
  isLoading?: boolean
}

const colourClasses = {
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-600 dark:text-blue-400', border: 'border-l-blue-400' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-600 dark:text-orange-400', border: 'border-l-orange-400' },
  green: { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-600 dark:text-green-400', border: 'border-l-green-400' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-600 dark:text-purple-400', border: 'border-l-purple-400' },
  red: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-600 dark:text-red-400', border: 'border-l-red-400' },
  teal: { bg: 'bg-teal-100 dark:bg-teal-900/50', text: 'text-teal-600 dark:text-teal-400', border: 'border-l-teal-400' },
}

export function StatsCard({ title, value, icon: Icon, trend, colour = 'blue', isLoading = false }: StatsCardProps) {
  const colours = colourClasses[colour]

  if (isLoading) {
    return (
      <Card className={cn(
        'px-2.5 py-1 border border-slate-200 dark:border-slate-700 shadow-sm border-l-4 bg-white dark:bg-slate-900',
        colours.border
      )}>
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </Card>
    )
  }

  const isPositive = trend && trend.value >= 0
  const isNegative = trend && trend.value < 0

  return (
    <Card className={cn(
      'px-2.5 py-1 border border-slate-200 dark:border-slate-700 shadow-sm border-l-4 bg-white dark:bg-slate-900',
      colours.border
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-oswald text-[11px] font-medium text-blue-900 dark:text-blue-300 uppercase">{title}</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-1">
              {isPositive && <TrendingUp className="h-4 w-4 text-green-500" />}
              {isNegative && <TrendingDown className="h-4 w-4 text-red-500" />}
              <span className={cn(
                'text-sm font-medium',
                isPositive && 'text-green-600',
                isNegative && 'text-red-500'
              )}>
                {isPositive && '+'}{trend.value}%
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn('p-1 rounded-full', colours.bg)}>
          <Icon className={cn('h-4 w-4', colours.text)} />
        </div>
      </div>
    </Card>
  )
}
