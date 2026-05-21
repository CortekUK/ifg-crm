import { FadeIn } from '@/components/landing/FadeIn'
import { SmoothScrollLink } from '@/components/landing/SmoothScrollLink'
import { Button } from '@/components/ui/button'
import {
  MessageSquare,
  ClipboardCheck,
  Plane,
  TrendingUp,
  Trophy,
  ArrowRight,
} from 'lucide-react'

const stages = [
  {
    number: '01',
    icon: MessageSquare,
    title: 'Enquire',
    description: 'Submit your details and our admissions team responds within 48 hours.',
  },
  {
    number: '02',
    icon: ClipboardCheck,
    title: 'Assess',
    description: 'Share your football CV and video highlights for programme matching.',
  },
  {
    number: '03',
    icon: Plane,
    title: 'Arrive',
    description: 'Visa support, accommodation setup, and orientation at Macclesfield.',
  },
  {
    number: '04',
    icon: TrendingUp,
    title: 'Develop',
    description: 'Train daily with UEFA coaches, compete in fixtures, and study at UCLan.',
  },
  {
    number: '05',
    icon: Trophy,
    title: 'Progress',
    description: 'Professional trials, first-team pathway, or graduate with a UK degree.',
  },
]

export function V2PathwaySection() {
  return (
    <section className="py-20 md:py-28 bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn className="text-center mb-14 md:mb-18">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              The IFG Pathway
            </span>
            <div className="w-10 h-[2px] bg-red-600" />
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-white leading-[1.1]">
            From Enquiry to
            <br />
            Professional Pathway
          </h2>
          <p className="mt-5 text-base text-white/55 max-w-xl mx-auto leading-relaxed">
            Every IFG player follows a structured journey. Five stages, one clear
            destination — your next step in football.
          </p>
        </FadeIn>

        {/* Desktop: horizontal 5-stage progression */}
        <FadeIn className="hidden md:block" threshold={0.1}>
          <div className="relative">
            {/* Red connecting line */}
            <div className="absolute top-[52px] left-[10%] right-[10%] h-px bg-gradient-to-r from-red-600/20 via-red-600/50 to-red-600/20" />

            <div className="grid grid-cols-5 gap-4 relative">
              {stages.map((stage, i) => {
                const Icon = stage.icon
                const isLast = i === stages.length - 1
                return (
                  <div key={stage.number} className="relative text-center px-2">
                    {/* Large watermark number */}
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 font-oswald text-[80px] font-bold text-white/[0.03] leading-none select-none pointer-events-none">
                      {stage.number}
                    </span>

                    {/* Icon circle */}
                    <div
                      className={`relative z-10 w-[72px] h-[72px] rounded-full mx-auto mb-5 flex items-center justify-center border ${
                        isLast
                          ? 'border-red-600 bg-red-600/15'
                          : 'border-white/15 bg-white/[0.04]'
                      }`}
                    >
                      <Icon
                        className={`h-6 w-6 ${isLast ? 'text-red-500' : 'text-white/70'}`}
                      />
                    </div>

                    <h3
                      className={`font-oswald text-base font-bold uppercase tracking-wide mb-2 ${
                        isLast ? 'text-red-500' : 'text-white'
                      }`}
                    >
                      {stage.title}
                    </h3>
                    <p className="text-[13px] text-white/45 leading-relaxed">
                      {stage.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </FadeIn>

        {/* Mobile: vertical timeline */}
        <div className="md:hidden">
          <div className="relative pl-8">
            {/* Red left border */}
            <div className="absolute top-2 bottom-2 left-[11px] w-px bg-gradient-to-b from-red-600/30 via-red-600/60 to-red-600" />

            <div className="space-y-8">
              {stages.map((stage, i) => {
                const Icon = stage.icon
                const isLast = i === stages.length - 1
                return (
                  <FadeIn key={stage.number} delay={i * 80}>
                    <div className="relative flex gap-5">
                      {/* Node */}
                      <div
                        className={`absolute -left-8 top-0 z-10 w-[23px] h-[23px] rounded-full flex items-center justify-center ${
                          isLast
                            ? 'bg-red-600 border-2 border-red-600'
                            : 'bg-[#0A0A0A] border-2 border-white/20'
                        }`}
                      >
                        <span className="font-oswald text-[9px] font-bold text-white/70">
                          {stage.number}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2.5 mb-1">
                          <Icon
                            className={`h-4 w-4 ${isLast ? 'text-red-500' : 'text-white/50'}`}
                          />
                          <h3
                            className={`font-oswald text-[15px] font-bold uppercase tracking-wide ${
                              isLast ? 'text-red-500' : 'text-white'
                            }`}
                          >
                            {stage.title}
                          </h3>
                        </div>
                        <p className="text-[13px] text-white/45 leading-relaxed">
                          {stage.description}
                        </p>
                      </div>
                    </div>
                  </FadeIn>
                )
              })}
            </div>
          </div>
        </div>

        {/* CTA */}
        <FadeIn delay={300} className="mt-14 text-center">
          <SmoothScrollLink href="#enquire">
            <Button
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white text-base px-8 h-13 font-semibold tracking-wide"
            >
              Start Your Journey
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </SmoothScrollLink>
        </FadeIn>
      </div>
    </section>
  )
}
