import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Programme } from '@/lib/landing/programmes'
import { ArrowRight, Clock, MapPin, Users } from 'lucide-react'

const categoryLabels: Record<Programme['category'], string> = {
  degree: 'Degree Programme',
  'short-term': 'Short-Term',
  experience: 'Experience',
}

const categoryColors: Record<Programme['category'], string> = {
  degree: 'bg-blue-600 text-white border-transparent',
  'short-term': 'bg-amber-600 text-white border-transparent',
  experience: 'bg-emerald-600 text-white border-transparent',
}

/** Real IFG programme photography */
const programmeImages: Record<string, string> = {
  university: '/landing/photos/first-team-training.jpeg',
  'gap-year': '/landing/photos/training-1.webp',
  residency: '/landing/photos/training-experience.jpg',
}

interface ProgrammeCardProps {
  programme: Programme
}

export function ProgrammeCard({ programme }: ProgrammeCardProps) {
  const duration = programme.quickFacts.find((f) => f.label === 'Duration')?.value
  const location = programme.quickFacts.find((f) => f.label === 'Location')?.value
  const ageRange = programme.whoFor.ageRange
  const image = programmeImages[programme.slug]

  return (
    <Link href={`/landing/programmes/${programme.slug}`} className="group block h-full">
      <div className="h-full flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:shadow-lg hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300">
        {/* Image — fixed aspect ratio for consistency */}
        <div className="relative aspect-[3/2] overflow-hidden bg-gray-200 dark:bg-white/5">
          {image && (
            <Image
              src={image}
              alt={programme.name}
              fill
              className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute top-3 left-3">
            <Badge className={cn('text-[11px]', categoryColors[programme.category])}>
              {categoryLabels[programme.category]}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
          <h3 className="font-oswald text-[17px] font-bold uppercase tracking-tight text-gray-900 dark:text-foreground group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors leading-snug mb-1.5">
            {programme.name}
          </h3>

          <p className="text-[13px] text-gray-500 dark:text-muted-foreground leading-relaxed mb-4 line-clamp-2">
            {programme.tagline}
          </p>

          {/* Quick facts row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-gray-500 dark:text-white/40 mb-5">
            {duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-gray-400 dark:text-white/30" />
                {duration}
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-gray-400 dark:text-white/30" />
                {location}
              </span>
            )}
            {ageRange && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3 text-gray-400 dark:text-white/30" />
                Ages {ageRange}
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="mt-auto pt-4 border-t border-gray-200 dark:border-white/5">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-500 group-hover:gap-3 transition-all">
              View Programme
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
