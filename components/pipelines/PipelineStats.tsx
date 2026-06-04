'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Users, PoundSterling, Trophy, TrendingUp } from 'lucide-react'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils/format'
import type { Deal } from '@/lib/types/pipelines'

interface PipelineStatsProps {
  deals: Deal[]
  lastUpdated?: string
  userId?: string | null
  isAdmin?: boolean
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
  purple: {
    gradient: 'from-purple-50/60 dark:from-purple-950/60',
    border: 'border-l-purple-400',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50',
    iconColour: 'text-purple-600 dark:text-purple-400',
  },
  orange: {
    gradient: 'from-orange-50/60 dark:from-orange-950/60',
    border: 'border-l-orange-400',
    iconBg: 'bg-orange-100 dark:bg-orange-900/50',
    iconColour: 'text-orange-600 dark:text-orange-400',
  },
}

export function exportDealsToCSV(deals: Deal[]) {
  // Define CSV headers
  const headers = [
    'Contact Name',
    'Email',
    'Phone',
    'Deal Title',
    'Value',
    'Stage',
    'Pipeline',
    'Owner',
    'Graduation Year',
    'Time in Stage (days)',
    'Created Date',
    'Status',
  ]

  // Convert deals to CSV rows
  const rows = deals.map((deal) => {
    const contactName = deal.contact
      ? `${deal.contact.first_name} ${deal.contact.last_name}`
      : ''
    const status = deal.won_at ? 'Won' : deal.lost_at ? 'Lost' : 'Open'

    return [
      contactName,
      deal.contact?.email || '',
      deal.contact?.phone || '',
      deal.title,
      deal.deal_value?.toString() || '0',
      deal.stage?.name || '',
      deal.pipeline?.name || '',
      deal.owner?.full_name || deal.owner?.email || '',
      deal.contact?.graduation_year?.toString() || '',
      deal.time_in_stage?.toFixed(0) || '',
      formatDate(deal.created_at),
      status,
    ]
  })

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        // Escape cells containing commas or quotes
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`
        }
        return cell
      }).join(',')
    ),
  ].join('\n')

  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `pipeline-deals-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function PipelineStats({ deals, lastUpdated, userId, isAdmin }: PipelineStatsProps) {
  // The Export CSV button moved up into PipelineFilters so it sits
  // alongside the search/zoom/view-toggle row instead of taking its
  // own dedicated stripe under the stats grid (gave that vertical
  // space back to the kanban board).
  void userId
  void isAdmin
  // Calculate stats
  const totalPlayers = deals.length
  // Total Value excludes deals that have landed in a lost/dead stage — a
  // priced deal that died shouldn't keep inflating the pipeline's value.
  const DEAD_STAGE_TYPES = ['lost', 'dead']
  const totalValue = deals.reduce(
    (sum, deal) =>
      deal.stage && DEAD_STAGE_TYPES.includes(deal.stage.stage_type)
        ? sum
        : sum + (deal.deal_value || 0),
    0
  )
  const dealsWon = deals.filter((deal) => deal.won_at).length
  const conversionRate = totalPlayers > 0
    ? Math.round((dealsWon / totalPlayers) * 100)
    : 0

  const stats = [
    {
      label: 'Total Players',
      value: formatNumber(totalPlayers),
      icon: Users,
      colour: 'blue' as const,
    },
    {
      label: 'Total Value',
      value: formatCurrency(totalValue),
      icon: PoundSterling,
      colour: 'green' as const,
    },
    {
      label: 'Deals Won',
      value: formatNumber(dealsWon),
      icon: Trophy,
      colour: 'purple' as const,
    },
    {
      label: 'Conversion Rate',
      value: `${conversionRate}%`,
      icon: TrendingUp,
      colour: 'orange' as const,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          const config = colourConfig[stat.colour]
          return (
            <Card key={stat.label} className={cn(
              'relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow transition-shadow border-l-4',
              config.border
            )}>
              <div className={cn(
                'absolute inset-x-0 top-0 h-12 bg-gradient-to-b to-transparent pointer-events-none',
                config.gradient
              )} />
              <CardContent className="relative z-10 px-2.5 py-1">
                <div className="flex items-start justify-between mb-0">
                  <p className="font-oswald text-xs font-medium text-blue-900 dark:text-blue-100 uppercase">
                    {stat.label}
                  </p>
                  <div className={cn('p-1 rounded-full', config.iconBg)}>
                    <Icon className={cn('h-4 w-4', config.iconColour)} />
                  </div>
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

    </div>
  )
}
