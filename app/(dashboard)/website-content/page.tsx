'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus, Pencil, Trash2, Loader2, Images, Trophy, LayoutList, HelpCircle,
  GraduationCap, ExternalLink, ImageOff, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useSuccessStories, useGalleryCategories, useSiteContent, useDeleteContent,
} from '@/lib/hooks/useWebsiteContent'
import { StoryModal } from '@/components/website-content/StoryModal'
import { GalleryModal } from '@/components/website-content/GalleryModal'
import { SiteContentModal } from '@/components/website-content/SiteContentModal'
import { FaqModal } from '@/components/website-content/FaqModal'
import { CourseModal } from '@/components/website-content/CourseModal'
import { toast } from '@/lib/hooks/use-toast'
import type { SuccessStory, GalleryCategory, SiteContentItem } from '@/lib/types/website-content'

const SITE_URL = 'https://theinternationalfootballgroup.com'

type ContentTable = 'website_success_stories' | 'website_gallery_categories' | 'website_site_content'

const TINT: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

function StatusPill({ published }: { published: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        published
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', published ? 'bg-emerald-500' : 'bg-amber-500')} />
      {published ? 'Live' : 'Draft'}
    </span>
  )
}

function CardActions({ onEdit, onDelete, deleting }: { onEdit: () => void; onDelete: () => void; deleting: boolean }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-white/95 p-0.5 shadow-sm backdrop-blur dark:bg-slate-900/95">
      <button
        onClick={onEdit}
        className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Edit"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={onDelete}
        disabled={deleting}
        className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40"
        aria-label="Delete"
      >
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  )
}

// Image-led card (stories, gallery, courses, site content).
function ContentCard({
  thumb, title, subtitle, badge, published, fallbackIcon: Icon, onEdit, onDelete, deleting,
}: {
  thumb: string | null
  title: string
  subtitle: string
  badge?: string | null
  published: boolean
  fallbackIcon: LucideIcon
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-800">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
            <Icon className="h-9 w-9" />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5"><StatusPill published={published} /></div>
        <div className="absolute right-2.5 top-2.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
          <CardActions onEdit={onEdit} onDelete={onDelete} deleting={deleting} />
        </div>
      </div>
      <div className="p-3">
        {badge && (
          <span className="mb-1 inline-block text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            {badge}
          </span>
        )}
        <p className="truncate font-medium text-slate-900 dark:text-white">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )
}

// Text card (FAQs).
function FaqCard({
  question, answer, published, onEdit, onDelete, deleting,
}: {
  question: string
  answer: string
  published: boolean
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="group relative flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', TINT.emerald)}>
        <HelpCircle className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium text-slate-900 dark:text-white">{question}</p>
          <StatusPill published={published} />
        </div>
        {answer && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{answer}</p>}
      </div>
      <div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
        <CardActions onEdit={onEdit} onDelete={onDelete} deleting={deleting} />
      </div>
    </div>
  )
}

