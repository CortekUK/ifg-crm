import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SmoothScrollLink } from './SmoothScrollLink'
import { cn } from '@/lib/utils'
import type { Programme } from '@/lib/landing/programmes'
import { ArrowRight, FileText, Phone } from 'lucide-react'

export type HeroVariant = 'split' | 'fullbleed' | 'centered'

// Update this when you have a real Calendly/Cal.com link
const CALENDAR_URL = 'https://calendly.com/ifg-macclesfield/consultation'

const categoryLabels: Record<Programme['category'], string> = {
  degree: 'Degree Programme',
  'short-term': 'Short-Term Programme',
  experience: 'Experience',
}

const categoryColors: Record<Programme['category'], string> = {
  degree: 'bg-blue-600 text-white border-transparent',
  'short-term': 'bg-amber-600 text-white border-transparent',
  experience: 'bg-emerald-600 text-white border-transparent',
}

const ctaColors: Record<Programme['category'], string> = {
  degree: 'bg-blue-600 hover:bg-blue-700',
  'short-term': 'bg-amber-600 hover:bg-amber-700',
  experience: 'bg-emerald-600 hover:bg-emerald-700',
}

const heroImages: Record<string, string> = {
  university: '/landing/photos/first-team-training.jpeg',
  'gap-year': '/landing/photos/training-1.webp',
  residency: '/landing/photos/training-experience.jpg',
}

interface ProgrammeHeroProps {
  programme: Programme
  variant?: HeroVariant
}

export function ProgrammeHero({ programme, variant = 'fullbleed' }: ProgrammeHeroProps) {
  const image = heroImages[programme.slug]

  if (variant === 'split') {
    return <SplitHero programme={programme} image={image} />
  }

  if (variant === 'centered') {
    return <CenteredHero programme={programme} image={image} />
  }

  return <FullbleedHero programme={programme} image={image} />
}

/* --- Shared CTA buttons --- */
function HeroCTAs({ programme, variant }: { programme: Programme; variant: 'light' | 'dark' }) {
  const isLight = variant === 'light'

  return (
    <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <SmoothScrollLink href="#enquire">
        <Button
          size="lg"
          className={cn(
            'text-white text-base px-8 h-13 font-semibold tracking-wide',
            ctaColors[programme.category]
          )}
        >
          Apply Now
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </SmoothScrollLink>
      <SmoothScrollLink href="#enquire">
        <Button
          size="lg"
          variant="outline"
          className={cn(
            'text-base px-6 h-13 font-medium',
            isLight
              ? 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-white/20 dark:text-foreground dark:hover:bg-white/5'
              : 'border-white/25 text-white hover:bg-white/10 hover:text-white bg-white/5'
          )}
        >
          <FileText className="h-4 w-4 mr-1.5" />
          View Brochure
        </Button>
      </SmoothScrollLink>
      <Link href={CALENDAR_URL} target="_blank" rel="noopener noreferrer">
        <Button
          size="lg"
          variant="outline"
          className={cn(
            'text-base px-6 h-13 font-medium',
            isLight
              ? 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-white/20 dark:text-foreground dark:hover:bg-white/5'
              : 'border-white/25 text-white hover:bg-white/10 hover:text-white bg-white/5'
          )}
        >
          <Phone className="h-4 w-4 mr-1.5" />
          Book a Call
        </Button>
      </Link>
    </div>
  )
}

/* --- Split variant (University) --- */
function SplitHero({ programme, image }: { programme: Programme; image?: string }) {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-white dark:bg-background">
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text content */}
          <div>
            <Badge className={cn('mb-6', categoryColors[programme.category])}>
              {categoryLabels[programme.category]}
            </Badge>

            <h1 className="font-oswald text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[0.95]">
              {programme.name}
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-muted-foreground max-w-xl leading-relaxed">
              {programme.longDescription}
            </p>

            <HeroCTAs programme={programme} variant="light" />
          </div>

          {/* Hero image */}
          {image && (
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-200 dark:bg-white/5">
              <Image
                src={image}
                alt={programme.name}
                fill
                priority
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/* --- Fullbleed variant (Gap Year) --- */
function FullbleedHero({ programme, image }: { programme: Programme; image?: string }) {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-[#0A0A0A]">
      {image && (
        <div className="absolute inset-0">
          <Image
            src={image}
            alt={programme.name}
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/70 to-[#0A0A0A]/40" />
          <div className="absolute inset-0 bg-[#0A0A0A]/30" />
        </div>
      )}

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Badge className={cn('mb-6', categoryColors[programme.category])}>
          {categoryLabels[programme.category]}
        </Badge>

        <h1 className="font-oswald text-4xl sm:text-5xl md:text-7xl font-bold uppercase tracking-tight text-white leading-[0.95]">
          {programme.tagline}
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-white/60 max-w-2xl leading-relaxed">
          {programme.longDescription}
        </p>

        <HeroCTAs programme={programme} variant="dark" />
      </div>
    </section>
  )
}

/* --- Centered variant (Residency) --- */
function CenteredHero({ programme, image }: { programme: Programme; image?: string }) {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-[#0A0A0A]">
      {image && (
        <div className="absolute inset-0">
          <Image
            src={image}
            alt={programme.name}
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/70 to-[#0A0A0A]/40" />
          <div className="absolute inset-0 bg-[#0A0A0A]/30" />
        </div>
      )}

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Badge className={cn('mb-6', categoryColors[programme.category])}>
          {categoryLabels[programme.category]}
        </Badge>

        <h1 className="font-oswald text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-tight text-white leading-[0.95]">
          {programme.name}
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
          {programme.longDescription}
        </p>

        {/* Duration badges */}
        <div className="mt-8 flex items-center justify-center gap-3">
          {['2 Weeks', '4 Weeks', '6 Weeks'].map((duration) => (
            <span
              key={duration}
              className="inline-flex items-center px-4 py-2 rounded-full bg-amber-600/20 border border-amber-600/30 text-amber-400 text-sm font-semibold tracking-wide"
            >
              {duration}
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <SmoothScrollLink href="#enquire">
            <Button
              size="lg"
              className={cn(
                'text-white text-base px-8 h-13 font-semibold tracking-wide',
                ctaColors[programme.category]
              )}
            >
              Apply Now
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </SmoothScrollLink>
          <SmoothScrollLink href="#enquire">
            <Button
              size="lg"
              variant="outline"
              className="border-white/25 text-white hover:bg-white/10 hover:text-white bg-white/5 text-base px-6 h-13 font-medium"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              View Brochure
            </Button>
          </SmoothScrollLink>
          <Link href={CALENDAR_URL} target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              variant="outline"
              className="border-white/25 text-white hover:bg-white/10 hover:text-white bg-white/5 text-base px-6 h-13 font-medium"
            >
              <Phone className="h-4 w-4 mr-1.5" />
              Book a Call
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
