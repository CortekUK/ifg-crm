'use client'

import { useState, useEffect, useCallback } from 'react'
import { testimonials } from '@/lib/landing/programmes'
import { Badge } from '@/components/ui/badge'
import { FadeIn } from './FadeIn'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const CYCLE_MS = 6000

export function TestimonialCarousel() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const total = testimonials.length

  const next = useCallback(() => setActive((i) => (i + 1) % total), [total])
  const prev = useCallback(() => setActive((i) => (i - 1 + total) % total), [total])

  // Auto-cycle
  useEffect(() => {
    if (paused) return
    const id = setInterval(next, CYCLE_MS)
    return () => clearInterval(id)
  }, [paused, next])

  const current = testimonials[active]

  return (
    <section id="testimonials" className="py-20 md:py-28 bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
          <div>
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
          </div>

          {/* Nav arrows */}
          <div className="flex items-center gap-3">
            <button
              onClick={prev}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 transition-colors"
              aria-label="Previous story"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={next}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 transition-colors"
              aria-label="Next story"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </FadeIn>

        {/* Main carousel area */}
        <FadeIn>
          <div
            className="relative rounded-xl border border-white/10 bg-white/[0.04] p-8 md:p-12 lg:p-16 min-h-[280px] flex flex-col justify-center"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="max-w-4xl mx-auto text-center">
              {/* Story text */}
              <p
                key={active}
                className="text-lg md:text-xl lg:text-[22px] text-white/90 leading-relaxed font-light animate-fade-in"
              >
                {current.quote}
              </p>

              {/* Attribution */}
              <div className="mt-8 flex flex-col items-center gap-3">
                <p className="text-base font-semibold text-white">{current.name}</p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Badge
                    variant="outline"
                    className="border-white/15 text-white/60 text-[11px]"
                  >
                    {current.programme}
                  </Badge>
                  {current.outcome && (
                    <Badge
                      variant="outline"
                      className="border-red-600/30 text-red-400/80 text-[11px]"
                    >
                      {current.outcome}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === active
                    ? 'w-8 bg-red-600'
                    : 'w-1.5 bg-white/20 hover:bg-white/40'
                )}
                aria-label={`Go to story ${i + 1}`}
              />
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