function GridSkeleton({ list }: { list?: boolean }) {
  return (
    <div className={list ? 'space-y-3' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
      {Array.from({ length: list ? 4 : 6 }).map((_, i) =>
        list ? (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ) : (
          <div key={i} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <Skeleton className="aspect-[16/10] w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ),
      )}
    </div>
  )
}

function EmptyState({
  icon: Icon, tint, title, description, addLabel, onAdd,
}: {
  icon: LucideIcon
  tint: string
  title: string
  description: string
  addLabel: string
  onAdd: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div className={cn('mb-4 flex h-14 w-14 items-center justify-center rounded-2xl', tint)}>
        <Icon className="h-7 w-7" />
      </div>
      <p className="font-medium text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button className="mt-5" onClick={onAdd}><Plus className="mr-2 h-4 w-4" />{addLabel}</Button>
    </div>
  )
}

// Section wrapper: coloured header + add button, then grid/list/empty/loading.
function Section({
  icon: Icon, tint, title, description, count, addLabel, onAdd, loading, isEmpty, empty, children,
}: {
  icon: LucideIcon
  tint: string
  title: string
  description: string
  count: number
  addLabel: string
  onAdd: () => void
  loading: boolean
  isEmpty: boolean
  empty: { title: string; description: string; list?: boolean }
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', tint)}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 font-oswald text-lg font-semibold text-slate-900 dark:text-white">
              {title}
              {!loading && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {count}
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button onClick={onAdd} className="shrink-0"><Plus className="mr-2 h-4 w-4" />{addLabel}</Button>
      </div>

      {loading ? (
        <GridSkeleton list={empty.list} />
      ) : isEmpty ? (
        <EmptyState icon={Icon} tint={tint} title={empty.title} description={empty.description} addLabel={addLabel} onAdd={onAdd} />
      ) : (
        children
      )}
    </div>
  )
}

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'

export default function WebsiteContentPage() {
  const stories = useSuccessStories()
  const gallery = useGalleryCategories()
  const site = useSiteContent()
  const del = useDeleteContent()

  const [storyModal, setStoryModal] = useState<{ open: boolean; item: SuccessStory | null }>({ open: false, item: null })
  const [galleryModal, setGalleryModal] = useState<{ open: boolean; item: GalleryCategory | null }>({ open: false, item: null })
  const [siteModal, setSiteModal] = useState<{ open: boolean; item: SiteContentItem | null }>({ open: false, item: null })
  const [faqModal, setFaqModal] = useState<{ open: boolean; item: SiteContentItem | null }>({ open: false, item: null })
  const [courseModal, setCourseModal] = useState<{ open: boolean; item: SiteContentItem | null }>({ open: false, item: null })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [target, setTarget] = useState<{ table: ContentTable; id: string; label: string } | null>(null)

  // FAQs and University Courses share the site_content table (types 'faq' /
  // 'course'); keep them out of the generic Site Content tab.
  const faqs = site.data?.filter((it) => it.type === 'faq') ?? []
  const courses = site.data?.filter((it) => it.type === 'course') ?? []
  const siteItems = site.data?.filter((it) => it.type !== 'faq' && it.type !== 'course') ?? []

  async function confirmDelete() {
    if (!target) return
    const { table, id } = target
    setTarget(null)
    setDeletingId(id)
    try {
      await del.mutateAsync({ table, id })
      toast({ title: 'Deleted', description: 'Removed from the website.' })
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const tabBadge = (n: number) => (
    <span className="ml-2 rounded-full bg-slate-200/70 px-1.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
      {n}
    </span>
  )

  return (
    <div className="space-y-6">
      {/* Premium header */}
      <div className="banner-gradient flex flex-col gap-4 rounded-xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-oswald text-2xl font-bold uppercase tracking-tight text-white">Website Content</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/80">
            Manage everything on the public website — stories, gallery, courses, FAQs and more.
            Edits appear on the live site within about a minute.
          </p>
        </div>
        <a
          href={SITE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-white/95 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-white"
        >
          View website <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <Tabs defaultValue="stories">
        <TabsList className="flex-wrap">
          <TabsTrigger value="stories"><Trophy className="mr-2 h-4 w-4" />Success Stories{tabBadge(stories.data?.length ?? 0)}</TabsTrigger>
          <TabsTrigger value="gallery"><Images className="mr-2 h-4 w-4" />Gallery{tabBadge(gallery.data?.length ?? 0)}</TabsTrigger>
          <TabsTrigger value="courses"><GraduationCap className="mr-2 h-4 w-4" />University Courses{tabBadge(courses.length)}</TabsTrigger>
          <TabsTrigger value="faq"><HelpCircle className="mr-2 h-4 w-4" />FAQs{tabBadge(faqs.length)}</TabsTrigger>
          <TabsTrigger value="site"><LayoutList className="mr-2 h-4 w-4" />Site Content{tabBadge(siteItems.length)}</TabsTrigger>
        </TabsList>

        {/* Success Stories */}
        <TabsContent value="stories" className="mt-6">
          <Section
            icon={Trophy} tint={TINT.amber} title="Success Stories"
            description="Player journeys featured on the website."
            count={stories.data?.length ?? 0} addLabel="Add story"
            onAdd={() => setStoryModal({ open: true, item: null })}
            loading={stories.isLoading} isEmpty={!stories.data?.length}
            empty={{ title: 'No success stories yet', description: 'Showcase a player’s journey — add their photo, club and story.' }}
          >
            <div className={GRID}>
              {stories.data?.map((s) => (
                <ContentCard
                  key={s.id} thumb={s.img} title={s.name}
                  subtitle={[s.club, s.year].filter(Boolean).join(' · ') || s.slug}
                  badge={s.tag} published={s.published} fallbackIcon={Trophy}
                  onEdit={() => setStoryModal({ open: true, item: s })}
                  onDelete={() => setTarget({ table: 'website_success_stories', id: s.id, label: s.name })}
                  deleting={deletingId === s.id}
                />
              ))}
            </div>
          </Section>
        </TabsContent>

        {/* Gallery */}
        <TabsContent value="gallery" className="mt-6">
          <Section
            icon={Images} tint={TINT.violet} title="Gallery"
            description="Photo categories shown in the website gallery."
            count={gallery.data?.length ?? 0} addLabel="Add category"
            onAdd={() => setGalleryModal({ open: true, item: null })}
            loading={gallery.isLoading} isEmpty={!gallery.data?.length}
            empty={{ title: 'No gallery categories yet', description: 'Create a category (e.g. Match days) and upload its photos.' }}
          >
            <div className={GRID}>
              {gallery.data?.map((g) => (
                <ContentCard
                  key={g.id} thumb={g.cover || g.images[0] || null} title={g.title}
                  subtitle={`${g.images.length} image${g.images.length === 1 ? '' : 's'}`}
                  published={g.published} fallbackIcon={ImageOff}
                  onEdit={() => setGalleryModal({ open: true, item: g })}
                  onDelete={() => setTarget({ table: 'website_gallery_categories', id: g.id, label: g.title })}
                  deleting={deletingId === g.id}
                />
              ))}
            </div>
          </Section>
        </TabsContent>

        {/* University Courses */}
        <TabsContent value="courses" className="mt-6">
          <Section
            icon={GraduationCap} tint={TINT.blue} title="University Courses"
            description="Degrees grouped by School, each linking to its UCLan page."
            count={courses.length} addLabel="Add course"
            onAdd={() => setCourseModal({ open: true, item: null })}
            loading={site.isLoading} isEmpty={!courses.length}
            empty={{ title: 'No courses added yet', description: 'The website shows a placeholder list until you add courses here. Group each degree by School (Sport, Business, Arts) with its UCLan link.' }}
          >
            <div className={GRID}>
              {courses.map((it) => (
                <ContentCard
                  key={it.id} thumb={it.image} title={it.title}
                  subtitle={it.summary || ''} badge={it.location} published={it.published}
                  fallbackIcon={GraduationCap}
                  onEdit={() => setCourseModal({ open: true, item: it })}
                  onDelete={() => setTarget({ table: 'website_site_content', id: it.id, label: it.title })}
                  deleting={deletingId === it.id}
                />
              ))}
            </div>
          </Section>
        </TabsContent>

        {/* FAQs */}
        <TabsContent value="faq" className="mt-6">
          <Section
            icon={HelpCircle} tint={TINT.emerald} title="FAQs"
            description="Questions and answers on the website’s FAQ page."
            count={faqs.length} addLabel="Add FAQ"
            onAdd={() => setFaqModal({ open: true, item: null })}
            loading={site.isLoading} isEmpty={!faqs.length}
            empty={{ title: 'No FAQs yet', description: 'Answer the questions prospects ask most — applications, costs, dates.', list: true }}
          >
            <div className="space-y-3">
              {faqs.map((it) => (
                <FaqCard
                  key={it.id} question={it.title} answer={it.body ?? ''} published={it.published}
                  onEdit={() => setFaqModal({ open: true, item: it })}
                  onDelete={() => setTarget({ table: 'website_site_content', id: it.id, label: it.title })}
                  deleting={deletingId === it.id}
                />
              ))}
            </div>
          </Section>
        </TabsContent>

        {/* Site Content */}
        <TabsContent value="site" className="mt-6">
          <Section
            icon={LayoutList} tint={TINT.slate} title="Site Content"
            description="ID Clinics and other frequently-changing sections."
            count={siteItems.length} addLabel="Add item"
            onAdd={() => setSiteModal({ open: true, item: null })}
            loading={site.isLoading} isEmpty={!siteItems.length}
            empty={{ title: 'No items yet', description: 'Use this for ID Clinics and any other section you update often.' }}
          >
            <div className={GRID}>
              {siteItems.map((it) => (
                <ContentCard
                  key={it.id} thumb={it.image} title={it.title}
                  subtitle={[it.date_text, it.location].filter(Boolean).join(' · ')}
                  badge={it.type} published={it.published} fallbackIcon={LayoutList}
                  onEdit={() => setSiteModal({ open: true, item: it })}
                  onDelete={() => setTarget({ table: 'website_site_content', id: it.id, label: it.title })}
                  deleting={deletingId === it.id}
                />
              ))}
            </div>
          </Section>
        </TabsContent>
      </Tabs>

      <StoryModal open={storyModal.open} story={storyModal.item} onClose={() => setStoryModal({ open: false, item: null })} />
      <GalleryModal open={galleryModal.open} category={galleryModal.item} onClose={() => setGalleryModal({ open: false, item: null })} />
      <SiteContentModal open={siteModal.open} item={siteModal.item} onClose={() => setSiteModal({ open: false, item: null })} />
      <FaqModal open={faqModal.open} item={faqModal.item} onClose={() => setFaqModal({ open: false, item: null })} />
      <CourseModal open={courseModal.open} item={courseModal.item} onClose={() => setCourseModal({ open: false, item: null })} />

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{target?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the live website. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
