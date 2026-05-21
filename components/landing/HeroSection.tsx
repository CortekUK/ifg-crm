import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SmoothScrollLink } from './SmoothScrollLink'
import { ArrowRight } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-end overflow-hidden bg-[#0A0A0A]">
      {/* Background — real IFG team photo */}
      <div className="absolute inset-0">
        <Image
          src="/landing/photos/team-photo.jpeg"
          alt="IFG team photo"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-[#0A0A0A]/20" />
      </div>

      <div className="relative z-10 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 md:pb-28 pt-48 md:pt-56">
          <div className="max-w-3xl">
            {/* Accent line */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-[2px] bg-red-600" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Macclesfield, UK
              </span>
            </div>

            <p className="font-oswald text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-red-500 mb-3">
              For Ambitious Players and Their Families
            </p>

            <h1 className="font-oswald text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold uppercase tracking-tight text-white leading-[0.9]">
              Elite Football
              <br />
              Education
            </h1>

            <p className="mt-7 text-lg md:text-xl text-white/70 max-w-xl leading-relaxed">
              Train with UEFA-qualified coaches, earn an accredited UK degree, and
              compete in 30+ fixtures a season — all from Macclesfield, UK.
            </p>

            <div className="mt-12 flex flex-col sm:flex-row items-start gap-4">
              <SmoothScrollLink href="#enquire">
                <Button
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 text-white text-base px-8 h-13 font-semibold tracking-wide"
                >
                  Start Your Application
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </SmoothScrollLink>
              <Link href="/landing/programmes">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/25 text-white hover:bg-white/10 hover:text-white text-base px-8 h-13 bg-white/5 font-medium"
                >
                  Explore Player Pathways
                </Button>
              </Link>
            </div>
          </div>

          {/* Partner logos bar */}
          <div className="mt-20 pt-8 border-t border-white/10">
            <span className="text-[11px] font-medium uppercase tracking-widest text-white/30 block mb-6">
              In Partnership With
            </span>
            <div className="flex flex-wrap items-center gap-8 md:gap-10">
              <Image
                src="/landing/logos/uclan-white.png"
                alt="University of Central Lancashire"
                width={140}
                height={52}
                className="h-10 w-auto opacity-70 hover:opacity-100 transition-opacity"
              />
              <Image
                src="/landing/logos/macclesfield-fc-white.png"
                alt="Macclesfield FC"
                width={48}
                height={48}
                className="h-11 w-auto opacity-70 hover:opacity-100 transition-opacity"
              />
              <div className="hidden sm:block w-px h-8 bg-white/10" />
              <Image
                src="/landing/logos/adidas.svg"
                alt="Adidas"
                width={72}
                height={48}
                className="h-8 w-auto brightness-0 invert opacity-60 hover:opacity-100 transition-opacity"
              />
              <Image
                src="/landing/logos/juventus-white.webp"
                alt="Juventus"
                width={40}
                height={48}
                className="h-10 w-auto opacity-60 hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
