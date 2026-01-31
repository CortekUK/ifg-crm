'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Download, Users, PoundSterling, Trophy, TrendingUp } from 'lucide-react'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils/format'
import type { Deal } from '@/lib/types/pipelines'

interface PipelineStatsProps {
  deals: Deal[]
  lastUpdated?: string
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
}

function exportDealsToCSV(deals: Deal[]) {
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

export function PipelineStats({ deals, lastUpdated }: PipelineStatsProps) {
  // Calculate stats
  const totalPlayers = deals.length
  const totalValue = deals.reduce((sum, deal) => sum + (deal.deal_value || 0), 0)
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          const config = colourConfig[stat.colour]
          return (
            <Card key={stat.label} className={cn(
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
                    {stat.label}
                  </p>
                  <div className={cn('p-2.5 rounded-full', config.iconBg)}>
                    <Icon className={cn('h-5 w-5', config.iconColour)} />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportDealsToCSV(deals)}
          disabled={deals.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>
    </div>
  )
}
