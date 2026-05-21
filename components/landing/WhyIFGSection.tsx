'use client'

import Image from 'next/image'
import { FadeIn } from './FadeIn'

const blocks = [
  {
    label: 'Football Development',
    title: 'A Professional Training Environment',
    description:
      'A minimum of 14 hours coaching per week from UEFA-qualified coaches at Macclesfield FC. Bespoke programmes tailored to your position, playing style, and ambitions. Two competitive matches per week with real analysis and performance feedback.',
    bullets: [
      'UEFA A & B licensed coaching staff',
      '30+ competitive fixtures per season',
      'PlayerData video analysis technology',
      'Position-specific training sessions',
    ],
    image: '/landing/photos/first-team-training.jpeg',
    imageAlt: 'IFG training session at Macclesfield FC',
    objectPosition: 'object-[center_30%]',
    reverse: false,
  },
  {
    label: 'Education & Progression',
    title: 'Football and Education Together',
    description:
      'Earn a fully accredited UK university degree from UCLan while you train. Timetables are designed around football — not the other way around. For younger players, the gap year and residency programmes provide structured development without the academic commitment.',
    bullets: [
      'Accredited degrees at UCLan (38,000+ students, 120+ countries)',
      'Timetables built around training and match schedules',
      'Gap year and residency options for players not ready for university',
      'Scholarships and bursaries available for international students',
    ],
    image: '/landing/photos/graduation-1.jpg',
    imageAlt: 'IFG graduates at UCLan',
    objectPosition: 'object-[center_40%]',
    reverse: true,
  },
  {
    label: 'Pathways & Player Support',
    title: 'Real Pathways. Real Support.',
    description:
      'IFG isn\'t a holiday camp. It\'s a structured, full-time programme designed for players who want to be treated like professionals — and parents who need to know their child is in the right hands. Full accommodation, transport, nutrition, pastoral care, and a clear route forward.',
    bullets: [
      'Full accommodation and meals included',
      'All transport to training, matches, and events',
      'Dedicated pastoral care and parent communication',
      'Clear progression routes into longer programmes or professional trials',
    ],
    image: '/landing/photos/summer-1.webp',
    imageAlt: 'IFG player support and pastoral care',
    objectPosition: 'object-center',
    reverse: false,
  },
]

export function WhyIFGSection() {
  return (
    <section className="py-20 md:py-28 bg-white dark:bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
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
        </FadeIn>

        {/* Editorial blocks */}
        <div className="space-y-20 md:space-y-28">
          {blocks.map((block, i) => (
            <FadeIn key={block.label} delay={i * 100} threshold={0.05}>
              <div
                className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
                  block.reverse ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                {/* Image */}
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#0A0A0A]">
                  <Image
                    src={block.image}
                    alt={block.imageAlt}
                    fill
                    className={`object-cover brightness-105 contrast-105 ${block.objectPosition}`}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  {/* Subtle accent strip at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600" />
                </div>

                {/* Content */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-600 dark:text-red-500">
                    {block.label}
                  </span>
                  <h3 className="font-oswald text-2xl md:text-3xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1] mt-2 mb-4">
                    {block.title}
                  </h3>
                  <p className="text-[15px] text-gray-600 dark:text-muted-foreground leading-relaxed mb-6">
                    {block.description}
                  </p>
                  <div className="space-y-2.5">
                    {block.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0 mt-2" />
                        <p className="text-sm text-gray-700 dark:text-foreground/80 leading-relaxed">
                          {bullet}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
