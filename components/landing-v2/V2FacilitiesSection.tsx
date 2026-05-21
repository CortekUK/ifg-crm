import Image from 'next/image'
import { FadeIn } from '@/components/landing/FadeIn'
import { Home, Utensils, Wifi, ShieldCheck } from 'lucide-react'

const included = [
  { icon: Home, label: 'Private En-Suite Room', detail: 'Your own bedroom and bathroom' },
  { icon: Utensils, label: 'Meals Provided', detail: 'Residency: 3 meals/day at Academy Restaurant' },
  { icon: Wifi, label: 'Bills & Wi-Fi Included', detail: 'Electricity, heating, unlimited internet' },
  { icon: ShieldCheck, label: 'Welfare & Support', detail: 'Dedicated pastoral staff on site' },
]

export function V2FacilitiesSection() {
  return (
    <section className="py-20 md:py-28 bg-[#FAFAFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              Facilities & Living
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 leading-[1.1]">
            Where You&apos;ll Train & Live
          </h2>
          <p className="mt-4 text-base text-gray-600 max-w-xl leading-relaxed">
            Professional-grade facilities backed by over £4 million in investment.
            Every IFG player gets access to the same venues used by Macclesfield FC&apos;s first team.
          </p>
        </FadeIn>

        {/* Photo mosaic grid */}
        <FadeIn threshold={0.1}>
          <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-4 mb-12">
            {/* Stadium — wide span */}
            <div className="md:col-span-2 md:row-span-1 group relative rounded-xl overflow-hidden aspect-[16/10] md:aspect-auto md:h-full min-h-[220px]">
              <Image
                src="/landing/photos/stadium.jpeg"
                alt="The Leasing.com Stadium"
                fill
                className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">
                  Home Ground
                </span>
                <h3 className="font-oswald text-lg font-bold uppercase tracking-tight text-white">
                  The Leasing.com Stadium
                </h3>
              </div>
            </div>

            {/* Gym — tall portrait */}
            <div className="md:col-span-1 md:row-span-2 group relative rounded-xl overflow-hidden aspect-[3/4] md:aspect-auto md:h-full min-h-[220px]">
              <Image
                src="/landing/photos/gym.webp"
                alt="Stealth Gymnasium"
                fill
                className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">
                  Strength & Conditioning
                </span>
                <h3 className="font-oswald text-lg font-bold uppercase tracking-tight text-white">
                  Stealth Gymnasium
                </h3>
              </div>
            </div>

            {/* Training photo */}
            <div className="md:col-span-1 md:row-span-1 group relative rounded-xl overflow-hidden aspect-[4/3] md:aspect-auto md:h-full min-h-[220px]">
              <Image
                src="/landing/photos/training-2.webp"
                alt="Sir Tom Finney Sports Centre"
                fill
                className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 block mb-1">
                  UCLan Campus
                </span>
                <h3 className="font-oswald text-[15px] font-bold uppercase tracking-tight text-white">
                  Sir Tom Finney Sports Centre
                </h3>
              </div>
            </div>

            {/* Text accommodation card */}
            <div className="md:col-span-2 md:row-span-1 rounded-xl border border-gray-200 bg-white p-6 flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-2">
                Accommodation
              </span>
              <h3 className="font-oswald text-lg font-bold uppercase tracking-tight text-gray-900 mb-2">
                Modern En-Suite Apartments
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Contemporary apartments in Preston city centre — private bedroom with
                en-suite bathroom, shared kitchen and living area, and all bills included.
                Residency players stay in a centrally-based 4-star hotel with full board.
              </p>
            </div>
          </div>
        </FadeIn>

        {/* Included strip */}
        <FadeIn delay={150}>
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 block mb-4">
              Included for All Players
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {included.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
