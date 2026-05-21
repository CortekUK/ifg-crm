'use client'

import Image from 'next/image'
import { FadeIn } from './FadeIn'

const partners: {
  name: string
  logo: string
  logoWidth: number
  logoHeight: number
  relationship: string
  logoClass?: string
}[] = [
  {
    name: 'University of Central Lancashire',
    logo: '/landing/logos/uclan-white.png',
    logoWidth: 160,
    logoHeight: 60,
    relationship: 'Academic Partner',
  },
  {
    name: 'Macclesfield FC',
    logo: '/landing/logos/macclesfield-fc-white.png',
    logoWidth: 56,
    logoHeight: 56,
    relationship: 'Club Partner',
  },
  {
    name: 'Adidas',
    logo: '/landing/logos/adidas.svg',
    logoWidth: 80,
    logoHeight: 56,
    relationship: 'Kit Partner',
    logoClass: 'brightness-0 invert',
  },
  {
    name: 'Juventus FC',
    logo: '/landing/logos/juventus-white.webp',
    logoWidth: 48,
    logoHeight: 56,
    relationship: 'Experience Partner',
  },
]

export function PartnerLogos() {
  return (
    <section className="py-16 md:py-20 bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-10">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
              Official Partners & Institutions
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.06] rounded-xl overflow-hidden">
            {partners.map((partner) => (
              <div
                key={partner.name}
                className="bg-[#0A0A0A] flex flex-col items-center justify-center py-10 md:py-14 px-6 group hover:bg-white/[0.03] transition-colors"
              >
                <div className="h-14 flex items-center justify-center mb-4">
                  <Image
                    src={partner.logo}
                    alt={partner.name}
                    width={partner.logoWidth}
                    height={partner.logoHeight}
                    className={`max-h-12 w-auto object-contain opacity-70 group-hover:opacity-100 transition-opacity ${partner.logoClass ?? ''}`}
                  />
                </div>
                <span className="text-[11px] font-semibold text-white/50 group-hover:text-white/70 transition-colors text-center leading-snug">
                  {partner.name}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-widest text-white/30 group-hover:text-white/50 transition-colors mt-1">
                  {partner.relationship}
                </span>
              </div>
            ))}
          </div>

          <p className="text-center mt-6 text-[13px] text-white/40 max-w-2xl mx-auto leading-relaxed">
            IFG&apos;s programmes are delivered in partnership with established institutions
            in football, education, and sport — providing players with genuine professional pathways.
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
