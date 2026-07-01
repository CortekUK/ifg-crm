'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Loader2, Images, Trophy, LayoutList, HelpCircle, GraduationCap } from 'lucide-react'
import {
  useSuccessStories,
  useGalleryCategories,
  useSiteContent,
  useDeleteContent,
} from '@/lib/hooks/useWebsiteContent'
import { StoryModal } from '@/components/website-content/StoryModal'
import { GalleryModal } from '@/components/website-content/GalleryModal'
import { SiteContentModal } from '@/components/website-content/SiteContentModal'
import { FaqModal } from '@/components/website-content/FaqModal'
import { CourseModal } from '@/components/website-content/CourseModal'
import { toast } from '@/lib/hooks/use-toast'
import type { SuccessStory, GalleryCategory, SiteContentItem } from '@/lib/types/website-content'

type ContentTable = 'website_success_stories' | 'website_gallery_categories' | 'website_site_content'

function Row({
  thumb,
  title,
  subtitle,
  published,
  onEdit,
  onDelete,
  deleting,
}: {
  thumb: string | null
  title: string
  subtitle: string
  published: boolean
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <Card className="flex items-center gap-4 p-3">
      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{title}</p>
          {!published && <Badge variant="secondary">Draft</Badge>}
        </div>
        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete} disabled={deleting} aria-label="Delete">
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
      </Button>
    </Card>
  )
}

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

  // FAQs and University Courses share the site_content table (types 'faq' and
  // 'course'); keep them out of the generic Site Content tab.
  const faqs = site.data?.filter((it) => it.type === 'faq') ?? []
  const courses = site.data?.filter((it) => it.type === 'course') ?? []
  const siteItems = site.data?.filter((it) => it.type !== 'faq' && it.type !== 'course') ?? []

  async function remove(table: ContentTable, id: string, label: string) {
    if (!window.confirm(`Delete "${label}"? This removes it from the website.`)) return
    setDeletingId(id)
    try {
      await del.mutateAsync({ table, id })
      toast({ title: 'Deleted' })
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-oswald text-2xl font-bold uppercase tracking-tight">Website Content</h1>
        <p className="text-sm text-muted-foreground">
          Manage the public website&apos;s Success Stories, Gallery, and other sections. Changes appear on the live
          site within about a minute.
        </p>
      </div>

      <Tabs defaultValue="stories">
        <TabsList>
          <TabsTrigger value="stories"><Trophy className="mr-2 h-4 w-4" />Success Stories</TabsTrigger>
          <TabsTrigger value="gallery"><Images className="mr-2 h-4 w-4" />Gallery</TabsTrigger>
          <TabsTrigger value="courses"><GraduationCap className="mr-2 h-4 w-4" />University Courses</TabsTrigger>
          <TabsTrigger value="faq"><HelpCircle className="mr-2 h-4 w-4" />FAQs</TabsTrigger>
          <TabsTrigger value="site"><LayoutList className="mr-2 h-4 w-4" />Site Content</TabsTrigger>
        </TabsList>

        {/* Success Stories */}
        <TabsContent value="stories" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setStoryModal({ open: true, item: null })}><Plus className="mr-2 h-4 w-4" />Add story</Button>
          </div>
          {stories.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : stories.data?.length ? (
            stories.data.map((s) => (
              <Row
                key={s.id}
                thumb={s.img}
                title={s.name}
                subtitle={[s.club, s.year].filter(Boolean).join(' · ') || s.slug}
                published={s.published}
                onEdit={() => setStoryModal({ open: true, item: s })}
                onDelete={() => remove('website_success_stories', s.id, s.name)}
                deleting={deletingId === s.id}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No stories yet.</p>
          )}
        </TabsContent>

        {/* Gallery */}
        <TabsContent value="gallery" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setGalleryModal({ open: true, item: null })}><Plus className="mr-2 h-4 w-4" />Add category</Button>
          </div>
          {gallery.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : gallery.data?.length ? (
            gallery.data.map((g) => (
              <Row
                key={g.id}
                thumb={g.cover || g.images[0] || null}
                title={g.title}
                subtitle={`${g.images.length} image${g.images.length === 1 ? '' : 's'}`}
                published={g.published}
                onEdit={() => setGalleryModal({ open: true, item: g })}
                onDelete={() => remove('website_gallery_categories', g.id, g.title)}
                deleting={deletingId === g.id}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No gallery categories yet.</p>
          )}
        </TabsContent>

        {/* University Courses */}
        <TabsContent value="courses" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setCourseModal({ open: true, item: null })}><Plus className="mr-2 h-4 w-4" />Add course</Button>
          </div>
          {site.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : courses.length ? (
            courses.map((it) => (
              <Row
                key={it.id}
                thumb={it.image}
                title={it.title}
                subtitle={[it.location, it.summary].filter(Boolean).join(' · ')}
                published={it.published}
                onEdit={() => setCourseModal({ open: true, item: it })}
                onDelete={() => remove('website_site_content', it.id, it.title)}
                deleting={deletingId === it.id}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No courses yet — the website shows a built-in placeholder list until you add them here.
              Group each degree by School (Sport, Business, Arts) with its UCLan link.
            </p>
          )}
        </TabsContent>

        {/* FAQs */}
        <TabsContent value="faq" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setFaqModal({ open: true, item: null })}><Plus className="mr-2 h-4 w-4" />Add FAQ</Button>
          </div>
          {site.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : faqs.length ? (
            faqs.map((it) => (
              <Row
                key={it.id}
                thumb={null}
                title={it.title}
                subtitle={it.body ?? ''}
                published={it.published}
                onEdit={() => setFaqModal({ open: true, item: it })}
                onDelete={() => remove('website_site_content', it.id, it.title)}
                deleting={deletingId === it.id}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No FAQs yet. These appear on the website&apos;s FAQ page.
            </p>
          )}
        </TabsContent>

        {/* Site Content */}
        <TabsContent value="site" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setSiteModal({ open: true, item: null })}><Plus className="mr-2 h-4 w-4" />Add item</Button>
          </div>
          {site.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : siteItems.length ? (
            siteItems.map((it) => (
              <Row
                key={it.id}
                thumb={it.image}
                title={it.title}
                subtitle={[it.type, it.date_text, it.location].filter(Boolean).join(' · ')}
                published={it.published}
                onEdit={() => setSiteModal({ open: true, item: it })}
                onDelete={() => remove('website_site_content', it.id, it.title)}
                deleting={deletingId === it.id}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No items yet. Use this for ID Clinics and other frequently-changing sections.
            </p>
          )}
        </TabsContent>
      </Tabs>

      <StoryModal open={storyModal.open} story={storyModal.item} onClose={() => setStoryModal({ open: false, item: null })} />
      <GalleryModal open={galleryModal.open} category={galleryModal.item} onClose={() => setGalleryModal({ open: false, item: null })} />
      <SiteContentModal open={siteModal.open} item={siteModal.item} onClose={() => setSiteModal({ open: false, item: null })} />
      <FaqModal open={faqModal.open} item={faqModal.item} onClose={() => setFaqModal({ open: false, item: null })} />
      <CourseModal open={courseModal.open} item={courseModal.item} onClose={() => setCourseModal({ open: false, item: null })} />
    </div>
  )
}
