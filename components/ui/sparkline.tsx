'use client'

import { cn } from '@/lib/utils'

interface SparklineProps {
  data?: number[]
  colour?: string
  className?: string
}

export function Sparkline({
  data = [3, 5, 7, 4, 8, 6, 9, 5, 7, 8, 6, 9],
  colour = 'bg-blue-500',
  className,
}: SparklineProps) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  return (
    <div className={cn('flex items-end gap-0.5 h-8', className)}>
      {data.map((value, index) => {
        const height = ((value - min) / range) * 100
        const minHeight = 20 // Minimum 20% height for visibility
        const finalHeight = Math.max(height, minHeight)

        return (
          <div
            key={index}
            className={cn('flex-1 rounded-sm transition-all', colour)}
            style={{
              height: `${finalHeight}%`,
              opacity: 0.4 + (height / 100) * 0.6,
            }}
          />
        )
      })}
    </div>
  )
}
