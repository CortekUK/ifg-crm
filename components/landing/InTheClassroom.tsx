import Image from 'next/image'
import { FadeIn } from './FadeIn'

const pathway = [
  {
    step: '01',
    title: 'Study Alongside Football',
    description: 'Timetables built around training and match schedules — not the other way around.',
  },
  {
    step: '02',
    title: 'Earn an Accredited Degree',
    description: 'A fully recognised UK university degree from UCLan while you develop as a player.',
  },
  {
    step: '03',
    title: 'Graduate with Experience',
    description: '30+ fixtures a season, professional coaching, and real match analysis on your CV.',
  },
  {
    step: '04',
    title: 'Career Pathways',
    description: 'Routes into professional football, coaching, sports management, and further study.',
  },
]

const parentPoints = [
  {
    label: 'Accredited Education',
    detail: 'UCLan degrees recognised worldwide — 38,000+ students across 120+ countries.',
  },
  {
    label: 'Structured Timetables',
    detail: 'Academic sessions are scheduled around football, with attendance and progress monitored.',
  },
  {
    label: 'Pastoral Support',
    detail: 'Dedicated welfare staff, regular parent communication, and on-site support for every player.',
  },
  {
    label: 'Flexible Entry',
    detail: 'Gap year and residency options for players not yet ready for a full degree commitment.',
  },
]

export function InTheClassroom() {
  return (
    <section className="py-20 md:py-28 bg-[#FAFAFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header — full-width, no image split */}
        <FadeIn className="max-w-3xl mb-10 md:mb-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              In the Classroom
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 leading-[1.1]">
            Football and Education Together
          </h2>
          <p className="mt-5 text-base text-gray-600 leading-relaxed">
            Earn a fully accredited UK university degree while you train. IFG players
            study at the University of Central Lancashire — one of the UK&apos;s largest
            universities — with timetables designed around football, not the other way around.
          </p>
        </FadeIn>

        {/* Cinematic graduation banner */}
        <FadeIn threshold={0.1}>
          <div className="relative rounded-xl overflow-hidden shadow-lg">
            <div className="relative aspect-[21/9] sm:aspect-[3/1] bg-[#0A0A0A]">
              <Image
                src="/landing/photos/graduation-1.jpg"
                alt="IFG graduates at UCLan graduation ceremony"
                fill
                className="object-cover object-[center_35%]"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
            </div>
            {/* UCLan institutional bar */}
            <div className="flex items-center gap-5 bg-white border-t border-gray-200 px-6 py-4">
              <Image
                src="/landing/logos/uclan-white.png"
                alt="University of Central Lancashire"
                width={120}
                height={44}
                className="h-8 w-auto shrink-0 invert"
              />
              <div className="w-px h-6 bg-gray-300 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Official Academic Partner
                </span>
                <span className="text-[13px] font-medium text-gray-600 leading-snug mt-0.5">
                  University of Central Lancashire
                </span>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Education Pathway progression */}
        <FadeIn delay={100} className="mt-14 md:mt-18">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400 block mb-6">
            Education Pathway
          </span>

          {/* Desktop: horizontal flow */}
          <div className="hidden md:grid md:grid-cols-4 gap-0 relative">
            {/* Connecting line with red fade at endpoints */}
            <div className="absolute top-[22px] left-[calc(12.5%+24px)] right-[calc(12.5%+24px)] h-px bg-gradient-to-r from-red-600/30 via-gray-300 to-red-600/30" />

            {pathway.map((step) => (
              <div key={step.step} className="relative text-center px-5">
                <div className="relative z-10 w-11 h-11 rounded-full border-2 border-red-600 bg-[#FAFAFA] flex items-center justify-center mx-auto mb-5">
                  <span className="font-oswald text-sm font-bold text-red-600">{step.step}</span>
                </div>
                <h3 className="font-oswald text-[15px] font-bold uppercase tracking-wide text-gray-900 mb-2.5">
                  {step.title}
                </h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          {/* Mobile: vertical timeline */}
          <div className="md:hidden space-y-0 relative">
            {/* Vertical connecting line */}
            <div className="absolute top-6 bottom-6 left-[21px] w-px bg-gradient-to-b from-red-600/30 via-gray-300 to-red-600/30" />

            {pathway.map((step) => (
              <div key={step.step} className="relative flex gap-5 py-4">
                <div className="relative z-10 w-11 h-11 rounded-full border-2 border-red-600 bg-[#FAFAFA] flex items-center justify-center shrink-0">
                  <span className="font-oswald text-sm font-bold text-red-600">{step.step}</span>
                </div>
                <div className="pt-2">
                  <h3 className="font-oswald text-[15px] font-bold uppercase tracking-wide text-gray-900 mb-1">
                    {step.title}
                  </h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Parent reassurance block */}
        <FadeIn delay={200} className="mt-12 md:mt-16">
          <div className="rounded-xl border border-gray-200 bg-white p-6 md:p-8 lg:p-10 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-[2px] bg-red-600" />
              <span className="font-oswald text-base font-semibold uppercase tracking-wider text-gray-900">
                For Parents
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-8 max-w-2xl">
              Choosing a football programme is a family decision. Here&apos;s how IFG ensures
              academic progression and player welfare are never compromised.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
              {parentPoints.map((point) => (
                <div key={point.label} className="border-l-2 border-red-600/30 pl-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1.5">
                    {point.label}
                  </h4>
                  <p className="text-[13px] text-gray-500 leading-relaxed">
                    {point.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
