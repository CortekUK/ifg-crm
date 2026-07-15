'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CalendarClock } from 'lucide-react'
import { ImageField } from './ImageField'
import { ContentDialog, DateField, Field, FieldRow, FormSection, PublishControls } from './_form'
import { useSaveSiteContent } from '@/lib/hooks/useWebsiteContent'
import { toast } from '@/lib/hooks/use-toast'
import type { SiteContentItem } from '@/lib/types/website-content'

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

// ID Clinics live in website_site_content with type 'id_clinic':
// title = clinic name, date_text/location = when & where, summary/body = details,
// image = photo, link_url/link_label = the CTA. This is a focused editor over the
// generic table — the freeform "type" field is intentionally hidden.
export function SiteContentModal({
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
    title: '', slug: '', summary: '', body: '', date_text: '',
    location: '', image: '', link_url: '', link_label: '', published: true, sort_order: 0,
  })
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    if (item) {
      setF({
        title: item.title, slug: item.slug, summary: item.summary ?? '',
        body: item.body ?? '', date_text: item.date_text ?? '', location: item.location ?? '',
        image: item.image ?? '', link_url: item.link_url ?? '', link_label: item.link_label ?? '',
        published: item.published, sort_order: item.sort_order,
      })
      setSlugTouched(true)
    } else {
      setF({ title: '', slug: '', summary: '', body: '', date_text: '', location: '', image: '', link_url: '', link_label: '', published: true, sort_order: 0 })
      setSlugTouched(false)
    }
  }, [open, item])

  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }))

  async function submit() {
    if (!f.title.trim()) {
      toast({ title: 'A clinic name is required', variant: 'destructive' })
      return
    }
    const slug = f.slug.trim() || slugify(f.title) || `id-clinic-${Date.now()}`
    try {
      await save.mutateAsync({
        ...(item ? { id: item.id } : {}),
        type: 'id_clinic', title: f.title.trim(), slug,
        summary: f.summary || null, body: f.body || null, date_text: f.date_text || null,
        location: f.location || null, image: f.image || null,
        link_url: f.link_url || null, link_label: f.link_label || null,
        published: f.published, sort_order: Number(f.sort_order) || 0,
      })
      toast({ title: item ? 'Clinic updated' : 'Clinic added' })
      onClose()
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    }
  }

  return (
    <ContentDialog
      open={open}
      onClose={onClose}
      icon={CalendarClock}
      accent="slate"
      title={item ? 'Edit ID clinic' : 'New ID clinic'}
      description="An upcoming clinic shown on the ID Clinics page."
      onSubmit={submit}
      submitLabel={item ? 'Save changes' : 'Add clinic'}
      saving={save.isPending}
    >
      <FormSection title="When & where">
        <Field label="Clinic name" required>
          <Input
            value={f.title}
            onChange={(e) => { set('title', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)) }}
            placeholder="London ID Clinic"
          />
        </Field>
        <FieldRow>
          <DateField label="Date" value={f.date_text} onChange={(v) => set('date_text', v)} />
          <Field label="Location">
            <Input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="London, UK" />
          </Field>
        </FieldRow>
      </FormSection>

      <FormSection title="Details">
        <Field label="Summary" hint="A short line shown under the title.">
          <Textarea value={f.summary} onChange={(e) => set('summary', e.target.value)} rows={2} />
        </Field>
        <Field label="Details">
          <Textarea value={f.body} onChange={(e) => set('body', e.target.value)} rows={4} />
        </Field>
        <ImageField label="Image" value={f.image} onChange={(v) => set('image', v)} />
      </FormSection>

      <FormSection title="Call to action">
        <FieldRow>
          <Field label="Button link" hint="Where the button sends visitors.">
            <Input value={f.link_url} onChange={(e) => set('link_url', e.target.value)} placeholder="/programmes/macclesfield/apply" />
          </Field>
          <Field label="Button label">
            <Input value={f.link_label} onChange={(e) => set('link_label', e.target.value)} placeholder="Register interest" />
          </Field>
        </FieldRow>
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
