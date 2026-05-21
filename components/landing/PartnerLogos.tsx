'use client'

import Image from 'next/image'
import { FadeIn } from './FadeIn'

const partners = [
  {
    name: 'University of Central Lancashire',
    shortName: 'UCLan',
    logo: '/landing/logos/uclan-white.png',
    logoWidth: 180,
    logoHeight: 67,
    description:
      'Our official academic partner. IFG players study for fully accredited undergraduate and postgraduate degrees at one of the UK\'s largest universities.',
    relationship: 'Academic Partner',
  },
  {
    name: 'Macclesfield Football Club',
    shortName: 'Macclesfield FC',
    logo: '/landing/logos/macclesfield-fc-white.png',
    logoWidth: 100,
    logoHeight: 100,
    description:
      'Our home club partner providing professional-grade facilities, competitive league football, and a direct route into the English football pyramid.',
    relationship: 'Club Partner',
  },
]

export function PartnerLogos() {
  return (
    <section className="py-20 md:py-28 bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-14">
          <div className="flex items-center gap-3 justify-center mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              Our Partners
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-white leading-[1.1]">
            Official Football & Education
            <br className="hidden sm:block" /> Partners
          </h2>
          <p className="mt-4 text-base text-white/50 max-w-2xl mx-auto leading-relaxed">
            IFG&apos;s programmes are backed by partnerships with established institutions
            in football and higher education — not just logos on a page.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {partners.map((partner, i) => (
            <FadeIn key={partner.shortName} delay={i * 120} threshold={0.1}>
              <div className="relative rounded-xl border border-white/10 bg-white/[0.05] p-8 md:p-10 hover:border-white/20 transition-colors flex flex-col items-center text-center h-full">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-5">
                  {partner.relationship}
                </span>
                <div className="h-24 flex items-center justify-center mb-6">
                  <Image
                    src={partner.logo}
                    alt={partner.name}
                    width={partner.logoWidth}
                    height={partner.logoHeight}
                    className="max-h-20 w-auto object-contain"
                  />
                </div>
                <p className="text-[13px] font-medium text-white/70 mb-2">
                  {partner.name}
                </p>
                <p className="text-sm text-white/40 leading-relaxed">
                  {partner.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
