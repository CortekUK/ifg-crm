import Link from 'next/link'
import { programmes } from '@/lib/landing/programmes'
import { ProgrammeCard } from './ProgrammeCard'
import { FadeIn } from './FadeIn'

export function ProgrammeFinder() {
  return (
    <section className="py-20 md:py-28 bg-white dark:bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header row */}
        <FadeIn className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-[2px] bg-red-600" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-white/50">
                Programmes
              </span>
            </div>
            <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1]">
              Find Your Pathway
            </h2>
          </div>

          <Link
            href="/landing/programmes"
            className="text-sm font-medium text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0"
          >
            View all programmes &rarr;
          </Link>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {programmes.map((programme, i) => (
            <FadeIn key={programme.slug} delay={i * 80} threshold={0.05}>
              <ProgrammeCard programme={programme} />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
