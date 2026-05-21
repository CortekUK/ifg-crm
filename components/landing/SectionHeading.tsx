import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  title: string
  subtitle?: string
  label?: string
  className?: string
  light?: boolean
  align?: 'left' | 'center'
}

export function SectionHeading({ title, subtitle, label, className, light, align = 'center' }: SectionHeadingProps) {
  const isLeft = align === 'left'
  return (
    <div className={cn(isLeft ? 'text-left' : 'text-center', 'mb-12', className)}>
      {label && (
        <div className={cn('flex items-center gap-3 mb-4', !isLeft && 'justify-center')}>
          <div className={cn('w-10 h-[2px]', light ? 'bg-blue-400' : 'bg-blue-600')} />
          <span
            className={cn(
              'text-xs font-semibold uppercase tracking-[0.2em]',
              light ? 'text-blue-400' : 'text-blue-600 dark:text-blue-400'
            )}
          >
            {label}
          </span>
        </div>
      )}
      <h2
        className={cn(
          'font-oswald text-3xl md:text-4xl font-bold uppercase tracking-tight leading-[1.1]',
          light ? 'text-white' : 'text-gray-900 dark:text-foreground'
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            'mt-4 text-lg leading-relaxed',
            isLeft ? 'max-w-2xl' : 'max-w-2xl mx-auto',
            light ? 'text-white/60' : 'text-gray-600 dark:text-muted-foreground'
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}
