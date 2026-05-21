import type { Programme } from '@/lib/landing/programmes'
import { testimonials, stats } from '@/lib/landing/programmes'
import { getAccentColors } from '@/lib/landing/programme-colors'
import { TestimonialCard } from './TestimonialCard'

interface ProgrammeProofProps {
  programmeName: string
  category?: Programme['category']
}

export function ProgrammeProof({ programmeName, category }: ProgrammeProofProps) {
  const accent = category ? getAccentColors(category) : null
  const lineColor = accent?.line || 'bg-red-600'

  const relevantTestimonials = testimonials.filter(
    (t) => t.programme === programmeName
  )

  const displayTestimonials =
    relevantTestimonials.length > 0
      ? relevantTestimonials
      : testimonials.slice(0, 2)

  return (
    <section className="py-20 md:py-28 bg-[#0A0A0A]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-20">
          {stats.map((stat, i) => (
            <div key={stat.label} className="relative">
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
          ))}
        </div>

        {/* Testimonials */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-[2px] ${lineColor}`} />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              Success Stories
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-4xl font-bold uppercase tracking-tight text-white leading-[1.1]">
            Real Players. Real Results.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {displayTestimonials.map((t, i) => (
            <TestimonialCard key={i} testimonial={t} variant="dark" />
          ))}
        </div>
      </div>
    </section>
  )
}
