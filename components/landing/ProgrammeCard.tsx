import Image from 'next/image'
import Link from 'next/link'
import type { Programme } from '@/lib/landing/programmes'
import { ArrowRight } from 'lucide-react'

const categoryLabels: Record<Programme['category'], string> = {
  degree: 'Degree Programme',
  'short-term': 'Short-Term',
  experience: 'Experience',
}

/** Real IFG programme photography */
const programmeImages: Record<string, string> = {
  university: '/landing/photos/first-team-training.jpeg',
  'gap-year': '/landing/photos/training-1.webp',
  residency: '/landing/photos/training-experience.jpg',
}

/** Decision-guidance labels for the programme selector */
const bestForLabels: Record<string, string> = {
  university: 'Best for players who want football and a UK degree',
  'gap-year': 'Best for players taking a development year before university',
  residency: 'Best for short-term intensive training experiences',
}

interface ProgrammeCardProps {
  programme: Programme
  variant?: 'dark' | 'light'
}

export function ProgrammeCard({ programme, variant = 'dark' }: ProgrammeCardProps) {
  const image = programmeImages[programme.slug]
  const bestFor = bestForLabels[programme.slug]
  const isLight = variant === 'light'

  return (
    <Link href={`/landing/programmes/${programme.slug}`} className="group block h-full">
      <div
        className={`h-full flex flex-col rounded-xl overflow-hidden border transition-all duration-300 ${
          isLight
            ? 'border-gray-200 bg-white hover:shadow-xl hover:border-gray-300'
            : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:shadow-xl hover:border-gray-300 dark:hover:border-white/20'
        }`}
      >
        {/* Image with programme name overlaid */}
        <div className="relative aspect-[16/10] overflow-hidden bg-[#111]">
          {image && (
            <Image
              src={image}
              alt={programme.name}
              fill
              className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute top-4 left-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
              {categoryLabels[programme.category]}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h3 className="font-oswald text-xl md:text-2xl font-bold uppercase tracking-tight text-white leading-snug">
              {programme.name}
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 md:p-6 flex flex-col flex-1">
          {/* Best-for guidance */}
          {bestFor && (
            <div
              className={`flex items-start gap-2.5 mb-4 pb-4 border-b ${
                isLight ? 'border-gray-100' : 'border-gray-100 dark:border-white/[0.06]'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0 mt-1.5" />
              <p
                className={`text-[13px] font-medium leading-snug ${
                  isLight ? 'text-gray-700' : 'text-gray-700 dark:text-white/60'
                }`}
              >
                {bestFor}
              </p>
            </div>
          )}

          <p
            className={`text-[13px] leading-relaxed mb-5 ${
              isLight ? 'text-gray-500' : 'text-gray-500 dark:text-muted-foreground'
            }`}
          >
            {programme.tagline}
          </p>

          {/* Structured metadata grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-6">
            {programme.quickFacts.slice(0, 4).map((fact) => (
              <div key={fact.label}>
                <div
                  className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${
                    isLight ? 'text-gray-400' : 'text-gray-400 dark:text-white/30'
                  }`}
                >
                  {fact.label}
                </div>
                <div
                  className={`text-[13px] font-medium ${
                    isLight ? 'text-gray-800' : 'text-gray-800 dark:text-foreground/80'
                  }`}
                >
                  {fact.value}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-auto">
            <div
              className={`inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide rounded-lg px-4 py-2.5 transition-all ${
                isLight
                  ? 'text-red-600 border border-red-600/20 group-hover:border-red-600/40 group-hover:bg-red-600/5'
                  : 'text-red-600 dark:text-red-500 border border-red-600/20 dark:border-red-600/15 group-hover:border-red-600/40 group-hover:bg-red-600/5 dark:group-hover:bg-red-600/10'
              }`}
            >
              View Programme
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
