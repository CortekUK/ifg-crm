'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FadeIn } from './FadeIn'
import { Play } from 'lucide-react'
import { testimonials } from '@/lib/landing/programmes'

const video = {
  id: 'PKAo6yuzS8c',
  title: 'IFG Macclesfield vs Royton',
  category: 'Match Day',
}

const matchdayStats = [
  { value: '30+', label: 'Fixtures/Season' },
  { value: '2', label: 'Matches/Week' },
  { value: '8', label: 'First Team Call-Ups' },
]

const analysisPoints = [
  'Video analysis review with coaching staff',
  'PlayerData performance report for every player',
  'Position-specific feedback and development targets',
]

export function MatchdaySection() {
  const [playing, setPlaying] = useState(false)

  const featured = testimonials[0]
  const supporting = testimonials.slice(1)

  return (
    <section className="overflow-hidden">
      {/* ── Zone A: Matchday Energy ── */}
      <div className="relative py-20 md:py-28 pb-14 md:pb-20 bg-[#0A0A0A]">
        {/* Background image — restricted to Zone A only */}
        <div className="absolute inset-0">
          <Image
            src="/landing/photos/match-day.jpg"
            alt="IFG match day at The Leasing.com Stadium"
            fill
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#0A0A0A]/82" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <FadeIn className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-[2px] bg-red-600" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                Matchday
              </span>
            </div>
            <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-white leading-[1.1]">
              Matchday Is Part of
              <br />
              the Programme
            </h2>
            <p className="mt-4 text-base text-white/55 max-w-xl leading-relaxed">
              Every IFG player competes in structured, competitive fixtures — not
              friendlies. Two matches per week, full video analysis, and real
              progression into senior football.
            </p>

            {/* Stats — forced single row on all sizes */}
            <div className="mt-8 flex items-baseline gap-6 md:gap-8">
              {matchdayStats.map((stat, i) => (
                <div key={stat.label} className="flex items-baseline gap-1.5">
                  {i > 0 && (
                    <div className="w-px h-5 bg-white/15 -ml-3 md:-ml-4 mr-1 self-center" />
                  )}
                  <span className="font-oswald text-2xl md:text-3xl font-bold text-white tracking-tight leading-none">
                    {stat.value}
                  </span>
                  <span className="text-[10px] md:text-[11px] font-medium uppercase tracking-wider text-white/40">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </FadeIn>

          {/* Video — custom thumbnail with IFG play button */}
          <FadeIn threshold={0.1}>
            <div className="relative aspect-video rounded-xl overflow-hidden bg-[#111] border border-white/10 shadow-2xl shadow-black/50">
              {playing ? (
                <iframe
                  src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              ) : (
                <button
                  onClick={() => setPlaying(true)}
                  className="absolute inset-0 w-full h-full group cursor-pointer"
                >
                  <Image
                    src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
                    alt={video.title}
                    fill
                    sizes="100vw"
                    className="object-cover"
                  />
                  {/* Dark overlay to suppress Veo branding */}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
                  {/* Gradient to further de-emphasise centre branding */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
                  {/* IFG play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-red-600/30">
                      <Play className="h-7 w-7 md:h-8 md:w-8 text-white ml-1" fill="white" />
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6">
                    <p className="text-sm md:text-base font-semibold text-white">
                      {video.title}
                    </p>
                    <p className="text-xs text-white/50 mt-0.5">{video.category}</p>
                  </div>
                </button>
              )}
            </div>
            <div className="mt-3">
              <a
                href="https://www.youtube.com/@Footballinternational"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
              >
                More match footage on YouTube &rarr;
              </a>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* ── Zone B: Player Outcomes (solid dark, no bg image) ── */}
      <div className="py-14 md:py-20 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-[2px] bg-red-600" />
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/40">
                Player Outcomes
              </span>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            {/* Featured result — spans 2 cols */}
            <FadeIn delay={100} className="lg:col-span-2">
              <div className="h-full rounded-xl border border-white/[0.12] bg-white/[0.06] p-6 md:p-8 flex flex-col">
                {featured.outcome && (
                  <span className="inline-block w-fit text-[11px] font-bold uppercase tracking-widest text-red-400 bg-red-600/10 border border-red-600/25 rounded-full px-3.5 py-1.5 mb-5">
                    {featured.outcome}
                  </span>
                )}
                <p className="text-[15px] md:text-base text-white/80 leading-relaxed flex-1 mb-6">
                  {featured.quote}
                </p>
                <div className="pt-4 border-t border-white/[0.08] flex items-end justify-between gap-4">
                  <div>
                    <p className="font-oswald text-base font-bold uppercase tracking-wide text-white">
                      {featured.name}
                    </p>
                    <p className="text-xs text-white/40 mt-1">{featured.programme}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/25 shrink-0">
                    Verified
                  </span>
                </div>
              </div>
            </FadeIn>

            {/* Supporting results */}
            <div className="flex flex-col gap-6">
              {supporting.map((story, i) => (
                <FadeIn key={story.name} delay={150 + i * 80}>
                  <div className="rounded-xl border border-white/[0.12] bg-white/[0.06] p-6 h-full flex flex-col">
                    {story.outcome && (
                      <span className="inline-block w-fit text-[11px] font-bold uppercase tracking-widest text-red-400 bg-red-600/10 border border-red-600/20 rounded-full px-3 py-1 mb-4">
                        {story.outcome}
                      </span>
                    )}
                    <p className="text-[14px] text-white/75 leading-relaxed flex-1 mb-4">
                      {story.quote}
                    </p>
                    <div className="pt-3 border-t border-white/[0.08]">
                      <p className="text-sm font-semibold text-white">{story.name}</p>
                      <p className="text-xs text-white/40 mt-0.5">{story.programme}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>

          {/* Performance analysis callout */}
          <FadeIn delay={200}>
            <div className="rounded-xl border border-white/[0.10] bg-white/[0.05] px-6 py-5 md:px-8 md:py-6">
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40 shrink-0">
                  After Every Match
                </span>
                <div className="hidden md:block w-px h-5 bg-white/10" />
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                  {analysisPoints.map((point) => (
                    <div key={point} className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                      <span className="text-[13px] text-white/60">{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
