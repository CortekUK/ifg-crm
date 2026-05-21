import Image from 'next/image'
import { FadeIn } from './FadeIn'

const stats = [
  { value: '14+', unit: 'Hrs/Week', caption: 'Structured Coaching' },
  { value: '30+', unit: 'Fixtures', caption: 'Per Season' },
  { value: '600+', unit: 'Matches', caption: 'Played to Date' },
]

const trainingWeek = [
  { day: 'MON', session: 'Technical & Analysis' },
  { day: 'TUE', session: 'Positional & S&C' },
  { day: 'WED', session: 'Match Day' },
  { day: 'THU', session: 'Recovery & Tactics' },
  { day: 'FRI', session: 'Team & Set Pieces' },
  { day: 'SAT', session: 'Match Day' },
]

export function OnThePitch() {
  return (
    <section className="relative overflow-hidden bg-[#0A0A0A] border-t border-white/[0.08]">
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Left: Full-bleed training image — no overlay, image speaks for itself */}
        <div className="relative h-[320px] sm:h-[400px] lg:h-auto lg:min-h-[620px]">
          <Image
            src="/landing/photos/first-team-training.jpeg"
            alt="IFG training session at Macclesfield FC"
            fill
            className="object-cover object-[center_30%]"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          {/* Vertical red accent on right edge — desktop */}
          <div className="hidden lg:block absolute top-0 bottom-0 right-0 w-[3px] bg-red-600" />
          {/* Horizontal red accent on bottom — mobile */}
          <div className="lg:hidden absolute bottom-0 left-0 right-0 h-[3px] bg-red-600" />
        </div>

        {/* Right: Content — stats-led editorial layout */}
        <div className="px-6 sm:px-10 lg:px-14 xl:px-20 py-14 md:py-18 lg:py-20 flex flex-col justify-center">
          {/* Section label */}
          <FadeIn>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-[2px] bg-red-600" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                On the Pitch
              </span>
            </div>
            <h2 className="font-oswald text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-tight text-white leading-[1.1]">
              A Professional
              <br />
              Training Environment
            </h2>
          </FadeIn>

          <FadeIn delay={100}>
            <p className="mt-5 text-[15px] text-white/65 leading-relaxed max-w-lg">
              A minimum of 14 hours coaching per week from UEFA-qualified coaches at
              Macclesfield FC. Bespoke programmes tailored to your position, playing
              style, and ambitions — with two competitive matches per week, real
              performance analysis, and PlayerData video technology.
            </p>
          </FadeIn>

          {/* Stats — dominant typographic feature */}
          <FadeIn delay={200}>
            <div className="mt-10 grid grid-cols-3">
              {stats.map((stat, i) => (
                <div
                  key={stat.unit}
                  className={
                    i > 0 ? 'border-l border-white/10 pl-5 sm:pl-6 lg:pl-8' : ''
                  }
                >
                  <div className="font-oswald text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-none">
                    {stat.value}
                  </div>
                  <div className="mt-2 text-[11px] font-bold uppercase tracking-widest text-red-500">
                    {stat.unit}
                  </div>
                  <div className="mt-1 text-[11px] text-white/35 tracking-wide">
                    {stat.caption}
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>

          {/* Editorial detail: Typical Training Week */}
          <FadeIn delay={300}>
            <div className="mt-10 pt-7 border-t border-white/[0.08]">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30 block mb-4">
                Typical Training Week
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {trainingWeek.map((day) => (
                  <div
                    key={day.day}
                    className={`text-center px-2 py-3 rounded-lg ${
                      day.session === 'Match Day'
                        ? 'bg-red-600/15 border border-red-600/20'
                        : 'bg-white/[0.04] border border-white/[0.06]'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                      {day.day}
                    </div>
                    <div
                      className={`text-[11px] leading-snug ${
                        day.session === 'Match Day'
                          ? 'text-red-400 font-semibold'
                          : 'text-white/40'
                      }`}
                    >
                      {day.session}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
