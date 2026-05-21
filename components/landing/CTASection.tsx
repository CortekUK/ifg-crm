'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SmoothScrollLink } from './SmoothScrollLink'
import { FadeIn } from './FadeIn'
import { ArrowRight } from 'lucide-react'

const buttonColors: Record<string, string> = {
  red: 'bg-red-600 hover:bg-red-700',
  amber: 'bg-amber-600 hover:bg-amber-700',
  blue: 'bg-blue-600 hover:bg-blue-700',
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
}

interface CTASectionProps {
  title?: string
  description?: string
  reassurance?: string
  primaryText?: string
  primaryHref?: string
  secondaryText?: string
  secondaryHref?: string
  accentColor?: string
}

export function CTASection({
  title = 'Ready to Start Your Journey?',
  description = 'Join hundreds of international players who have transformed their careers with IFG. Your future in football starts with a single step.',
  reassurance = 'Not sure which programme fits you? Speak with the IFG team and we\u2019ll help guide you toward the right pathway.',
  primaryText = 'Start Your Application',
  primaryHref = '#enquire',
  secondaryText = 'View Programmes',
  secondaryHref = '/landing/programmes',
  accentColor = 'red',
}: CTASectionProps) {
  const btnColor = buttonColors[accentColor] || buttonColors.red
  const PrimaryWrapper = primaryHref.startsWith('#') ? SmoothScrollLink : Link
  return (
    <section className="relative py-20 md:py-28 overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src="/landing/photos/stadium.jpeg"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#0A0A0A]/85" />
      </div>

      <FadeIn className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-white leading-[1.1]">
          {title}
        </h2>
        <p className="mt-5 text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
          {description}
        </p>
        {reassurance && (
          <p className="mt-4 text-sm text-white/40 max-w-lg mx-auto leading-relaxed italic">
            {reassurance}
          </p>
        )}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <PrimaryWrapper href={primaryHref}>
            <Button
              size="lg"
              className={`${btnColor} text-white text-base px-8 h-13 font-semibold tracking-wide`}
            >
              {primaryText}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </PrimaryWrapper>
          <Link href={secondaryHref}>
            <Button
              size="lg"
              variant="outline"
              className="border-white/25 text-white hover:bg-white/10 hover:text-white text-base px-8 h-13 bg-white/5 font-medium"
            >
              {secondaryText}
            </Button>
          </Link>
        </div>
      </FadeIn>
    </section>
  )
}
