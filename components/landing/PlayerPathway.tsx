'use client'

import Image from 'next/image'
import { FadeIn } from './FadeIn'

const steps = [
  {
    number: '01',
    title: 'Apply',
    description: 'Submit your application online in minutes.',
  },
  {
    number: '02',
    title: 'Speak with IFG',
    description: 'A personal call to understand your goals.',
  },
  {
    number: '03',
    title: 'Match with a Programme',
    description: 'We recommend the right pathway for you.',
  },
  {
    number: '04',
    title: 'Train & Study',
    description: 'Full-time football and education in the UK.',
  },
  {
    number: '05',
    title: 'Compete & Develop',
    description: 'Fixtures, analysis, and real progression.',
  },
  {
    number: '06',
    title: 'Progress into Opportunity',
    description: 'Trials, transfers, degrees, and career routes.',
  },
]

export function PlayerPathway() {
  return (
    <section className="relative py-20 md:py-28 overflow-hidden bg-[#0A0A0A]">
      {/* Background — faint stadium image */}
      <div className="absolute inset-0">
        <Image
          src="/landing/photos/stadium.jpeg"
          alt=""
          fill
          className="object-cover object-center brightness-50"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#0A0A0A]/85" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <FadeIn className="text-center mb-14 md:mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              The Player Pathway
            </span>
            <div className="w-8 h-[2px] bg-red-600" />
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-white leading-[1.1]">
            From Application
            <br className="hidden sm:block" /> to Opportunity
          </h2>
        </FadeIn>

        {/* Desktop: horizontal pathway (lg+) */}
        <div className="hidden lg:block">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-6 left-[calc(8.33%)] right-[calc(8.33%)] h-[2px] bg-gradient-to-r from-red-600/60 via-red-600 to-red-600/60" />

            <div className="grid grid-cols-6 gap-4">
              {steps.map((step, i) => (
                <FadeIn key={step.number} delay={i * 150} from="up" className="text-center">
                  {/* Numbered circle on the line */}
                  <div className="relative flex justify-center mb-6">
                    <div className="w-12 h-12 rounded-full bg-[#0A0A0A] border-2 border-red-600 flex items-center justify-center z-10">
                      <span className="text-sm font-bold text-red-500 font-oswald">
                        {step.number}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-oswald text-sm font-bold uppercase tracking-wide text-white mb-1.5">
                    {step.title}
                  </h3>
                  <p className="text-xs text-white/45 leading-relaxed px-1">
                    {step.description}
                  </p>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="lg:hidden">
          <div className="relative pl-10">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-red-600/60 via-red-600 to-red-600/60" />

            <div className="space-y-8">
              {steps.map((step, i) => (
                <FadeIn key={step.number} delay={i * 100} from="left">
                  <div className="relative flex items-start gap-5">
                    {/* Circle on the line */}
                    <div className="absolute -left-10 top-0 w-8 h-8 rounded-full bg-[#0A0A0A] border-2 border-red-600 flex items-center justify-center z-10">
                      <span className="text-[11px] font-bold text-red-500 font-oswald">
                        {step.number}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-oswald text-base font-bold uppercase tracking-wide text-white mb-1">
                        {step.title}
                      </h3>
                      <p className="text-sm text-white/45 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
