import type { Testimonial } from '@/lib/landing/programmes'

interface TestimonialCardProps {
  testimonial: Testimonial
  variant?: 'light' | 'dark'
}

export function TestimonialCard({ testimonial, variant = 'dark' }: TestimonialCardProps) {
  const isDark = variant === 'dark'
  return (
    <div className="flex flex-col h-full">
      {/* Large quotation mark */}
      <span
        className={cn(
          'font-oswald text-6xl leading-none -mb-2',
          isDark ? 'text-white/20' : 'text-gray-200 dark:text-white/10'
        )}
      >
        &ldquo;
      </span>
      <p
        className={cn(
          'text-base leading-relaxed flex-1',
          isDark ? 'text-white/80' : 'text-gray-700 dark:text-foreground/80'
        )}
      >
        {testimonial.quote}
      </p>
      <div className={cn('mt-6 pt-4 border-t', isDark ? 'border-white/10' : 'border-gray-200 dark:border-white/10')}>
        <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900 dark:text-foreground')}>
          {testimonial.name}
        </p>
        <p className={cn('text-xs mt-0.5', isDark ? 'text-white/50' : 'text-gray-500 dark:text-muted-foreground')}>
          {testimonial.country} &bull; {testimonial.programme}
        </p>
      </div>
    </div>
  )
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
