'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface DataCardProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  iconColour?: 'blue' | 'orange' | 'green' | 'purple' | 'red' | 'teal' | 'slate'
  children: React.ReactNode
  className?: string
  actions?: React.ReactNode
}

const iconColourClasses = {
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-600 dark:text-blue-400' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-600 dark:text-orange-400' },
  green: { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-600 dark:text-green-400' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-600 dark:text-purple-400' },
  red: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-600 dark:text-red-400' },
  teal: { bg: 'bg-teal-100 dark:bg-teal-900/50', text: 'text-teal-600 dark:text-teal-400' },
  slate: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' },
}

export function DataCard({ 
  title, 
  subtitle,
  icon: Icon, 
  iconColour = 'blue',
  children, 
  className,
  actions 
}: DataCardProps) {
  const colours = iconColourClasses[iconColour]

  return (
    <Card className={cn('relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm', className)}>
      {/* Subtle gradient overlay from top */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-50 dark:from-slate-800 to-transparent pointer-events-none" />
      
      <CardHeader className="relative z-10 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {Icon && (
              <div className={cn('p-2 rounded-full', colours.bg)}>
                <Icon className={cn('h-4 w-4', colours.text)} />
              </div>
            )}
            <div>
              <CardTitle className="font-oswald text-sm font-medium text-blue-900 dark:text-blue-100 uppercase">
                {title}
              </CardTitle>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="relative z-10 pt-0">
        {children}
      </CardContent>
    </Card>
  )
}
