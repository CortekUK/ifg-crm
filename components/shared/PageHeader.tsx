'use client'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  subtitle: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('banner-gradient rounded-xl p-6', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-white/90 text-base">{subtitle}</p>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  )
}
