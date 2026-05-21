import Image from 'next/image'

const days = [
  {
    day: 1,
    name: 'Monday',
    color: 'dark' as const,
    title: 'Training & Conditioning',
    location: 'The Leasing.com Stadium',
    activities: [
      'Morning: Technical skills & positional drills',
      'Afternoon: Strength & conditioning session',
    ],
    image: '/landing/photos/training-3.webp',
  },
  {
    day: 2,
    name: 'Tuesday',
    color: 'amber' as const,
    title: 'University of Lancashire',
    location: 'UCLan Campus & Stadium',
    activities: [
      'Morning: Campus tour & introduction',
      'Afternoon: Training at Sir Tom Finney Arena',
    ],
    image: '/landing/photos/graduation-1.jpg',
  },
  {
    day: 3,
    name: 'Wednesday',
    color: 'amber' as const,
    title: 'Match Day',
    location: 'Macclesfield FC',
    activities: [
      'Morning: Pre-match preparation & tactics',
      'Afternoon: Competitive fixture vs UK academy',
    ],
    image: '/landing/photos/match-day.jpg',
  },
  {
    day: 4,
    name: 'Thursday',
    color: 'dark' as const,
    title: 'Recovery & Development',
    location: 'The Leasing.com Stadium',
    activities: [
      'Morning: Video analysis & feedback session',
      'Afternoon: Recovery, physio & gym access',
    ],
    image: '/landing/photos/gym.webp',
  },
  {
    day: 5,
    name: 'Friday',
    color: 'dark' as const,
    title: 'Training & Activities',
    location: 'Various Locations',
    activities: [
      'Morning: Tactical training & small-sided games',
      'Afternoon: Cultural activities & excursions',
    ],
    image: '/landing/photos/summer-1.webp',
  },
]

export function ResidencySchedule() {
  return (
    <section className="py-20 md:py-28 bg-[#0A0A0A]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500">
            Programme Schedule
          </span>
          <h2 className="font-oswald text-4xl md:text-5xl font-bold uppercase tracking-tight text-white leading-[0.95] mt-3">
            A Typical Week
          </h2>
          <p className="mt-4 text-white/40 max-w-2xl leading-relaxed text-sm">
            This sample schedule shows the typical programme structure, but the exact
            daily schedule and events may vary.
          </p>
        </div>

        {/* Day cards — horizontal scroll on mobile, grid on desktop */}
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
          {days.map((d) => {
            const isAmber = d.color === 'amber'
            return (
              <div
                key={d.day}
                className={`flex-shrink-0 w-[260px] md:w-auto rounded-xl overflow-hidden ${
                  isAmber ? 'bg-amber-600' : 'bg-white/[0.05]'
                }`}
              >
                {/* Image */}
                <div className="relative h-32 md:h-28">
                  <Image
                    src={d.image}
                    alt={d.title}
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 768px) 260px, 20vw"
                  />
                  {isAmber && (
                    <div className="absolute inset-0 bg-amber-600/30 mix-blend-multiply" />
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span
                      className={`font-oswald text-2xl font-bold tracking-tight leading-none ${
                        isAmber ? 'text-white' : 'text-amber-500'
                      }`}
                    >
                      DAY {d.day}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-widest font-medium ${
                        isAmber ? 'text-white/70' : 'text-white/30'
                      }`}
                    >
                      {d.name}
                    </span>
                  </div>
                  <h3
                    className={`font-oswald text-sm font-bold uppercase tracking-tight leading-tight ${
                      isAmber ? 'text-white' : 'text-white/90'
                    }`}
                  >
                    {d.title}
                  </h3>
                  <p
                    className={`text-[11px] mt-1 ${
                      isAmber ? 'text-white/70' : 'text-white/30'
                    }`}
                  >
                    {d.location}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {d.activities.map((a, i) => (
                      <p
                        key={i}
                        className={`text-[11px] leading-snug ${
                          isAmber ? 'text-white/80' : 'text-white/40'
                        }`}
                      >
                        {a}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
