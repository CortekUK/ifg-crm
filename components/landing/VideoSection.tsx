'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FadeIn } from './FadeIn'
import { Play } from 'lucide-react'
import { cn } from '@/lib/utils'

// Real IFG YouTube videos
const videos = [
  {
    id: 'PKAo6yuzS8c',
    title: 'IFG Macclesfield vs Royton',
    category: 'Match Day',
  },
  {
    id: 'nvOjh-DVW7g',
    title: 'IFG Macclesfield vs Stalybridge',
    category: 'Match Day',
  },
  {
    id: 'b7T9K_l1NT0',
    title: 'IFG Macclesfield vs Eclipse FC',
    category: 'Match Day',
  },
  {
    id: 'kO8QzW86j2E',
    title: 'IFG Macclesfield vs South Shields FC',
    category: 'Match Day',
  },
]

export function VideoSection() {
  const [activeVideo, setActiveVideo] = useState(videos[0])
  const [playing, setPlaying] = useState(false)

  return (
    <section className="py-20 md:py-28 bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-[2px] bg-red-600" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                IFG TV
              </span>
            </div>
            <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-white leading-[1.1]">
              Watch Our Players in Action
            </h2>
            <p className="mt-4 text-base text-white/50 max-w-xl leading-relaxed">
              Real match footage from IFG Macclesfield FC — competitive fixtures, training highlights, and programme content.
            </p>
          </div>
          <a
            href="https://www.youtube.com/@Footballinternational"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-white/50 hover:text-white transition-colors shrink-0"
          >
            View all on YouTube &rarr;
          </a>
        </FadeIn>

        <FadeIn>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main video player */}
            <div className="lg:col-span-2">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
                {playing ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${activeVideo.id}?autoplay=1&rel=0`}
                    title={activeVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                ) : (
                  <button
                    onClick={() => setPlaying(true)}
                    className="absolute inset-0 w-full h-full group cursor-pointer"
                  >
                    {/* YouTube thumbnail */}
                    <Image
                      src={`https://img.youtube.com/vi/${activeVideo.id}/maxresdefault.jpg`}
                      alt={activeVideo.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 66vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play className="h-7 w-7 text-white ml-1" fill="white" />
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <p className="text-sm font-semibold text-white">{activeVideo.title}</p>
                      <p className="text-xs text-white/50 mt-0.5">{activeVideo.category}</p>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Video list */}
            <div className="flex flex-col gap-3">
              {videos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => {
                    setActiveVideo(video)
                    setPlaying(false)
                  }}
                  className={cn(
                    'flex items-center gap-4 rounded-lg p-3 text-left transition-colors',
                    activeVideo.id === video.id
                      ? 'bg-white/10 border border-white/10'
                      : 'bg-white/[0.03] border border-transparent hover:bg-white/[0.06]'
                  )}
                >
                  {/* Thumbnail */}
                  <div className="relative w-28 shrink-0 aspect-video rounded-md overflow-hidden bg-white/5">
                    <Image
                      src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                      alt={video.title}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                    {activeVideo.id === video.id && (
                      <div className="absolute inset-0 bg-red-600/20 flex items-center justify-center">
                        <Play className="h-4 w-4 text-white" fill="white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium truncate',
                      activeVideo.id === video.id ? 'text-white' : 'text-white/70'
                    )}>
                      {video.title}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">{video.category}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
