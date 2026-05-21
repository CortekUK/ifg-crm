import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SmoothScrollLink } from '@/components/landing/SmoothScrollLink'
import { ArrowRight } from 'lucide-react'

export function V2HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0A0A0A]">
      {/* Background — heavier corner-fade gradient */}
      <div className="absolute inset-0">
        <Image
          src="/landing/photos/team-photo.jpeg"
          alt="IFG team photo"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/70 to-[#0A0A0A]/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/50 to-transparent" />
      </div>

      <div className="relative z-10 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-32 md:pt-40 md:pb-40">
          <div className="max-w-2xl">
            <h1 className="font-oswald text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold uppercase tracking-tight text-white leading-[0.9]">
              Your Football
              <br />
              Future Starts
              <br />
              <span className="text-red-500">Here</span>
            </h1>

            <p className="mt-8 text-lg md:text-xl text-white/70 max-w-lg leading-relaxed">
              Train with UEFA-qualified coaches, earn an accredited UK degree,
              and compete in 30+ fixtures a season — all from Macclesfield, UK.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-start gap-4">
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
                  Explore Programmes
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Partner logos bar — detached at viewport bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="bg-[#0A0A0A]/60 backdrop-blur-sm border-t border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex flex-wrap items-center gap-8 md:gap-10">
              <span className="text-[10px] font-medium uppercase tracking-widest text-white/30 shrink-0">
                In Partnership With
              </span>
              <Image
                src="/landing/logos/uclan-white.png"
                alt="University of Central Lancashire"
                width={140}
                height={52}
                className="h-9 w-auto opacity-60 hover:opacity-100 transition-opacity"
              />
              <Image
                src="/landing/logos/macclesfield-fc-white.png"
                alt="Macclesfield FC"
                width={48}
                height={48}
                className="h-10 w-auto opacity-60 hover:opacity-100 transition-opacity"
              />
              <div className="hidden sm:block w-px h-7 bg-white/10" />
              <Image
                src="/landing/logos/adidas.svg"
                alt="Adidas"
                width={72}
                height={48}
                className="h-7 w-auto brightness-0 invert opacity-50 hover:opacity-100 transition-opacity"
              />
              <Image
                src="/landing/logos/juventus-white.webp"
                alt="Juventus"
                width={40}
                height={48}
                className="h-9 w-auto opacity-50 hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
