import Image from 'next/image'

const stats = [
  { value: '5', unit: 'Hrs', label: 'Coaching Per Day' },
  { value: '4★', unit: '', label: 'Hotel Accommodation' },
  { value: 'Full', unit: '', label: 'Adidas Kit Included' },
  { value: '6', unit: 'Wk', label: 'Juventus Partnership' },
]

export function ResidencyIntro() {
  return (
    <section className="relative py-20 md:py-28 bg-[#0A0A0A] overflow-hidden">
      {/* Subtle background image */}
      <div className="absolute inset-0 opacity-[0.07]">
        <Image
          src="/landing/photos/training-3.webp"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Date callout */}
        <div className="mb-8">
          <span className="inline-block bg-amber-600 text-white text-xs font-bold uppercase tracking-[0.2em] px-4 py-2">
            Summer 2026: June 20 — August 1
          </span>
        </div>

        {/* Bold headline */}
        <h2 className="font-oswald text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold uppercase tracking-tight text-white leading-[0.9] max-w-4xl">
          Train Like a Pro
          <span className="block text-amber-500">This Summer</span>
        </h2>

        <p className="mt-8 text-lg text-white/50 max-w-2xl leading-relaxed">
          Our Residency Programme offers international players aged 15–18 five hours of coaching a day from UEFA-qualified coaches, delivered at Macclesfield FC&apos;s Leasing.com Stadium with its state-of-the-art 4G pitch. The bespoke programme is tailored to your position, playing style, and goals.
        </p>

        {/* Stats grid */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 rounded-xl overflow-hidden">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-[#0A0A0A] p-6 md:p-8 text-center">
              <div className="font-oswald text-4xl md:text-5xl font-bold text-amber-500 tracking-tight leading-none">
                {stat.value}
                {stat.unit && (
                  <span className="text-2xl md:text-3xl text-amber-500/60 ml-1">{stat.unit}</span>
                )}
              </div>
              <p className="mt-2 text-xs text-white/40 uppercase tracking-[0.15em] font-medium">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
