import Link from 'next/link'
import { programmes } from '@/lib/landing/programmes'
import { ProgrammeCard } from './ProgrammeCard'
import { FadeIn } from './FadeIn'
import { ArrowRight } from 'lucide-react'

const pathways = [
  { label: 'Degree Programme', duration: '3–4 Years' },
  { label: 'Development Year', duration: 'Up to 9 Months' },
  { label: 'Short-Term Experience', duration: '2–6 Weeks' },
]

export function ProgrammeFinder() {
  return (
    <section className="py-20 md:py-28 bg-white dark:bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-white/50">
              Programmes
            </span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1]">
                Choose Your Pathway
              </h2>
              <p className="mt-4 text-base text-gray-600 dark:text-muted-foreground leading-relaxed">
                Three structured programmes built for different stages, ambitions, and
                timelines. Each combines professional football coaching with a clear
                development pathway.
              </p>
            </div>
            <Link
              href="/landing/programmes"
              className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-white/50 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 hover:border-red-600/30 hover:text-red-600 dark:hover:border-red-600/30 dark:hover:text-red-500 transition-all shrink-0"
            >
              View All Programmes
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </FadeIn>

        {/* Decision guidance strip */}
        <FadeIn delay={50} className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 pt-6 border-t border-gray-100 dark:border-white/[0.06]">
            {pathways.map((pathway, i) => (
              <div key={pathway.label} className="flex items-center">
                {i > 0 && (
                  <div className="hidden sm:block w-px h-4 bg-gray-200 dark:bg-white/10 mx-6" />
                )}
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                  <span className="text-[13px] font-medium text-gray-700 dark:text-white/60">
                    {pathway.label}
                  </span>
                  <span className="text-[12px] text-gray-400 dark:text-white/30">
                    {pathway.duration}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
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
