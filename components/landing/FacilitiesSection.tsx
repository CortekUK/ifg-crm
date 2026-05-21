'use client'

import Image from 'next/image'
import { FadeIn } from './FadeIn'

const facilities = [
  {
    name: 'The Leasing.com Stadium',
    description:
      'Home to Macclesfield FC and IFG. Over £4M invested in the stadium over the last two years, including an all-weather 4G surface ensuring training and matches are unaffected by the elements year-round.',
    image: '/landing/photos/stadium.jpeg',
    tag: 'Home Ground',
  },
  {
    name: 'Stealth Gymnasium',
    description:
      'A dedicated fitness facility at Macclesfield FC tailored to meet the demands of modern footballers. Full access included for all programme participants.',
    image: '/landing/photos/gym.webp',
    tag: 'Strength & Conditioning',
  },
  {
    name: 'Sir Tom Finney Sports Centre',
    description:
      'UCLan\'s flagship sports facility in Preston, available to all University and Gap Year programme participants. First-class pitches, labs, and performance analysis suites.',
    image: '/landing/photos/training-2.webp',
    tag: 'UCLan Campus',
  },
]

const accommodation = [
  {
    type: 'University & Gap Year',
    description:
      'Contemporary en-suite and studio apartments in Preston city centre — within walking distance of the train station, giving students direct access to Manchester Airport and other major cities.',
    detail: 'Modern build (2023), world-class amenities',
  },
  {
    type: 'Residency Programme',
    description:
      'Centrally-based 4-star hotel with excellent facilities, all within a short distance from The Leasing.com Stadium. Three meals per day at the dedicated Academy Restaurant with comprehensive nutritional guidance.',
    detail: '4-star hotel, full board included',
  },
]

export function FacilitiesSection() {
  return (
    <section className="py-20 md:py-28 bg-gray-50 dark:bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn className="max-w-3xl mb-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-white/50">
              Facilities & Accommodation
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1]">
            Where You&apos;ll Train & Live
          </h2>
          <p className="mt-5 text-lg text-gray-600 dark:text-muted-foreground leading-relaxed max-w-2xl">
            Professional-grade facilities backed by over £4 million in investment.
            Every IFG player gets access to the same venues and equipment used by Macclesfield FC&apos;s first team.
          </p>
        </FadeIn>

        {/* Facilities grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-16">
          {facilities.map((facility, i) => (
            <FadeIn key={facility.name} delay={i * 100} threshold={0.1}>
              <div className="group relative rounded-xl overflow-hidden h-80 lg:h-96">
                <Image
                  src={facility.image}
                  alt={facility.name}
                  fill
                  className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-white/50 mb-2">
                    {facility.tag}
                  </span>
                  <h3 className="font-oswald text-lg font-bold uppercase tracking-tight text-white mb-2">
                    {facility.name}
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {facility.description}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Accommodation cards */}
        <FadeIn>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-[2px] bg-red-600" />
            <span className="font-oswald text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-foreground">
              Accommodation
            </span>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {accommodation.map((acc, i) => (
            <FadeIn key={acc.type} delay={i * 80} threshold={0.1}>
              <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 h-full flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-red-600 dark:text-red-500 mb-3">
                  {acc.type}
                </span>
                <p className="text-sm text-gray-600 dark:text-muted-foreground leading-relaxed flex-1">
                  {acc.description}
                </p>
                <p className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 text-xs text-gray-500 dark:text-white/40 font-medium">
                  {acc.detail}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
