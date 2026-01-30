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
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', gradient: 'from-blue-50/50', border: 'border-l-blue-400' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', gradient: 'from-orange-50/50', border: 'border-l-orange-400' },
  green: { bg: 'bg-green-100', text: 'text-green-600', gradient: 'from-green-50/50', border: 'border-l-green-400' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', gradient: 'from-purple-50/50', border: 'border-l-purple-400' },
  red: { bg: 'bg-red-100', text: 'text-red-600', gradient: 'from-red-50/50', border: 'border-l-red-400' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-600', gradient: 'from-teal-50/50', border: 'border-l-teal-400' },
}

export function StatsCard({ title, value, icon: Icon, trend, colour = 'blue', isLoading = false }: StatsCardProps) {
  const colours = colourClasses[colour]

  if (isLoading) {
    return (
      <Card className={cn(
        'relative overflow-hidden p-6 border border-slate-200 shadow-sm border-l-4',
        colours.border
      )}>
        <div className={cn(
          'absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent pointer-events-none',
          colours.gradient
        )} />
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-11 w-11 rounded-full" />
          </div>
        </div>
      </Card>
    )
  }

  const isPositive = trend && trend.value >= 0
  const isNegative = trend && trend.value < 0

  return (
    <Card className={cn(
      'relative overflow-hidden p-6 border border-slate-200 shadow-sm border-l-4',
      colours.border
    )}>
      <div className={cn(
        'absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent pointer-events-none',
        colours.gradient
      )} />
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-oswald text-xs font-medium text-blue-900 uppercase">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
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
                <span className="text-sm text-slate-500">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-full', colours.bg)}>
            <Icon className={cn('h-5 w-5', colours.text)} />
          </div>
        </div>
      </div>
    </Card>
  )
}
