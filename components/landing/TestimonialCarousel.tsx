'use client'

import Image from 'next/image'
import { testimonials } from '@/lib/landing/programmes'
import { Badge } from '@/components/ui/badge'
import { FadeIn } from './FadeIn'

export function TestimonialCarousel() {
  const featured = testimonials[0]
  const supporting = testimonials.slice(1)

  return (
    <section id="testimonials" className="py-20 md:py-28 bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn className="max-w-3xl mb-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              Success Stories
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-white leading-[1.1]">
            Real Players. Real Results.
          </h2>
          <p className="mt-4 text-base text-white/50 max-w-xl leading-relaxed">
            Verified outcomes from players who have been through the IFG pathway.
          </p>
        </FadeIn>

        {/* Featured story */}
        <FadeIn className="mb-6">
          <div className="relative rounded-xl overflow-hidden">
            <div className="absolute inset-0">
              <Image
                src="/landing/photos/match-day.jpg"
                alt="IFG match day at The Leasing.com Stadium"
                fill
                className="object-cover object-center"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/85 to-[#0A0A0A]/40" />
            </div>
            <div className="relative z-10 p-8 md:p-12 lg:p-16 min-h-[320px] md:min-h-[360px] flex flex-col justify-center">
              {featured.outcome && (
                <Badge
                  variant="outline"
                  className="w-fit border-red-600/30 text-red-400 text-[11px] mb-6"
                >
                  {featured.outcome}
                </Badge>
              )}
              <p className="text-lg md:text-xl lg:text-[22px] text-white/90 leading-relaxed font-light max-w-2xl mb-8">
                {featured.quote}
              </p>
              <div>
                <p className="text-base font-semibold text-white">
                  {featured.name}
                </p>
                <p className="text-sm text-white/50 mt-1">
                  {featured.programme}
                </p>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Supporting stories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {supporting.map((story, i) => (
            <FadeIn key={story.name} delay={i * 100}>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 md:p-8 h-full flex flex-col">
                {story.outcome && (
                  <Badge
                    variant="outline"
                    className="w-fit border-red-600/30 text-red-400/80 text-[11px] mb-4"
                  >
                    {story.outcome}
                  </Badge>
                )}
                <p className="text-[15px] text-white/80 leading-relaxed flex-1 mb-6">
                  {story.quote}
                </p>
                <div className="pt-4 border-t border-white/[0.06]">
                  <p className="text-sm font-semibold text-white">{story.name}</p>
                  <p className="text-xs text-white/40 mt-0.5">{story.programme}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
