import type { Programme } from '@/lib/landing/programmes'
import { getAccentColors } from '@/lib/landing/programme-colors'
import { Clock, MapPin, Users, GraduationCap, Calendar, Zap, Sun, Trophy } from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  clock: Clock,
  'map-pin': MapPin,
  users: Users,
  'graduation-cap': GraduationCap,
  calendar: Calendar,
  zap: Zap,
  sun: Sun,
  trophy: Trophy,
}

interface ProgrammeQuickFactsProps {
  facts: Programme['quickFacts']
  category: Programme['category']
}

export function ProgrammeQuickFacts({ facts, category }: ProgrammeQuickFactsProps) {
  const accent = getAccentColors(category)

  return (
    <section className="py-10 bg-white dark:bg-background border-b border-gray-200 dark:border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {facts.map((fact) => {
            const Icon = iconMap[fact.icon] || Clock
            return (
              <div key={fact.label} className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${accent.bg} shrink-0`}>
                  <Icon className={`h-5 w-5 ${accent.icon}`} />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 dark:text-white/40 uppercase tracking-wider font-medium">{fact.label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-foreground">{fact.value}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
