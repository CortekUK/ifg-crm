'use client'

import * as React from 'react'
import { GraduationCap, Users, HelpCircle, CalendarClock, Trophy, Images, ImageOff, Newspaper } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'
import {
  useSuccessStories, useGalleryCategories, useSiteContent, useDeleteContent,
} from '@/lib/hooks/useWebsiteContent'
import { useNews, useDeleteNews } from '@/lib/hooks/useWebsiteNews'
import type { SuccessStory, GalleryCategory, SiteContentItem, WebsiteNews } from '@/lib/types/website-content'
import { StoryModal } from './StoryModal'
import { GalleryModal } from './GalleryModal'
import { SiteContentModal } from './SiteContentModal'
import { FaqModal } from './FaqModal'
import { CourseModal } from './CourseModal'
import { StaffModal } from './StaffModal'
import { NewsModal } from './NewsModal'
import { Section, ContentCard, FaqCard, DeleteConfirm, GRID, TINT } from './_shared'

type ContentTable = 'website_success_stories' | 'website_gallery_categories' | 'website_site_content'

// Small hook: shared delete-with-confirm state for a fixed table.
function useDeleter(table: ContentTable) {
  const del = useDeleteContent()
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [target, setTarget] = React.useState<{ id: string; label: string } | null>(null)
  async function confirm() {
    if (!target) return
    const id = target.id
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
  return { deletingId, target, setTarget, confirm }
}

// ── Success Stories ───────────────────────────────────────────────────────────
export function StoriesManager() {
  const stories = useSuccessStories()
  const { deletingId, target, setTarget, confirm } = useDeleter('website_success_stories')
  const [modal, setModal] = React.useState<{ open: boolean; item: SuccessStory | null }>({ open: false, item: null })
  return (
    <>
      <Section
        icon={Trophy} tint={TINT.amber} title="Success Stories"
        description="Player journeys featured on the website." count={stories.data?.length ?? 0}
        addLabel="Add story" onAdd={() => setModal({ open: true, item: null })}
        loading={stories.isLoading} isEmpty={!stories.data?.length}
        empty={{ title: 'No success stories yet', description: 'Showcase a player’s journey — add their photo, club and story.' }}
      >
        <div className={GRID}>
          {stories.data?.map((s) => (
            <ContentCard key={s.id} thumb={s.img} title={s.name}
              subtitle={[s.club, s.year].filter(Boolean).join(' · ') || s.slug} badge={s.tag}
              published={s.published} fallbackIcon={Trophy}
              onEdit={() => setModal({ open: true, item: s })}
              onDelete={() => setTarget({ id: s.id, label: s.name })} deleting={deletingId === s.id} />
          ))}
        </div>
      </Section>
      <StoryModal open={modal.open} story={modal.item} onClose={() => setModal({ open: false, item: null })} />
      <DeleteConfirm target={target} onCancel={() => setTarget(null)} onConfirm={confirm} />
    </>
  )
}

// ── Gallery ───────────────────────────────────────────────────────────────────
export function GalleryManager() {
  const gallery = useGalleryCategories()
  const { deletingId, target, setTarget, confirm } = useDeleter('website_gallery_categories')
  const [modal, setModal] = React.useState<{ open: boolean; item: GalleryCategory | null }>({ open: false, item: null })
  return (
    <>
      <Section
        icon={Images} tint={TINT.violet} title="Gallery"
        description="Photo categories shown in the website gallery." count={gallery.data?.length ?? 0}
        addLabel="Add category" onAdd={() => setModal({ open: true, item: null })}
        loading={gallery.isLoading} isEmpty={!gallery.data?.length}
        empty={{ title: 'No gallery categories yet', description: 'Create a category (e.g. Match days) and upload its photos.' }}
      >
        <div className={GRID}>
          {gallery.data?.map((g) => (
            <ContentCard key={g.id} thumb={g.cover || g.images[0] || null} title={g.title}
              subtitle={`${g.images.length} image${g.images.length === 1 ? '' : 's'}`}
              published={g.published} fallbackIcon={ImageOff}
              onEdit={() => setModal({ open: true, item: g })}
              onDelete={() => setTarget({ id: g.id, label: g.title })} deleting={deletingId === g.id} />
          ))}
        </div>
      </Section>
      <GalleryModal open={modal.open} category={modal.item} onClose={() => setModal({ open: false, item: null })} />
      <DeleteConfirm target={target} onCancel={() => setTarget(null)} onConfirm={confirm} />
    </>
  )
}

// ── Latest News (own table, rich article body) ───────────────────────────────
export function NewsManager() {
  const news = useNews()
  const del = useDeleteNews()
  const [modal, setModal] = React.useState<{ open: boolean; item: WebsiteNews | null }>({ open: false, item: null })
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [target, setTarget] = React.useState<{ id: string; label: string } | null>(null)

  async function confirm() {
    if (!target) return
    const id = target.id
    setTarget(null)
    setDeletingId(id)
    try {
      await del.mutateAsync(id)
      toast({ title: 'Article deleted', description: 'Removed from the website.' })
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Section
        icon={Newspaper} tint={TINT.amber} title="Latest News"
        description="Articles on the /news page — each gets its own detail page." count={news.data?.length ?? 0}
        addLabel="New article" onAdd={() => setModal({ open: true, item: null })}
        loading={news.isLoading} isEmpty={!news.data?.length}
        empty={{ title: 'No articles yet', description: 'The website shows its built-in articles until you publish one here.' }}
      >
        <div className={GRID}>
          {news.data?.map((n) => (
            <ContentCard key={n.id} thumb={n.img} title={n.title}
              subtitle={[n.category, n.date_text].filter(Boolean).join(' · ')} published={n.published}
              fallbackIcon={Newspaper}
              onEdit={() => setModal({ open: true, item: n })}
              onDelete={() => setTarget({ id: n.id, label: n.title })} deleting={deletingId === n.id} />
          ))}
        </div>
      </Section>
      <NewsModal open={modal.open} item={modal.item} onClose={() => setModal({ open: false, item: null })} />
      <DeleteConfirm target={target} onCancel={() => setTarget(null)} onConfirm={confirm} />
    </>
  )
}

// ── Site-content-backed collections (course / staff / faq / id_clinic) ─────────
function useSiteCollection(type: string) {
  const site = useSiteContent()
  const items = site.data?.filter((it) => it.type === type) ?? []
  return { items, loading: site.isLoading }
}

export function CoursesManager() {
  const { items, loading } = useSiteCollection('course')
  const { deletingId, target, setTarget, confirm } = useDeleter('website_site_content')
  const [modal, setModal] = React.useState<{ open: boolean; item: SiteContentItem | null }>({ open: false, item: null })
  return (
    <>
      <Section
        icon={GraduationCap} tint={TINT.blue} title="University Courses"
        description="Degrees grouped by School, each linking to its course page." count={items.length}
        addLabel="Add course" onAdd={() => setModal({ open: true, item: null })}
        loading={loading} isEmpty={!items.length}
        empty={{ title: 'No courses added yet', description: 'The website shows a placeholder list until you add courses. Group each degree by School (Sport, Business, Arts).' }}
      >
        <div className={GRID}>
          {items.map((it) => (
            <ContentCard key={it.id} thumb={it.image} title={it.title} subtitle={it.summary || ''} badge={it.location}
              published={it.published} fallbackIcon={GraduationCap}
              onEdit={() => setModal({ open: true, item: it })}
              onDelete={() => setTarget({ id: it.id, label: it.title })} deleting={deletingId === it.id} />
          ))}
        </div>
      </Section>
      <CourseModal open={modal.open} item={modal.item} onClose={() => setModal({ open: false, item: null })} />
      <DeleteConfirm target={target} onCancel={() => setTarget(null)} onConfirm={confirm} />
    </>
  )
}

export function StaffManager() {
  const { items, loading } = useSiteCollection('staff')
  const { deletingId, target, setTarget, confirm } = useDeleter('website_site_content')
  const [modal, setModal] = React.useState<{ open: boolean; item: SiteContentItem | null }>({ open: false, item: null })
  return (
    <>
      <Section
        icon={Users} tint={TINT.violet} title="Staff & Coaches"
        description="The people on the Coaches & Staff page, grouped by role." count={items.length}
        addLabel="Add staff member" onAdd={() => setModal({ open: true, item: null })}
        loading={loading} isEmpty={!items.length}
        empty={{ title: 'No staff added yet', description: 'Group each person by Leadership, Recruiters, Physios or Coaches.' }}
      >
        <div className={GRID}>
          {items.map((it) => (
            <ContentCard key={it.id} thumb={it.image} title={it.title} subtitle={it.summary || ''} badge={it.location}
              published={it.published} fallbackIcon={Users}
              onEdit={() => setModal({ open: true, item: it })}
              onDelete={() => setTarget({ id: it.id, label: it.title })} deleting={deletingId === it.id} />
          ))}
        </div>
      </Section>
      <StaffModal open={modal.open} item={modal.item} onClose={() => setModal({ open: false, item: null })} />
      <DeleteConfirm target={target} onCancel={() => setTarget(null)} onConfirm={confirm} />
    </>
  )
}

export function FaqsManager() {
  const { items, loading } = useSiteCollection('faq')
  const { deletingId, target, setTarget, confirm } = useDeleter('website_site_content')
  const [modal, setModal] = React.useState<{ open: boolean; item: SiteContentItem | null }>({ open: false, item: null })
  return (
    <>
      <Section
        icon={HelpCircle} tint={TINT.emerald} title="FAQs"
        description="Questions and answers on the website’s FAQ page." count={items.length}
        addLabel="Add FAQ" onAdd={() => setModal({ open: true, item: null })}
        loading={loading} isEmpty={!items.length}
        empty={{ title: 'No FAQs yet', description: 'Answer the questions prospects ask most — applications, costs, dates.', list: true }}
      >
        <div className="space-y-3">
          {items.map((it) => (
            <FaqCard key={it.id} question={it.title} answer={it.body ?? ''} published={it.published}
              onEdit={() => setModal({ open: true, item: it })}
              onDelete={() => setTarget({ id: it.id, label: it.title })} deleting={deletingId === it.id} />
          ))}
        </div>
      </Section>
      <FaqModal open={modal.open} item={modal.item} onClose={() => setModal({ open: false, item: null })} />
      <DeleteConfirm target={target} onCancel={() => setTarget(null)} onConfirm={confirm} />
    </>
  )
}

export function ClinicsManager() {
  const { items, loading } = useSiteCollection('id_clinic')
  const { deletingId, target, setTarget, confirm } = useDeleter('website_site_content')
  const [modal, setModal] = React.useState<{ open: boolean; item: SiteContentItem | null }>({ open: false, item: null })
  return (
    <>
      <Section
        icon={CalendarClock} tint={TINT.slate} title="ID Clinics"
        description="Upcoming identification clinics shown on the ID Clinics page." count={items.length}
        addLabel="Add clinic" onAdd={() => setModal({ open: true, item: null })}
        loading={loading} isEmpty={!items.length}
        empty={{ title: 'No clinics yet', description: 'The ID Clinics page shows a “coming soon” message until you add upcoming clinics.' }}
      >
        <div className={GRID}>
          {items.map((it) => (
            <ContentCard key={it.id} thumb={it.image} title={it.title}
              subtitle={[it.date_text, it.location].filter(Boolean).join(' · ') || it.summary || ''}
              published={it.published} fallbackIcon={CalendarClock}
              onEdit={() => setModal({ open: true, item: it })}
              onDelete={() => setTarget({ id: it.id, label: it.title })} deleting={deletingId === it.id} />
          ))}
        </div>
      </Section>
      <SiteContentModal open={modal.open} item={modal.item} onClose={() => setModal({ open: false, item: null })} />
      <DeleteConfirm target={target} onCancel={() => setTarget(null)} onConfirm={confirm} />
    </>
  )
}
