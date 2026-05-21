'use client'

import { stats } from '@/lib/landing/programmes'
import { FadeIn } from './FadeIn'

export function StatsBar() {
  return (
    <section className="relative bg-[#0C0C0C] border-y border-white/[0.06]">
      {/* Subtle depth gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-18">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0">
          {stats.map((stat, i) => (
            <FadeIn key={stat.label} delay={i * 100} duration={500}>
              <div
                className={`relative ${
                  i > 0 ? 'md:border-l md:border-white/[0.08]' : ''
                }`}
              >
                <div className={i > 0 ? 'md:pl-10' : ''}>
                  <div className="font-oswald text-4xl md:text-5xl font-bold text-white tracking-tight">
                    {stat.value}
                  </div>
                  <div className="mt-2 text-[13px] text-white/40 font-medium uppercase tracking-wider">
                    {stat.label}
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
