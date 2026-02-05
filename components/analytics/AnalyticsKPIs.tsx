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
  Video,
  AlertCircle,
  Wallet,
  BadgePoundSterling,
} from 'lucide-react'
import type { AnalyticsData } from '@/lib/hooks/useAnalytics'

interface KPI {
  title: string
  value: string
  change: number
  changeLabel: string
  icon: React.ElementType
  colour: 'blue' | 'green' | 'emerald' | 'purple' | 'orange' | 'teal' | 'indigo' | 'rose' | 'amber' | 'cyan'
}

interface AnalyticsKPIsProps {
  isLoading?: boolean
  data?: AnalyticsData['kpis']
}

const colourConfig = {
  blue: {
    gradient: 'from-blue-50/60 dark:from-blue-950/40',
    border: 'border-l-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    iconColour: 'text-blue-600 dark:text-blue-400',
  },
  green: {
    gradient: 'from-green-50/60 dark:from-green-950/40',
    border: 'border-l-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/50',
    iconColour: 'text-green-600 dark:text-green-400',
  },
  emerald: {
    gradient: 'from-emerald-50/60 dark:from-emerald-950/40',
    border: 'border-l-emerald-400',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    iconColour: 'text-emerald-600 dark:text-emerald-400',
  },
  purple: {
    gradient: 'from-purple-50/60 dark:from-purple-950/40',
    border: 'border-l-purple-400',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50',
    iconColour: 'text-purple-600 dark:text-purple-400',
  },
  orange: {
    gradient: 'from-orange-50/60 dark:from-orange-950/40',
    border: 'border-l-orange-400',
    iconBg: 'bg-orange-100 dark:bg-orange-900/50',
    iconColour: 'text-orange-600 dark:text-orange-400',
  },
  teal: {
    gradient: 'from-teal-50/60 dark:from-teal-950/40',
    border: 'border-l-teal-400',
    iconBg: 'bg-teal-100 dark:bg-teal-900/50',
    iconColour: 'text-teal-600 dark:text-teal-400',
  },
  indigo: {
    gradient: 'from-indigo-50/60 dark:from-indigo-950/40',
    border: 'border-l-indigo-400',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/50',
    iconColour: 'text-indigo-600 dark:text-indigo-400',
  },
  rose: {
    gradient: 'from-rose-50/60 dark:from-rose-950/40',
    border: 'border-l-rose-400',
    iconBg: 'bg-rose-100 dark:bg-rose-900/50',
    iconColour: 'text-rose-600 dark:text-rose-400',
  },
  amber: {
    gradient: 'from-amber-50/60 dark:from-amber-950/40',
    border: 'border-l-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    iconColour: 'text-amber-600 dark:text-amber-400',
  },
  cyan: {
    gradient: 'from-cyan-50/60 dark:from-cyan-950/40',
    border: 'border-l-cyan-400',
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/50',
    iconColour: 'text-cyan-600 dark:text-cyan-400',
  },
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function AnalyticsKPIs({ isLoading, data }: AnalyticsKPIsProps) {
  const kpis: KPI[] = [
    {
      title: 'Total Leads',
      value: data?.totalLeads?.toString() || '0',
      change: data ? calculateChange(data.totalLeads, data.totalLeadsPrevious) : 0,
      changeLabel: 'vs last period',
      icon: Users,
      colour: 'blue',
    },
    {
      title: 'Conversion Rate',
      value: `${(data?.conversionRate || 0).toFixed(1)}%`,
      change: data ? (data.conversionRate - data.conversionRatePrevious) : 0,
      changeLabel: 'vs last period',
      icon: Target,
      colour: 'green',
    },
    {
      title: 'Revenue',
      value: formatCurrency(data?.revenue || 0),
      change: data ? calculateChange(data.revenue, data.revenuePrevious) : 0,
      changeLabel: 'vs last period',
      icon: PoundSterling,
      colour: 'emerald',
    },
    {
      title: 'Avg Deal Value',
      value: formatCurrency(data?.avgDealValue || 0),
      change: data ? calculateChange(data.avgDealValue, data.avgDealValuePrevious) : 0,
      changeLabel: 'vs last period',
      icon: TrendingUp,
      colour: 'purple',
    },
    {
      title: 'Email Open Rate',
      value: `${(data?.emailOpenRate || 0).toFixed(1)}%`,
      change: data ? (data.emailOpenRate - data.emailOpenRatePrevious) : 0,
      changeLabel: 'vs last period',
      icon: Mail,
      colour: 'orange',
    },
    {
      title: 'SMS Response Rate',
      value: `${(data?.smsResponseRate || 0).toFixed(1)}%`,
      change: data ? (data.smsResponseRate - data.smsResponseRatePrevious) : 0,
      changeLabel: 'vs last period',
      icon: MessageSquare,
      colour: 'teal',
    },
    {
      title: 'Calls Booked',
      value: data?.callsBooked?.toString() || '0',
      change: data ? calculateChange(data.callsBooked, data.callsBookedPrevious) : 0,
      changeLabel: 'vs last period',
      icon: Video,
      colour: 'indigo',
    },
    {
      title: 'Unmatched Replies',
      value: data?.unmatchedReplies?.toString() || '0',
      change: data ? calculateChange(data.unmatchedReplies, data.unmatchedRepliesPrevious) : 0,
      changeLabel: 'vs last period',
      icon: AlertCircle,
      colour: 'rose',
    },
    {
      title: 'Outstanding Balance',
      value: formatCurrency(data?.outstandingBalance || 0),
      change: data ? calculateChange(data.outstandingBalance, data.outstandingBalancePrevious) : 0,
      changeLabel: 'vs last period',
      icon: Wallet,
      colour: 'amber',
    },
    {
      title: 'Deposits This Month',
      value: formatCurrency(data?.depositsThisMonth || 0),
      change: data ? calculateChange(data.depositsThisMonth, data.depositsLastMonth) : 0,
      changeLabel: 'vs last month',
      icon: BadgePoundSterling,
      colour: 'cyan',
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, i) => {
          const config = colourConfig[kpi.colour]
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
            'relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow transition-shadow border-l-4',
            config.border
          )}>
            <div className={cn(
              'absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent pointer-events-none',
              config.gradient
            )} />
            <CardContent className="relative z-10 p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="font-oswald text-xs font-medium text-blue-900 dark:text-blue-300 uppercase">
                  {kpi.title}
                </p>
                <div className={cn('p-2.5 rounded-full', config.iconBg)}>
                  <Icon className={cn('h-5 w-5', config.iconColour)} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
              <div className="flex items-center gap-1.5 text-sm mt-2">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={cn(
                  'font-medium',
                  isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {isPositive ? '+' : ''}{kpi.change.toFixed(1)}%
                </span>
                <span className="text-gray-400 dark:text-gray-500">{kpi.changeLabel}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
