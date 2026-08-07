'use client'

import Link from 'next/link'
import { ExternalLink, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWebsitePages } from '@/lib/hooks/useWebsitePages'
import { CMS_PAGES, type CmsModule } from '@/lib/website-content/pages'

const SITE_URL = 'https://theinternationalfootballgroup.com'

const MODULE_LABEL: Record<CmsModule, string> = {
  content: 'Content', pricing: 'Pricing', 'pricing-all': 'Pricing', courses: 'Courses', staff: 'Staff',
  faqs: 'FAQs', stories: 'Stories', gallery: 'Gallery', clinics: 'Clinics', news: 'News', squads: 'Squads',
}

export default function WebsiteContentPage() {
  const pages = useWebsitePages()

  // Customisation status for a content page (from website_pages overrides).
  const statusFor = (slug: string): { label: string; cls: string } | null => {
    const row = pages.data?.find((r) => r.slug === slug)
    if (!row || !row.overrides || Object.keys(row.overrides).length === 0) return null
    return row.published
      ? { label: 'Customised', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' }
      : { label: 'Draft', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' }
  }

  return (
    <div className="space-y-6">
      {/* Premium header */}
      <div className="banner-gradient flex flex-col gap-4 rounded-xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-oswald text-2xl font-bold uppercase tracking-tight text-white">Website Content</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/80">
            Choose a page to edit its text, media, pricing and lists. Changes appear on the live site within about a minute.
          </p>
        </div>
        <a href={SITE_URL} target="_blank" rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-white/95 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-white">
          View website <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* Page blocks */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CMS_PAGES.map((page) => {
          const Icon = page.icon
          const status = page.modules.includes('content') ? statusFor(page.slug) : null
          return (
            <Link
              key={page.slug}
              href={`/cms/${page.slug}`}
              className="group flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2">
                  {status && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', status.cls)}>{status.label}</span>}
                  <ChevronRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-slate-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="font-oswald text-lg font-semibold text-slate-900 dark:text-white">{page.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{page.description}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {page.modules.map((m) => (
                  <span key={m} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {MODULE_LABEL[m]}
                  </span>
                ))}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
