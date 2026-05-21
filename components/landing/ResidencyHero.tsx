import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SmoothScrollLink } from './SmoothScrollLink'
import { ArrowRight, FileText, Phone } from 'lucide-react'

const CALENDAR_URL = 'https://calendly.com/ifg-macclesfield/consultation'

const highlights = [
  {
    label: 'UEFA-Qualified Coaching',
    image: '/landing/photos/training-3.webp',
  },
  {
    label: 'Daily Training Programme',
    image: '/landing/photos/training-1.webp',
  },
  {
    label: '4-Star Accommodation',
    image: '/landing/photos/summer-3.webp',
  },
  {
    label: 'Unlimited Gym Access',
    image: '/landing/photos/gym.webp',
  },
]

export function ResidencyHero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-end overflow-hidden bg-[#0A0A0A]">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src="/landing/photos/training-experience.jpg"
          alt="Training at Macclesfield FC"
          fill
          priority
          className="object-cover object-top"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-[#0A0A0A]/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/70 via-[#0A0A0A]/30 to-transparent" />
      </div>

      {/* Partner logos — top, larger */}
      <div className="absolute top-24 left-0 right-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-5">
            <Image
              src="/landing/logos/uclan-white.png"
              alt="UCLan"
              width={180}
              height={54}
              className="object-contain h-10 md:h-12 w-auto"
            />
            <span className="text-white/30 text-lg font-light">×</span>
            <Image
              src="/landing/logos/macclesfield-fc-white.png"
              alt="Macclesfield FC"
              width={48}
              height={48}
              className="object-contain h-10 md:h-12 w-auto"
            />
          </div>
        </div>
      </div>

      {/* Main content — bottom-left aligned */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-8 md:pb-12">
        {/* Date badge */}
        <div className="mb-5">
          <span className="inline-block bg-amber-600 text-white text-[11px] font-bold uppercase tracking-[0.2em] px-4 py-2">
            Summer 2026 · Jun 20 — Aug 1
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-oswald text-[3.5rem] sm:text-7xl md:text-8xl lg:text-9xl font-bold uppercase text-white tracking-tight leading-[0.85] max-w-4xl">
          Summer
          <br />
          Residency
        </h1>

        <p className="mt-5 text-base sm:text-lg text-white/50 max-w-md leading-relaxed">
          For international players aged 15–18. Five hours of UEFA-qualified coaching daily at Macclesfield FC.
        </p>

        {/* Duration pills */}
        <div className="mt-5 flex items-center gap-2">
          {['2 Weeks', '4 Weeks', '6 Weeks'].map((d) => (
            <span
              key={d}
              className="px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-wider"
            >
              {d}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <SmoothScrollLink href="#enquire">
            <Button
              size="lg"
              className="bg-amber-600 hover:bg-amber-700 text-white text-base px-8 h-13 font-semibold tracking-wide"
            >
              Apply Now
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </SmoothScrollLink>
          <SmoothScrollLink href="#enquire">
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 hover:text-white bg-white/5 text-base px-6 h-13 font-medium"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              View Brochure
            </Button>
          </SmoothScrollLink>
          <Link href={CALENDAR_URL} target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 hover:text-white bg-white/5 text-base px-6 h-13 font-medium"
            >
              <Phone className="h-4 w-4 mr-1.5" />
              Book a Call
            </Button>
          </Link>
        </div>

        {/* Highlight cards — floating below hero content */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {highlights.map((h) => (
            <div
              key={h.label}
              className="relative rounded-xl overflow-hidden group h-24 md:h-28"
            >
              <Image
                src={h.image}
                alt={h.label}
                fill
                className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-[11px] md:text-xs font-bold text-white uppercase tracking-wide leading-tight">
                  {h.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
        <div className="w-5 h-8 rounded-full border-2 border-white/20 flex items-start justify-center pt-1.5">
          <div className="w-1 h-2 rounded-full bg-white/40 animate-bounce" />
        </div>
      </div>
    </section>
  )
}
