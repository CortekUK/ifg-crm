import Image from 'next/image'
import type { Programme } from '@/lib/landing/programmes'
import { getAccentColors } from '@/lib/landing/programme-colors'
import { CheckCircle } from 'lucide-react'

const whoForImages: Record<string, string> = {
  university: '/landing/photos/graduation-1.jpg',
  'gap-year': '/landing/photos/training-1.webp',
  residency: '/landing/photos/summer-2.webp',
}

interface ProgrammeWhoForProps {
  whoFor: Programme['whoFor']
  category: Programme['category']
  slug: string
}

export function ProgrammeWhoFor({ whoFor, category, slug }: ProgrammeWhoForProps) {
  const accent = getAccentColors(category)
  const image = whoForImages[slug] || '/landing/photos/training-3.webp'

  return (
    <section className="py-20 md:py-28 bg-white dark:bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Image */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-200 dark:bg-white/5">
            <Image
              src={image}
              alt="IFG training session"
              fill
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-[2px] ${accent.line}`} />
              <span className={`text-xs font-semibold uppercase tracking-[0.2em] ${accent.text}`}>
                Ideal Candidate
              </span>
            </div>
            <h2 className="font-oswald text-3xl md:text-4xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1] mb-4">
              Who Is This For?
            </h2>
            <p className="text-gray-600 dark:text-muted-foreground leading-relaxed mb-8">
              {whoFor.description}
            </p>
            <div className="space-y-3">
              {whoFor.idealFor.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className={`h-5 w-5 ${accent.icon} shrink-0 mt-0.5`} />
                  <p className="text-sm text-gray-700 dark:text-foreground/80 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
