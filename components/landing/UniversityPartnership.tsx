import Image from 'next/image'
import { GraduationCap, BookOpen, Award, Globe, Home, Trophy } from 'lucide-react'

const highlights = [
  {
    icon: BookOpen,
    title: '3 or 4-Year Degrees',
    description: 'UCLan have designed a range of undergraduate bachelor\'s degree courses with timetables tailored around your football schedule.',
  },
  {
    icon: Globe,
    title: '38,000+ Students',
    description: 'One of the UK\'s largest universities, with students from over 120 countries. Your degree is recognised worldwide.',
  },
  {
    icon: Home,
    title: 'En-Suite Accommodation',
    description: 'Private bedroom with en-suite bathroom in shared apartments. All bills included — electricity, heating and Wi-Fi.',
  },
  {
    icon: Trophy,
    title: '30+ Fixtures Per Season',
    description: 'Compete in BUCS leagues and national league matches with Macclesfield FC from September to May.',
  },
  {
    icon: Award,
    title: 'Scholarships Available',
    description: 'International students receive a £1,000 bursary. US students receive a £2,500 scholarship.',
  },
  {
    icon: GraduationCap,
    title: 'World-Class Facilities',
    description: 'The Sir Tom Finney Sports Arena — grass and 4G pitches, physio facilities, and a Data Analysis Centre used by professional academies.',
  },
]

export function UniversityPartnership() {
  return (
    <section className="py-20 md:py-28 bg-gray-50 dark:bg-white/[0.02]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: UCLan branding */}
          <div>
            <div className="rounded-2xl bg-[#1a1a2e] p-10 flex flex-col items-center justify-center gap-6">
              <Image
                src="/landing/logos/uclan-white.png"
                alt="University of Central Lancashire"
                width={280}
                height={80}
                className="object-contain"
              />
              <div className="text-center">
                <p className="text-blue-400 text-xs font-semibold uppercase tracking-[0.2em]">
                  Official Academic Partner
                </p>
                <p className="mt-2 text-white/50 text-sm leading-relaxed max-w-sm">
                  University of Central Lancashire — one of the UK&apos;s largest universities with over 38,000 students from 120+ countries.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-[2px] bg-blue-600" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-500">
                Academic Partnership
              </span>
            </div>
            <h2 className="font-oswald text-3xl md:text-4xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1] mb-4">
              Study at UCLan
            </h2>
            <p className="text-gray-600 dark:text-muted-foreground leading-relaxed mb-8">
              The University of Central Lancashire (UCLan) is our official academic partner. Based in Preston, UCLan provides a world-class learning environment where you can pursue your degree while continuing your football development with IFG and Macclesfield FC.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {highlights.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600/10 shrink-0 mt-0.5">
                      <Icon className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-foreground">{item.title}</p>
                      <p className="text-xs text-gray-500 dark:text-muted-foreground leading-relaxed mt-0.5">{item.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
