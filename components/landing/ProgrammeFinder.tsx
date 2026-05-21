import Link from 'next/link'
import { programmes } from '@/lib/landing/programmes'
import { ProgrammeCard } from './ProgrammeCard'
import { FadeIn } from './FadeIn'
import { SmoothScrollLink } from './SmoothScrollLink'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

const pathways = [
  { label: 'Degree Programme', duration: '3–4 Years' },
  { label: 'Development Year', duration: 'Up to 9 Months' },
  { label: 'Short-Term Experience', duration: '2–6 Weeks' },
]

const decisionCues = [
  {
    question: 'Football and a UK degree?',
    programme: 'University Programme',
    href: '/landing/programmes/university',
  },
  {
    question: 'A gap year with professional training?',
    programme: 'Gap Year',
    href: '/landing/programmes/gap-year',
  },
  {
    question: 'Short-term intensive development?',
    programme: 'Residency',
    href: '/landing/programmes/residency',
  },
]

export function ProgrammeFinder() {
  return (
    <section className="py-20 md:py-28 bg-[#FAFAFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              Programmes
            </span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 leading-[1.1]">
                Choose Your Pathway
              </h2>
              <p className="mt-4 text-base text-gray-600 leading-relaxed">
                Three structured programmes built for different stages, ambitions, and
                timelines. Each combines professional football coaching with a clear
                development pathway.
              </p>
            </div>
            <Link
              href="/landing/programmes"
              className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-gray-500 border border-gray-300 rounded-lg px-4 py-2.5 hover:border-red-600/30 hover:text-red-600 transition-all shrink-0"
            >
              View All Programmes
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </FadeIn>

        {/* Decision guidance strip */}
        <FadeIn delay={50} className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 pt-6 border-t border-gray-200">
            {pathways.map((pathway, i) => (
              <div key={pathway.label} className="flex items-center">
                {i > 0 && (
                  <div className="hidden sm:block w-px h-4 bg-gray-300 mx-6" />
                )}
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                  <span className="text-[13px] font-medium text-gray-700">
                    {pathway.label}
                  </span>
                  <span className="text-[12px] text-gray-400">
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
              <ProgrammeCard programme={programme} variant="light" />
            </FadeIn>
          ))}
        </div>

        {/* Pathway guidance — compact strip (merged from PathwayCTA) */}
        <FadeIn delay={200} className="mt-12">
          <div className="rounded-xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
              {/* Left: heading + subtext */}
              <div className="lg:max-w-xs shrink-0">
                <h3 className="font-oswald text-lg md:text-xl font-bold uppercase tracking-tight text-gray-900 leading-snug">
                  Not Sure Which Pathway?
                </h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  Speak with the IFG team and we&apos;ll guide you toward the right programme.
                </p>
              </div>

              {/* Centre: decision cue cards */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {decisionCues.map((cue) => (
                  <Link key={cue.href} href={cue.href} className="group">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 hover:border-red-600/30 hover:bg-red-50/40 transition-all duration-200 h-full flex flex-col justify-center">
                      <p className="text-[13px] text-gray-600 leading-snug mb-1">
                        {cue.question}
                      </p>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-red-600 group-hover:gap-2 transition-all">
                        {cue.programme}
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Right: CTAs */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <SmoothScrollLink href="#enquire">
                  <Button
                    size="lg"
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold tracking-wide"
                  >
                    Start Your Application
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </SmoothScrollLink>
                <Link href="/landing/programmes">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Explore Programmes
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
