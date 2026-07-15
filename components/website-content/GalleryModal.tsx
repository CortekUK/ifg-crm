'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Images } from 'lucide-react'
import { ImageField } from './ImageField'
import { MultiImageField } from './MultiImageField'
import { ContentDialog, Field, FieldRow, FormSection, PublishControls } from './_form'
import { useSaveGallery } from '@/lib/hooks/useWebsiteContent'
import { toast } from '@/lib/hooks/use-toast'
import type { GalleryCategory } from '@/lib/types/website-content'

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export function GalleryModal({
  open,
  onClose,
  category,
}: {
  open: boolean
  onClose: () => void
  category: GalleryCategory | null
}) {
  const save = useSaveGallery()
  const [f, setF] = useState({ title: '', slug: '', blurb: '', cover: '', images: [] as string[], published: true, sort_order: 0 })
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    if (category) {
      setF({
        title: category.title, slug: category.slug, blurb: category.blurb ?? '',
        cover: category.cover ?? '', images: category.images ?? [],
        published: category.published, sort_order: category.sort_order,
      })
      setSlugTouched(true)
    } else {
      setF({ title: '', slug: '', blurb: '', cover: '', images: [], published: true, sort_order: 0 })
      setSlugTouched(false)
    }
  }, [open, category])

  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }))

  async function submit() {
    if (!f.title.trim() || !f.slug.trim()) {
      toast({ title: 'Title and slug are required', variant: 'destructive' })
      return
    }
    try {
      await save.mutateAsync({
        ...(category ? { id: category.id } : {}),
        title: f.title.trim(), slug: f.slug.trim(), blurb: f.blurb || null,
        cover: f.cover || f.images[0] || null, images: f.images,
        published: f.published, sort_order: Number(f.sort_order) || 0,
      })
      toast({ title: category ? 'Category updated' : 'Category created' })
      onClose()
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    }
  }

  return (
    <ContentDialog
      open={open}
      onClose={onClose}
      icon={Images}
      accent="violet"
      title={category ? 'Edit gallery category' : 'New gallery category'}
      description="A photo album shown in the website gallery."
      onSubmit={submit}
      submitLabel={category ? 'Save changes' : 'Create category'}
      saving={save.isPending}
    >
      <FormSection title="Details">
        <FieldRow>
          <Field label="Title" required>
            <Input
              value={f.title}
              onChange={(e) => {
                set('title', e.target.value)
                if (!slugTouched) set('slug', slugify(e.target.value))
              }}
              placeholder="Match Days"
            />
          </Field>
          <Field label="Slug" required hint="Used in the page URL.">
            <Input value={f.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value) }} placeholder="match-days" />
          </Field>
        </FieldRow>
        <Field label="Blurb">
          <Textarea value={f.blurb} onChange={(e) => set('blurb', e.target.value)} rows={2} />
        </Field>
      </FormSection>

      <FormSection title="Photos">
        <ImageField label="Cover image" hint="Defaults to the first photo if left blank." value={f.cover} onChange={(v) => set('cover', v)} />
        <MultiImageField label="Images" value={f.images} onChange={(v) => set('images', v)} />
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
