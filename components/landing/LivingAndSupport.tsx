import Image from 'next/image'
import { FadeIn } from './FadeIn'

const facilities = [
  {
    name: 'The Leasing.com Stadium',
    description:
      'Home to Macclesfield FC and IFG. Over \u00A34M invested in the stadium over the last two years, including an all-weather 4G surface ensuring training and matches are unaffected by the elements year-round.',
    image: '/landing/photos/stadium.jpeg',
    tag: 'Home Ground',
  },
  {
    name: 'Stealth Gymnasium',
    description:
      'A dedicated fitness facility at Macclesfield FC tailored to meet the demands of modern footballers. Full access included for all programme participants.',
    image: '/landing/photos/gym.webp',
    tag: 'Strength & Conditioning',
  },
]

const accommodation = [
  {
    type: 'University & Gap Year',
    description:
      'Contemporary en-suite and studio apartments in Preston city centre \u2014 within walking distance of the train station, giving students direct access to Manchester Airport and other major cities.',
    detail: 'Modern build (2023), world-class amenities',
  },
  {
    type: 'Residency Programme',
    description:
      'Centrally-based 4-star hotel with excellent facilities, all within a short distance from The Leasing.com Stadium. Three meals per day at the dedicated Academy Restaurant with comprehensive nutritional guidance.',
    detail: '4-star hotel, full board included',
  },
]

const supportBullets = [
  'Full accommodation and meals included',
  'All transport to training, matches, and events',
  'Dedicated pastoral care and parent communication',
  'Clear progression routes into longer programmes or professional trials',
]

export function LivingAndSupport() {
  return (
    <section className="py-20 md:py-28 bg-gray-50 dark:bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn className="max-w-3xl mb-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-white/50">
              Living & Support
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1]">
            Where You&apos;ll Train & Live
          </h2>
          <p className="mt-5 text-lg text-gray-600 dark:text-muted-foreground leading-relaxed max-w-2xl">
            Professional-grade facilities backed by over &pound;4 million in investment.
            Every IFG player gets access to the same venues and equipment used by Macclesfield FC&apos;s first team.
          </p>
        </FadeIn>

        {/* Top row: facility photos — stadium spans 2 cols, gym 1 col */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {facilities.map((facility, i) => (
            <FadeIn
              key={facility.name}
              delay={i * 100}
              threshold={0.1}
              className={i === 0 ? 'lg:col-span-2' : ''}
            >
              <div className="group relative rounded-xl overflow-hidden h-64 lg:h-80">
                <Image
                  src={facility.image}
                  alt={facility.name}
                  fill
                  className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  sizes={i === 0 ? '(max-width: 1024px) 100vw, 66vw' : '(max-width: 1024px) 100vw, 33vw'}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-white/50 mb-2">
                    {facility.tag}
                  </span>
                  <h3 className="font-oswald text-lg font-bold uppercase tracking-tight text-white mb-2">
                    {facility.name}
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {facility.description}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Bottom row: support content + accommodation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Left: photo + support content */}
          <FadeIn from="left">
            <div className="relative aspect-[16/9] rounded-xl overflow-hidden mb-6">
              <Image
                src="/landing/photos/summer-1.webp"
                alt="IFG player support and pastoral care"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-600 dark:text-red-500">
              Pathways & Player Support
            </span>
            <h3 className="font-oswald text-2xl md:text-3xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1] mt-2 mb-4">
              Real Pathways. Real Support.
            </h3>
            <p className="text-[15px] text-gray-600 dark:text-muted-foreground leading-relaxed mb-6">
              IFG isn&apos;t a holiday camp. It&apos;s a structured, full-time programme designed for
              players who want to be treated like professionals — and parents who need to know
              their child is in the right hands. Full accommodation, transport, nutrition,
              pastoral care, and a clear route forward.
            </p>
            <div className="space-y-2.5">
              {supportBullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0 mt-2" />
                  <p className="text-sm text-gray-700 dark:text-foreground/80 leading-relaxed">
                    {bullet}
                  </p>
                </div>
              ))}
            </div>
          </FadeIn>

          {/* Right: accommodation */}
          <FadeIn from="right" delay={100}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-[2px] bg-red-600" />
              <span className="font-oswald text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-foreground">
                Accommodation
              </span>
            </div>
            <div className="space-y-6">
              {accommodation.map((acc) => (
                <div
                  key={acc.type}
                  className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 flex flex-col"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-red-600 dark:text-red-500 mb-3">
                    {acc.type}
                  </span>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground leading-relaxed flex-1">
                    {acc.description}
                  </p>
                  <p className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 text-xs text-gray-500 dark:text-white/40 font-medium">
                    {acc.detail}
                  </p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
