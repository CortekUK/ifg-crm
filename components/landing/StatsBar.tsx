'use client'

import { stats } from '@/lib/landing/programmes'
import { FadeIn } from './FadeIn'

export function StatsBar() {
  return (
    <section className="bg-[#111111] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12">
          {stats.map((stat, i) => (
            <FadeIn key={stat.label} delay={i * 100} duration={500}>
              <div className="relative">
                {i > 0 && (
                  <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 w-px h-10 bg-white/10" />
                )}
                <div className={i > 0 ? 'md:pl-12' : ''}>
                  <div className="font-oswald text-4xl md:text-5xl font-bold text-white tracking-tight">
                    {stat.value}
                  </div>
                  <div className="mt-1.5 text-sm text-white/50 font-medium uppercase tracking-wider">
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
