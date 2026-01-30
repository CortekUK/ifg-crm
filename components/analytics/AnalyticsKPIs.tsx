'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  Users,
  Target,
  PoundSterling,
  TrendingUp,
  TrendingDown,
  Mail,
  MessageSquare,
} from 'lucide-react'

interface KPI {
  title: string
  value: string
  change: number
  changeLabel: string
  icon: React.ElementType
  colour: 'blue' | 'green' | 'emerald' | 'purple' | 'orange' | 'teal'
}

interface AnalyticsKPIsProps {
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
  emerald: {
    gradient: 'from-emerald-50/60',
    border: 'border-l-emerald-400',
    iconBg: 'bg-emerald-100',
    iconColour: 'text-emerald-600',
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
  teal: {
    gradient: 'from-teal-50/60',
    border: 'border-l-teal-400',
    iconBg: 'bg-teal-100',
    iconColour: 'text-teal-600',
  },
}

export function AnalyticsKPIs({ isLoading }: AnalyticsKPIsProps) {
  const kpis: KPI[] = [
    {
      title: 'Total Leads',
      value: '248',
      change: 12.5,
      changeLabel: 'vs last period',
      icon: Users,
      colour: 'blue',
    },
    {
      title: 'Conversion Rate',
      value: '18.4%',
      change: 2.1,
      changeLabel: 'vs last period',
      icon: Target,
      colour: 'green',
    },
    {
      title: 'Revenue',
      value: '£142,500',
      change: 8.3,
      changeLabel: 'vs last period',
      icon: PoundSterling,
      colour: 'emerald',
    },
    {
      title: 'Avg Deal Value',
      value: '£3,125',
      change: -4.2,
      changeLabel: 'vs last period',
      icon: TrendingUp,
      colour: 'purple',
    },
    {
      title: 'Email Open Rate',
      value: '42.8%',
      change: 5.6,
      changeLabel: 'vs last period',
      icon: Mail,
      colour: 'orange',
    },
    {
      title: 'SMS Response Rate',
      value: '28.3%',
      change: -1.8,
      changeLabel: 'vs last period',
      icon: MessageSquare,
      colour: 'teal',
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, i) => {
          const config = colourConfig[kpi.colour]
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
                <Skeleton className="h-9 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        const config = colourConfig[kpi.colour]
        const isPositive = kpi.change >= 0

        return (
          <Card key={kpi.title} className={cn(
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
                  {kpi.title}
                </p>
                <div className={cn('p-2.5 rounded-full', config.iconBg)}>
                  <Icon className={cn('h-5 w-5', config.iconColour)} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
              <div className="flex items-center gap-1.5 text-sm mt-2">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={cn(
                  'font-medium',
                  isPositive ? 'text-green-600' : 'text-red-600'
                )}>
                  {isPositive ? '+' : ''}{kpi.change}%
                </span>
                <span className="text-gray-400">{kpi.changeLabel}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
