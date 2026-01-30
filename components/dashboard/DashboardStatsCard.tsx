'use client'

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
}

const colourConfig = {
  blue: {
    gradient: 'from-blue-50/60',
    border: 'border-l-blue-400',
    iconBg: 'bg-blue-100',
    iconColour: 'text-blue-600',
    sparkline: 'bg-blue-400',
  },
  orange: {
    gradient: 'from-orange-50/60',
    border: 'border-l-orange-400',
    iconBg: 'bg-orange-100',
    iconColour: 'text-orange-600',
    sparkline: 'bg-orange-400',
  },
  green: {
    gradient: 'from-green-50/60',
    border: 'border-l-green-400',
    iconBg: 'bg-green-100',
    iconColour: 'text-green-600',
    sparkline: 'bg-green-400',
  },
  purple: {
    gradient: 'from-purple-50/60',
    border: 'border-l-purple-400',
    iconBg: 'bg-purple-100',
    iconColour: 'text-purple-600',
    sparkline: 'bg-purple-400',
  },
  red: {
    gradient: 'from-red-50/60',
    border: 'border-l-red-400',
    iconBg: 'bg-red-100',
    iconColour: 'text-red-600',
    sparkline: 'bg-red-400',
  },
  teal: {
    gradient: 'from-teal-50/60',
    border: 'border-l-teal-400',
    iconBg: 'bg-teal-100',
    iconColour: 'text-teal-600',
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
}: DashboardStatsCardProps) {
  const isPositive = trend !== undefined && trend > 0
  const isNegative = trend !== undefined && trend < 0
  const config = colourConfig[colour]

  if (isLoading) {
    return (
      <Card className={cn(
        'relative overflow-hidden bg-white border border-slate-200 shadow-sm border-l-4',
        config.border
      )}>
        <div className={cn(
          'absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent pointer-events-none',
          config.gradient
        )} />
        <CardContent className="relative z-10 p-5">
          <div className="flex items-start justify-between mb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
          <Skeleton className="h-10 w-20 mb-2" />
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(
      'relative overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow transition-shadow border-l-4',
      config.border
    )}>
      {/* Subtle gradient overlay from top */}
      <div className={cn(
        'absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent pointer-events-none',
        config.gradient
      )} />
      
      <CardContent className="relative z-10 p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="font-oswald text-xs font-medium text-blue-900 uppercase">
            {title}
          </p>
          {/* Subtle/muted icon styling */}
          <div className={cn('p-2.5 rounded-full', config.iconBg)}>
            <Icon className={cn('h-5 w-5', config.iconColour)} />
          </div>
        </div>
        
        <p className="text-4xl font-bold text-gray-900 mb-1">{value}</p>
        
        {trend !== undefined && (
          <div className="flex items-center gap-1.5 text-sm mb-4">
            {isPositive && <TrendingUp className="h-4 w-4 text-green-500" />}
            {isNegative && <TrendingDown className="h-4 w-4 text-red-500" />}
            <span
              className={cn(
                'font-medium',
                isPositive && 'text-green-600',
                isNegative && 'text-red-600',
                !isPositive && !isNegative && 'text-gray-500'
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
}
