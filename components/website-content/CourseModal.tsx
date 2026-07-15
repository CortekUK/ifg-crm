'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GraduationCap } from 'lucide-react'
import { ImageField } from './ImageField'
import { ContentDialog, Field, FieldRow, FormSection, PublishControls } from './_form'
import { useSaveSiteContent } from '@/lib/hooks/useWebsiteContent'
import { toast } from '@/lib/hooks/use-toast'
import type { SiteContentItem } from '@/lib/types/website-content'

const SCHOOLS = ['Sport', 'Business', 'Arts'] as const

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

// University courses live in website_site_content with type 'course':
// title = course name, location = School, summary = level, link_url = UCLan page,
// image = tile image. This modal is a focused editor over that generic table.
export function CourseModal({
  open,
  onClose,
  item,
}: {
  open: boolean
  onClose: () => void
  item: SiteContentItem | null
}) {
  const save = useSaveSiteContent()
  const [f, setF] = useState({
    school: 'Sport', name: '', level: '', url: '', image: '', published: true, sort_order: 0,
  })

  useEffect(() => {
    if (!open) return
    if (item) {
      setF({
        school: SCHOOLS.includes(item.location as (typeof SCHOOLS)[number]) ? (item.location as string) : 'Sport',
        name: item.title,
        level: item.summary ?? '',
        url: item.link_url ?? '',
        image: item.image ?? '',
        published: item.published,
        sort_order: item.sort_order,
      })
    } else {
      setF({ school: 'Sport', name: '', level: '', url: '', image: '', published: true, sort_order: 0 })
    }
  }, [open, item])

  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }))

  async function submit() {
    if (!f.name.trim() || !f.url.trim()) {
      toast({ title: 'Course name and UCLan link are required', variant: 'destructive' })
      return
    }
    const slug = item?.slug || slugify(f.name) || `course-${Date.now()}`
    try {
      await save.mutateAsync({
        ...(item ? { id: item.id } : {}),
        type: 'course',
        title: f.name.trim(),
        slug,
        location: f.school,
        summary: f.level.trim() || null,
        link_url: f.url.trim(),
        link_label: 'View course',
        image: f.image || null,
        body: null,
        date_text: null,
        published: f.published,
        sort_order: Number(f.sort_order) || 0,
      })
      toast({ title: item ? 'Course updated' : 'Course created' })
      onClose()
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    }
  }

  return (
    <ContentDialog
      open={open}
      onClose={onClose}
      icon={GraduationCap}
      accent="blue"
      title={item ? 'Edit course' : 'New course'}
      description="A degree shown on the University Courses page."
      onSubmit={submit}
      submitLabel={item ? 'Save changes' : 'Create course'}
      saving={save.isPending}
    >
      <FormSection title="Course">
        <FieldRow>
          <Field label="School" required>
            <Select value={f.school} onValueChange={(v) => set('school', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCHOOLS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Level">
            <Input value={f.level} onChange={(e) => set('level', e.target.value)} placeholder="Bachelor's · 3 Years" />
          </Field>
        </FieldRow>
        <Field label="Course name" required>
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="BSc (Hons) Football Studies" />
        </Field>
        <Field label="UCLan course link" required hint="The visitor's details are captured before they're taken to this page.">
          <Input value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://www.uclan.ac.uk/courses/..." />
        </Field>
        <ImageField label="Tile image" value={f.image} onChange={(v) => set('image', v)} />
      </FormSection>

      <PublishControls
        published={f.published}
        onPublishedChange={(v) => set('published', v)}
        sortOrder={f.sort_order}
        onSortOrderChange={(v) => set('sort_order', v)}
      />
    </ContentDialog>
  )
}
