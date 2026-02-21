'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkline } from '@/components/ui/sparkline'
import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface DashboardStatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: number
  trendLabel?: string
  colour?: 'blue' | 'orange' | 'green' | 'purple' | 'red' | 'teal'
  sparklineData?: number[]
  isLoading?: boolean
  href?: string
}

const colourConfig = {
  blue: {
    gradient: 'from-blue-50/60 dark:from-blue-950/60',
    border: 'border-l-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    iconColour: 'text-blue-600 dark:text-blue-400',
    sparkline: 'bg-blue-400',
  },
  orange: {
    gradient: 'from-orange-50/60 dark:from-orange-950/60',
    border: 'border-l-orange-400',
    iconBg: 'bg-orange-100 dark:bg-orange-900/50',
    iconColour: 'text-orange-600 dark:text-orange-400',
    sparkline: 'bg-orange-400',
  },
  green: {
    gradient: 'from-green-50/60 dark:from-green-950/60',
    border: 'border-l-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/50',
    iconColour: 'text-green-600 dark:text-green-400',
    sparkline: 'bg-green-400',
  },
  purple: {
    gradient: 'from-purple-50/60 dark:from-purple-950/60',
    border: 'border-l-purple-400',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50',
    iconColour: 'text-purple-600 dark:text-purple-400',
    sparkline: 'bg-purple-400',
  },
  red: {
    gradient: 'from-red-50/60 dark:from-red-950/60',
    border: 'border-l-red-400',
    iconBg: 'bg-red-100 dark:bg-red-900/50',
    iconColour: 'text-red-600 dark:text-red-400',
    sparkline: 'bg-red-400',
  },
  teal: {
    gradient: 'from-teal-50/60 dark:from-teal-950/60',
    border: 'border-l-teal-400',
    iconBg: 'bg-teal-100 dark:bg-teal-900/50',
    iconColour: 'text-teal-600 dark:text-teal-400',
    sparkline: 'bg-teal-400',
  },
}

export function DashboardStatsCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel = 'vs last month',
  colour = 'blue',
  sparklineData,
  isLoading = false,
  href,
}: DashboardStatsCardProps) {
  const isPositive = trend !== undefined && trend > 0
  const isNegative = trend !== undefined && trend < 0
  const config = colourConfig[colour]

  if (isLoading) {
    return (
      <Card className={cn(
        'relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm border-l-4',
        config.border
      )}>
        <div className={cn(
          'absolute inset-x-0 top-0 h-12 bg-gradient-to-b to-transparent pointer-events-none',
          config.gradient
        )} />
        <CardContent className="relative z-10 px-2.5 py-1">
          <div className="flex items-start justify-between mb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <Skeleton className="h-10 w-20 mb-2" />
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  const cardContent = (
    <Card className={cn(
      'relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow border-l-4',
      config.border,
      href && 'cursor-pointer'
    )}>
      <div className={cn(
        'absolute inset-x-0 top-0 h-12 bg-gradient-to-b to-transparent pointer-events-none',
        config.gradient
      )} />
      <CardContent className="relative z-10 px-2.5 py-1">
        <div className="flex items-start justify-between mb-0">
          <p className="font-oswald text-xs font-medium text-blue-900 dark:text-blue-100 uppercase">
            {title}
          </p>
          {/* Subtle/muted icon styling */}
          <div className={cn('p-1 rounded-full', config.iconBg)}>
            <Icon className={cn('h-4 w-4', config.iconColour)} />
          </div>
        </div>
        
        <p className="text-xl font-bold text-gray-900 dark:text-white mb-0">{value}</p>
        
        {trend !== undefined && (
          <div className="flex items-center gap-1.5 text-sm mb-4">
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

        <Sparkline
          data={sparklineData}
          colour={config.sparkline}
        />
      </CardContent>
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {cardContent}
      </Link>
    )
  }

  return cardContent
}
