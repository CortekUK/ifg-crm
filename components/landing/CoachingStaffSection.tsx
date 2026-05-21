'use client'

import Image from 'next/image'
import { FadeIn } from './FadeIn'
import { Badge } from '@/components/ui/badge'

const coaches = [
  {
    name: 'Ewan Gunter',
    role: 'Head Coach',
    qualification: 'UEFA A',
    description:
      'UEFA A Licensed Coach bringing extensive experience across all levels of the game. Leads the IFG coaching programme with a focus on technical, physical, and psychological development.',
  },
  {
    name: 'Alex Marr',
    role: 'Coach',
    qualification: 'UEFA B',
    description:
      'UEFA B qualified coach with deep experience in player development. Works closely with IFG players on positional training and tactical awareness.',
  },
  {
    name: 'Matthew',
    role: 'Coach',
    qualification: 'UEFA A + UEFA B Futsal',
    description:
      'Holds a UEFA A License in Coaching Football and a UEFA B License in Coaching Futsal, bringing a versatile skill set to player development sessions.',
  },
  {
    name: 'Francesco Landucci',
    role: "Head of Women's Football",
    qualification: '12+ Years Experience',
    description:
      "Over 12 years of coaching experience across managing roles at various clubs. Now leads the Women's Football programme at Macclesfield FC.",
  },
  {
    name: 'Gareth',
    role: 'Goalkeeping & Outfield Coach',
    qualification: 'UEFA C (Outfield + GK)',
    description:
      'Holds UEFA C qualifications for both outfield coaching and goalkeeping, providing specialist support for players in all positions.',
  },
]

function CoachCard({ coach, delay }: { coach: (typeof coaches)[0]; delay: number }) {
  return (
    <FadeIn delay={delay} threshold={0.1}>
      <div className="rounded-xl border border-white/[0.12] bg-white/[0.06] p-6 h-full flex flex-col">
        <Badge
          variant="outline"
          className="w-fit text-[10px] border-red-600/30 text-red-400 mb-4"
        >
          {coach.qualification}
        </Badge>
        <h3 className="font-oswald text-base font-bold uppercase tracking-tight text-white leading-tight">
          {coach.name}
        </h3>
        <p className="text-xs text-white/50 mt-1 mb-4">{coach.role}</p>
        <p className="text-sm text-white/70 leading-relaxed flex-1">
          {coach.description}
        </p>
      </div>
    </FadeIn>
  )
}

export function CoachingStaffSection() {
  return (
    <section className="py-20 md:py-28 bg-[#111111]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-12">
          {/* Left column (40%): header + training photo */}
          <div className="lg:col-span-2">
            <FadeIn>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-[2px] bg-red-600" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                  Coaching Team
                </span>
              </div>
              <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-white leading-[1.1]">
                UEFA-Qualified Coaches
              </h2>
              <p className="mt-5 text-lg text-white/60 leading-relaxed">
                Every IFG session is led by UEFA-qualified coaches with professional and academy
                experience. A minimum of 14 hours per week of structured coaching tailored to
                your position, playing style, and goals.
              </p>
            </FadeIn>

            <FadeIn delay={150}>
              <div className="mt-8 relative aspect-[3/2] rounded-xl overflow-hidden">
                <Image
                  src="/landing/photos/training-3.webp"
                  alt="IFG coaching session"
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600" />
              </div>
            </FadeIn>
          </div>

          {/* Right column (60%): coach cards in 2-col sub-grid + masterclass */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              {coaches.map((coach, i) => (
                <CoachCard key={coach.name} coach={coach} delay={i * 80} />
              ))}
            </div>

            {/* Guest masterclass */}
            <FadeIn delay={100}>
              <div className="rounded-xl border border-white/[0.12] bg-white/[0.06] p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full bg-red-600" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-white/50">
                    Guest Masterclass
                  </span>
                </div>
                <h3 className="font-oswald text-xl font-bold uppercase tracking-tight text-white">
                  Robert Huth
                </h3>
                <Badge
                  variant="outline"
                  className="mt-2 text-[10px] border-amber-600/30 text-amber-400"
                >
                  3x Premier League Winner
                </Badge>
                <p className="mt-3 text-sm text-white/70 leading-relaxed max-w-2xl">
                  Former German international. 326 top-flight appearances for Chelsea, Middlesbrough,
                  Stoke City, and Leicester City. Guest masterclass at The Leasing.com Stadium, June 2025.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  )
}
