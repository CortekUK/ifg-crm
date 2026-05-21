'use client'

import {
  Trophy,
  Swords,
  Video,
  Dumbbell,
  Target,
  Home,
  Bus,
  UtensilsCrossed,
} from 'lucide-react'
import { FadeIn } from './FadeIn'

const benefits = [
  {
    icon: Trophy,
    title: 'Professional Coaching',
    description:
      'A minimum of 14 hours per week with UEFA-qualified coaches. Bespoke programmes tailored to your position, playing style, and goals.',
  },
  {
    icon: Swords,
    title: 'Competitive Matches',
    description:
      'Two competitive matches per week in BUCS and national leagues. Build a match CV with real fixture experience.',
  },
  {
    icon: Video,
    title: 'Video Analysis',
    description:
      'Video-based feedback and personalised analysis sessions with PlayerData technology that quantifies every aspect of your game.',
  },
  {
    icon: Dumbbell,
    title: 'Strength & Conditioning',
    description:
      'Regular S&C sessions led by industry experts with training regimes targeted to your playing position.',
  },
  {
    icon: Target,
    title: 'Position-Specific Training',
    description:
      'Dedicated sessions tailored to goalkeepers, defenders, midfielders, and strikers throughout every programme.',
  },
  {
    icon: Home,
    title: 'Accommodation',
    description:
      'Safe, modern accommodation options from private single rooms to shared apartments. All bills covered including WiFi.',
  },
  {
    icon: Bus,
    title: 'Transport',
    description:
      'Transport provided to all training sessions, matches, and events — so you can focus entirely on your development.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Nutrition',
    description:
      'Three meals per day for residency students with comprehensive nutritional guidance to support peak performance.',
  },
]

export function ProgrammeBenefitsSection() {
  return (
    <section className="py-20 md:py-28 bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="max-w-3xl mb-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              What&apos;s Included
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-white leading-[1.1]">
            Benefits of Our Programmes
          </h2>
          <p className="mt-5 text-lg text-white/60 leading-relaxed max-w-2xl">
            Every IFG programme is designed to give players a professional environment
            with everything they need to develop — on and off the pitch.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, i) => (
            <FadeIn key={benefit.title} delay={i * 60} threshold={0.1}>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 h-full flex flex-col group hover:border-white/20 transition-colors">
                <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-white/[0.06] text-white/70 mb-4 group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <benefit.icon className="h-5 w-5" />
                </div>
                <h3 className="font-oswald text-sm font-bold uppercase tracking-tight text-white mb-2">
                  {benefit.title}
                </h3>
                <p className="text-[13px] text-white/50 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
