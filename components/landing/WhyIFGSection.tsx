'use client'

import { Dumbbell, GraduationCap, Swords, Globe, Home, ShieldCheck } from 'lucide-react'
import { FadeIn } from './FadeIn'

const pillars = [
  {
    icon: Dumbbell,
    title: 'Professional Training Environment',
    description:
      'A minimum of 14 hours coaching per week with UEFA-qualified coaches at Macclesfield FC. Bespoke training tailored to your position, playing style, and goals.',
  },
  {
    icon: GraduationCap,
    title: 'Continued Education',
    description:
      'Earn a fully accredited UK university degree from UCLan while you train. Timetables are designed to provide the perfect balance between learning, training, and match fixtures.',
  },
  {
    icon: Swords,
    title: 'Competitive Match Experience',
    description:
      'Two competitive matches per week in BUCS and national leagues. Build a match CV with real footage via PlayerData technology and personalised video analysis.',
  },
  {
    icon: Globe,
    title: 'Flexible Pathway Options',
    description:
      'From a 3-year university degree to a flexible gap year or an intensive short-term residency — IFG offers pathways designed around your age, ambitions, and timeline.',
  },
  {
    icon: Home,
    title: 'Player Lifestyle & Welfare',
    description:
      'Full accommodation, three meals per day for residency students, access to the Stealth Gymnasium and Sir Tom Finney Sports Centre. All transport to training and matches provided.',
  },
  {
    icon: ShieldCheck,
    title: 'Parent Guidance & Reassurance',
    description:
      'Dedicated pastoral care, regular progress reports, and a single point of contact for parents. We understand the trust involved in sending your child abroad.',
  },
]

export function WhyIFGSection() {
  return (
    <section className="py-20 md:py-28 bg-white dark:bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Editorial header */}
        <FadeIn className="max-w-3xl mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-white/50">
              Why IFG
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1]">
            Built Around What
            <br className="hidden md:block" /> Players Actually Need
          </h2>
          <p className="mt-5 text-lg text-gray-600 dark:text-muted-foreground leading-relaxed max-w-2xl">
            IFG isn&apos;t a holiday camp or a short-term clinic. It&apos;s a structured,
            full-time football and education programme designed for players who want
            to be treated like professionals — and parents who need to know their child
            is in the right hands.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {pillars.map((pillar, i) => (
            <FadeIn key={pillar.title} delay={i * 80} threshold={0.1}>
              <div className="group relative">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-[#0A0A0A] text-white shrink-0 group-hover:bg-red-600 transition-colors">
                    <pillar.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-oswald text-base font-semibold uppercase tracking-tight text-gray-900 dark:text-foreground leading-tight">
                    {pillar.title}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-muted-foreground leading-relaxed pl-[60px]">
                  {pillar.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
