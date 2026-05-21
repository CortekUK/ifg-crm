import { Dribbble, Dumbbell, Plane } from 'lucide-react'

const groups = [
  {
    icon: Dribbble,
    title: 'On the Pitch',
    items: [
      '5 hours of UEFA-qualified coaching per day',
      'Bespoke programme tailored to your position and style',
      'Competitive matches against UK clubs and youth academies',
      'Video analysis and personalised feedback sessions',
      'State-of-the-art 4G pitch at The Leasing.com Stadium',
    ],
  },
  {
    icon: Dumbbell,
    title: 'Recovery & Development',
    items: [
      'Vigorous strength and conditioning programme',
      'Unlimited access to the on-site gymnasium',
      'Physiotherapy with weekly recovery sessions',
      'Comprehensive nutritional guidance from specialists',
      'Week 6: Training with Juventus FC academy coaches',
    ],
  },
  {
    icon: Plane,
    title: 'Lifestyle & Experiences',
    items: [
      '4-star hotel accommodation throughout',
      'Three meals per day at the Academy Restaurant',
      'Full Adidas playing and training kit on arrival',
      'Premier League stadium tours and guest speakers',
      'Activities: go-karting, paintballing, and more',
      'All transport organised by Macclesfield FC',
    ],
  },
]

export function ResidencyIncludes() {
  return (
    <section className="py-20 md:py-28 bg-[#0A0A0A]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-14">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500">
            What&apos;s Included
          </span>
          <h2 className="font-oswald text-4xl md:text-5xl font-bold uppercase tracking-tight text-white leading-[0.95] mt-3">
            Everything You Need.
            <span className="block text-white/30">Nothing You Don&apos;t.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-px bg-white/5 rounded-xl overflow-hidden">
          {groups.map((group) => {
            const Icon = group.icon
            return (
              <div key={group.title} className="bg-[#0A0A0A] p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-600/10">
                    <Icon className="h-5 w-5 text-amber-500" />
                  </div>
                  <h3 className="font-oswald text-lg font-bold uppercase tracking-tight text-white">
                    {group.title}
                  </h3>
                </div>
                <div className="space-y-3">
                  {group.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-1 h-1 rounded-full bg-amber-500 shrink-0 mt-2" />
                      <p className="text-sm text-white/50 leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
