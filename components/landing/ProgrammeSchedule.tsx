import type { Programme } from '@/lib/landing/programmes'
import { getAccentColors } from '@/lib/landing/programme-colors'

interface ProgrammeScheduleProps {
  schedule: NonNullable<Programme['schedule']>
  category: Programme['category']
}

export function ProgrammeSchedule({ schedule, category }: ProgrammeScheduleProps) {
  const accent = getAccentColors(category)

  return (
    <section className="py-20 md:py-28 bg-white dark:bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-[2px] ${accent.line}`} />
            <span className={`text-xs font-semibold uppercase tracking-[0.2em] ${accent.text}`}>
              Schedule
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-4xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1]">
            Typical Week
          </h2>
          <p className="mt-4 text-gray-600 dark:text-muted-foreground leading-relaxed max-w-2xl">
            {schedule.description}
          </p>
        </div>

        <div className="space-y-2">
          {schedule.items.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-0 rounded-xl overflow-hidden border border-gray-200 dark:border-white/5"
            >
              <div className="w-28 shrink-0 bg-gray-100 dark:bg-white/5 p-4 flex items-center">
                <span className="font-oswald text-sm font-semibold uppercase tracking-tight text-gray-900 dark:text-foreground">
                  {item.day}
                </span>
              </div>
              <div className="p-4 flex-1 bg-white dark:bg-white/[0.02]">
                <p className="text-sm text-gray-700 dark:text-foreground/80">{item.activity}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
