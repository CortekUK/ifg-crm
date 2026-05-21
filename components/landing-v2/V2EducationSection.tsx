import Image from 'next/image'
import { FadeIn } from '@/components/landing/FadeIn'

export function V2EducationSection() {
  return (
    <section className="py-20 md:py-28 bg-[#FAFAFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Left column — 55% editorial copy */}
          <FadeIn from="left" className="lg:col-span-7">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-[2px] bg-red-600" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                Football + Education
              </span>
            </div>

            <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 leading-[1.1] mb-6">
              A Degree That Works
              <br />
              Around Football
            </h2>

            <p className="text-base text-gray-600 leading-relaxed mb-4 max-w-xl">
              IFG players study at the University of Central Lancashire — one of the
              UK&apos;s largest universities with over 38,000 students from 120+ countries.
              Timetables are designed around training and match schedules, not the other
              way around.
            </p>

            <p className="text-base text-gray-600 leading-relaxed mb-8 max-w-xl">
              Every graduate leaves with a fully accredited UK degree alongside 90+
              competitive matches on their CV. Carlos Dos Santos came through the
              University Programme before signing for Macclesfield FC First Team.
            </p>

            {/* For Parents callout */}
            <div className="rounded-xl bg-amber-50 border border-amber-200/60 p-6">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-[2px] bg-amber-500" />
                <span className="font-oswald text-sm font-semibold uppercase tracking-wider text-gray-900">
                  For Parents
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-5">
                Choosing a football programme is a family decision. IFG ensures academic
                progression and player welfare are never compromised.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Accredited Education', detail: 'UCLan degrees recognised worldwide' },
                  { label: 'Structured Timetables', detail: 'Attendance and progress monitored' },
                  { label: 'Pastoral Support', detail: 'Dedicated welfare staff on site' },
                  { label: 'Flexible Entry', detail: 'Gap year and residency options available' },
                ].map((point) => (
                  <div key={point.label} className="border-l-2 border-amber-400/50 pl-3">
                    <h4 className="text-sm font-semibold text-gray-900 mb-0.5">
                      {point.label}
                    </h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{point.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Right column — 45% stacked visuals */}
          <FadeIn from="right" delay={150} className="lg:col-span-5">
            <div className="space-y-5">
              {/* Graduation photo */}
              <div className="relative rounded-xl overflow-hidden aspect-[4/3]">
                <Image
                  src="/landing/photos/graduation-1.jpg"
                  alt="IFG graduates at UCLan graduation ceremony"
                  fill
                  className="object-cover object-[center_35%]"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              </div>

              {/* UCLan institutional badge card */}
              <div className="flex items-center gap-5 bg-white border border-gray-200 rounded-xl px-5 py-4">
                <Image
                  src="/landing/logos/uclan-white.png"
                  alt="University of Central Lancashire"
                  width={100}
                  height={38}
                  className="h-7 w-auto shrink-0 invert"
                />
                <div className="w-px h-8 bg-gray-200 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block">
                    Official Academic Partner
                  </span>
                  <span className="text-[13px] font-medium text-gray-600 leading-snug mt-0.5 block">
                    University of Central Lancashire
                  </span>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
