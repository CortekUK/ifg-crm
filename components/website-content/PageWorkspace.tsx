'use client'

import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { getCmsPage } from '@/lib/website-content/pages'
import { PageContentEditor } from './PageContentEditor'
import { ProgrammePricingEditor, AllProgrammePricing } from './ProgrammePricing'
import { ProgrammeTermsManager } from './ProgrammeTerms'
import {
  CoursesManager, StaffManager, FaqsManager, ClinicsManager, StoriesManager, GalleryManager, NewsManager, SquadsManager,
} from './managers'

import { SITE_URL as SITE_ORIGIN } from '@/lib/config/site-url'

// Full-page editor for one website page. Composes the modules declared for the
// page in the registry: content (schema), pricing (programme), and collections.
export function PageWorkspace({ slug }: { slug: string }) {
  const page = getCmsPage(slug)
  if (!page) return null
  const has = (m: string) => page.modules.includes(m as never)
  const Icon = page.icon

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
      {/* Top bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/website-content"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Back to all pages"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-oswald text-2xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">{page.title}</h1>
              <p className="text-sm text-muted-foreground">{page.description}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/website-content" className="text-sm font-medium text-muted-foreground hover:text-foreground">All pages</Link>
          <a href={`${SITE_ORIGIN}${page.route}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-muted dark:text-blue-400">
            View live <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Modules */}
      <div className="space-y-8">
        {has('content') && <PageContentEditor slug={slug} />}
        {has('pricing-all') && <AllProgrammePricing />}
        {has('pricing') && page.programme && <ProgrammePricingEditor programme={page.programme} />}
        {has('terms') && <ProgrammeTermsManager />}
        {has('courses') && <CoursesManager />}
        {has('staff') && <StaffManager />}
        {has('faqs') && <FaqsManager />}
        {has('stories') && <StoriesManager />}
        {has('gallery') && <GalleryManager />}
        {has('news') && <NewsManager />}
        {has('squads') && <SquadsManager />}
        {has('clinics') && <ClinicsManager />}
      </div>
    </div>
  )
}
