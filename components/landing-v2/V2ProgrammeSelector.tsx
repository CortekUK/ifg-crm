'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { FadeIn } from '@/components/landing/FadeIn'
import { SmoothScrollLink } from '@/components/landing/SmoothScrollLink'
import { Button } from '@/components/ui/button'
import { programmes } from '@/lib/landing/programmes'
import { ArrowRight, Clock, MapPin, Trophy, GraduationCap, Zap, Users, Calendar } from 'lucide-react'

const tabs = [
  { key: 'university', label: 'University' },
  { key: 'gap-year', label: 'Gap Year' },
  { key: 'residency', label: 'Residency' },
] as const

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'clock': Clock,
  'map-pin': MapPin,
  'trophy': Trophy,
  'graduation-cap': GraduationCap,
  'zap': Zap,
  'users': Users,
  'calendar': Calendar,
}

const programmeImages: Record<string, string> = {
  university: '/landing/photos/graduation-2.jpg',
  'gap-year': '/landing/photos/first-team-training.jpeg',
  residency: '/landing/photos/summer-1.webp',
}

export function V2ProgrammeSelector() {
  const [activeSlug, setActiveSlug] = useState<string>('university')

  const programme = programmes.find((p) => p.slug === activeSlug) ?? programmes[0]

  return (
    <section id="programmes" className="py-20 md:py-28 bg-[#FAFAFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              Programmes
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 leading-[1.1]">
            Choose Your Programme
          </h2>
        </FadeIn>

        {/* Tabs */}
        <FadeIn delay={100}>
          <div className="flex gap-1 mb-10 overflow-x-auto pb-1 -mx-1 px-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSlug(tab.key)}
                className={`font-oswald text-sm font-semibold uppercase tracking-wider px-5 py-2.5 rounded-md transition-colors whitespace-nowrap ${
                  activeSlug === tab.key
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200/70 text-gray-600 hover:bg-gray-300/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </FadeIn>

        {/* Programme content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Left — large programme image */}
          <div className="lg:col-span-7">
            <div className="relative rounded-xl overflow-hidden aspect-[4/3] lg:aspect-[16/11] bg-gray-100">
              <Image
                src={programmeImages[activeSlug] || programmeImages.university}
                alt={programme.name}
                fill
                className="object-cover object-center transition-opacity duration-300"
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1.5">
                  {programme.category === 'degree'
                    ? 'Degree Programme'
                    : programme.category === 'short-term'
                    ? 'Short-Term'
                    : 'Experience'}
                </span>
                <h3 className="font-oswald text-xl md:text-2xl font-bold uppercase tracking-tight text-white">
                  {programme.name}
                </h3>
              </div>
            </div>
          </div>

          {/* Right — details panel */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="rounded-xl border border-gray-200 bg-white p-6 md:p-7 flex-1 flex flex-col">
              <p className="text-sm text-gray-600 leading-relaxed mb-6">
                {programme.tagline}
              </p>

              {/* Quick facts grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {programme.quickFacts.map((fact) => {
                  const Icon = iconMap[fact.icon] || Clock
                  return (
                    <div key={fact.label} className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                          {fact.label}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {fact.value}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Description */}
              <p className="text-sm text-gray-500 leading-relaxed mb-6 flex-1">
                {programme.description}
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3">
                <SmoothScrollLink href="#enquire" className="flex-1">
                  <Button
                    size="lg"
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold tracking-wide"
                  >
                    Apply Now
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </SmoothScrollLink>
                <Link href={`/landing/programmes/${programme.slug}`} className="flex-1">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Full Details
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* "Not sure?" guidance strip */}
        <FadeIn delay={200}>
          <div className="mt-8 rounded-xl border border-gray-200 bg-white px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Not sure which programme?</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Submit an enquiry and our team will recommend the best fit based on your age, goals, and experience.
              </p>
            </div>
            <SmoothScrollLink href="#enquire" className="shrink-0">
              <Button
                variant="outline"
                className="border-red-600/30 text-red-600 hover:bg-red-50 font-medium whitespace-nowrap"
              >
                Speak to the Team
              </Button>
            </SmoothScrollLink>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
