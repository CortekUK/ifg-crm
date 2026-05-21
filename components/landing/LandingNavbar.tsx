'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { programmes } from '@/lib/landing/programmes'
import { MobileMenu } from './MobileMenu'
import { SmoothScrollLink } from './SmoothScrollLink'
import { Sun, Moon, ChevronDown, Menu } from 'lucide-react'

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [programmeOpen, setProgrammeOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 shadow-sm'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/landing" className="flex items-center gap-3 shrink-0">
            <Image
              src="/landing/logos/ifg-crest.png"
              alt="IFG"
              width={36}
              height={36}
              className={cn(
                'h-9 w-9 transition-all',
                scrolled ? 'dark:invert-0 invert' : ''
              )}
            />
            <div className="flex flex-col leading-tight">
              <span className={cn(
                'text-[9px] font-medium tracking-widest uppercase transition-colors',
                scrolled ? 'text-gray-400 dark:text-white/40' : 'text-white/50'
              )}>
                The International
              </span>
              <span className={cn(
                'text-lg font-extrabold tracking-tight transition-colors font-oswald uppercase',
                scrolled ? 'text-gray-900 dark:text-white' : 'text-white'
              )}>
                Football Group
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/landing"
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                scrolled
                  ? 'text-gray-700 dark:text-white/80 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              )}
            >
              Home
            </Link>

            {/* Programmes Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setProgrammeOpen(true)}
              onMouseLeave={() => setProgrammeOpen(false)}
            >
              <button
                className={cn(
                  'flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  scrolled
                    ? 'text-gray-700 dark:text-white/80 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                )}
              >
                Programmes
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', programmeOpen && 'rotate-180')} />
              </button>

              {programmeOpen && (
                <div className="absolute top-full left-0 pt-2 w-72">
                <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111111] shadow-xl p-2">
                  {programmes.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/landing/programmes/${p.slug}`}
                      className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                      onClick={() => setProgrammeOpen(false)}
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                      <span className="text-xs text-gray-500 dark:text-white/40 line-clamp-1">{p.tagline}</span>
                    </Link>
                  ))}
                  <div className="border-t border-gray-100 dark:border-white/5 mt-1 pt-1">
                    <Link
                      href="/landing/programmes"
                      className="block px-3 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                      onClick={() => setProgrammeOpen(false)}
                    >
                      View All Programmes
                    </Link>
                  </div>
                </div>
                </div>
              )}
            </div>

            <SmoothScrollLink
              href="#testimonials"
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                scrolled
                  ? 'text-gray-700 dark:text-white/80 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              )}
            >
              Testimonials
            </SmoothScrollLink>

            <SmoothScrollLink
              href="#faq"
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                scrolled
                  ? 'text-gray-700 dark:text-white/80 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              )}
            >
              FAQ
            </SmoothScrollLink>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(
                'p-2 rounded-lg transition-colors',
                scrolled
                  ? 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-white/60'
                  : 'hover:bg-white/10 text-white/70'
              )}
            >
              <Sun className="h-4 w-4 hidden dark:block" />
              <Moon className="h-4 w-4 block dark:hidden" />
            </button>

            <SmoothScrollLink href="#enquire" className="hidden md:block">
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold tracking-wide"
              >
                Apply Now
              </Button>
            </SmoothScrollLink>

            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className={cn(
                'md:hidden p-2 rounded-lg transition-colors',
                scrolled
                  ? 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-white/60'
                  : 'hover:bg-white/10 text-white/70'
              )}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </nav>
  )
}
