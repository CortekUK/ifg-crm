import type { Programme } from '@/lib/landing/programmes'
import { getAccentColors } from '@/lib/landing/programme-colors'
import { Check } from 'lucide-react'

interface ProgrammeWhatIncludedProps {
  included: string[]
  category: Programme['category']
}

export function ProgrammeWhatIncluded({ included, category }: ProgrammeWhatIncludedProps) {
  const accent = getAccentColors(category)

  return (
    <section className="py-20 md:py-28 bg-gray-50 dark:bg-white/[0.02]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex items-center gap-3 justify-center mb-4">
            <div className={`w-10 h-[2px] ${accent.line}`} />
            <span className={`text-xs font-semibold uppercase tracking-[0.2em] ${accent.text}`}>
              What You Get
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-4xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1]">
            What&apos;s Included
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-muted-foreground max-w-2xl mx-auto">
            Everything you need for a complete football and development experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {included.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/5"
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${accent.check} shrink-0`}>
                <Check className={`h-4 w-4 ${accent.icon}`} />
              </div>
              <p className="text-sm text-gray-800 dark:text-foreground font-medium">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
