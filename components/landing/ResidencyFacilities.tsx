import Image from 'next/image'

const facilities = [
  {
    title: 'The Leasing.com Stadium',
    description: 'State-of-the-art 4G pitch and training facilities, home of Macclesfield FC.',
    image: '/landing/photos/stadium.jpeg',
    span: 'col-span-2 row-span-2',
    tall: true,
  },
  {
    title: 'Gym & Conditioning',
    description: 'Full-access gymnasium for strength and conditioning sessions.',
    image: '/landing/photos/gym.webp',
    span: 'col-span-1 row-span-1',
    tall: false,
  },
  {
    title: 'UCLan Campus',
    description: 'University of Central Lancashire — our academic partner.',
    image: '/landing/photos/graduation-1.jpg',
    span: 'col-span-1 row-span-1',
    tall: false,
  },
  {
    title: 'Match Day Experience',
    description: 'Competitive fixtures against UK clubs and youth academies.',
    image: '/landing/photos/match-day.jpg',
    span: 'col-span-1 row-span-1',
    tall: false,
  },
  {
    title: '4-Star Hotel',
    description: 'Quality accommodation throughout your stay.',
    image: '/landing/photos/summer-3.webp',
    span: 'col-span-1 row-span-1',
    tall: false,
  },
]

export function ResidencyFacilities() {
  return (
    <section className="py-20 md:py-28 bg-white dark:bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-500">
            Programme Facilities
          </span>
          <h2 className="font-oswald text-4xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[0.95] mt-3">
            World-Class Venues
          </h2>
          <p className="mt-4 text-gray-600 dark:text-muted-foreground max-w-2xl leading-relaxed">
            Combined unlimited access to our facilities at Macclesfield FC&apos;s stadium and the
            University of Central Lancashire.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-[140px] md:auto-rows-[180px]">
          {facilities.map((f) => (
            <div
              key={f.title}
              className={`relative rounded-xl overflow-hidden group ${f.span}`}
            >
              <Image
                src={f.image}
                alt={f.title}
                fill
                className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
                sizes={f.tall ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 50vw, 25vw'}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                <h3 className="font-oswald text-sm md:text-base font-bold uppercase tracking-tight text-white">
                  {f.title}
                </h3>
                <p className="text-[11px] md:text-xs text-white/60 mt-1 leading-snug">
                  {f.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
