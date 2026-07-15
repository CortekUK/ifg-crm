'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Trophy } from 'lucide-react'
import { ImageField } from './ImageField'
import { ContentDialog, Field, FieldRow, FormSection, PublishControls } from './_form'
import { useSaveStory } from '@/lib/hooks/useWebsiteContent'
import { toast } from '@/lib/hooks/use-toast'
import type { SuccessStory } from '@/lib/types/website-content'

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const toParas = (s: string) => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

export function StoryModal({
  open,
  onClose,
  story,
}: {
  open: boolean
  onClose: () => void
  story: SuccessStory | null
}) {
  const save = useSaveStory()
  const [f, setF] = useState({
    name: '', slug: '', tag: '', year: '', club: '', img: '', hero_img: '',
    blurb: '', body: '', published: true, sort_order: 0,
  })
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    if (story) {
      setF({
        name: story.name, slug: story.slug, tag: story.tag ?? '', year: story.year ?? '',
        club: story.club ?? '', img: story.img ?? '', hero_img: story.hero_img ?? '',
        blurb: (story.blurb ?? []).join('\n\n'), body: (story.body ?? []).join('\n\n'),
        published: story.published, sort_order: story.sort_order,
      })
      setSlugTouched(true)
    } else {
      setF({ name: '', slug: '', tag: 'Latest News', year: '', club: '', img: '', hero_img: '', blurb: '', body: '', published: true, sort_order: 0 })
      setSlugTouched(false)
    }
  }, [open, story])

  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }))

  async function submit() {
    if (!f.name.trim() || !f.slug.trim()) {
      toast({ title: 'Name and slug are required', variant: 'destructive' })
      return
    }
    try {
      await save.mutateAsync({
        ...(story ? { id: story.id } : {}),
        name: f.name.trim(), slug: f.slug.trim(), tag: f.tag || null, year: f.year || null,
        club: f.club || null, img: f.img || null, hero_img: f.hero_img || null,
        blurb: toParas(f.blurb), body: toParas(f.body),
        published: f.published, sort_order: Number(f.sort_order) || 0,
      })
      toast({ title: story ? 'Story updated' : 'Story created' })
      onClose()
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    }
  }

  return (
    <ContentDialog
      open={open}
      onClose={onClose}
      icon={Trophy}
      accent="amber"
      title={story ? 'Edit success story' : 'New success story'}
      description="A player's journey, featured on the website."
      onSubmit={submit}
      submitLabel={story ? 'Save changes' : 'Create story'}
      saving={save.isPending}
    >
      <FormSection title="Player">
        <FieldRow>
          <Field label="Player name" required>
            <Input
              value={f.name}
              onChange={(e) => {
                set('name', e.target.value)
                if (!slugTouched) set('slug', slugify(e.target.value))
              }}
              placeholder="Carlos Dos Santos"
            />
          </Field>
          <Field label="Slug" required hint="Used in the page URL.">
            <Input value={f.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value) }} placeholder="carlos-dos-santos" />
          </Field>
        </FieldRow>
        <FieldRow cols={3}>
          <Field label="Tag"><Input value={f.tag} onChange={(e) => set('tag', e.target.value)} placeholder="Latest News" /></Field>
          <Field label="Year"><Input value={f.year} onChange={(e) => set('year', e.target.value)} placeholder="2024" /></Field>
          <Field label="Club"><Input value={f.club} onChange={(e) => set('club', e.target.value)} placeholder="Macclesfield FC" /></Field>
        </FieldRow>
      </FormSection>

      <FormSection title="Images">
        <ImageField label="Card image" value={f.img} onChange={(v) => set('img', v)} />
        <ImageField label="Hero image" hint="Shown on the story's detail page." value={f.hero_img} onChange={(v) => set('hero_img', v)} />
      </FormSection>

      <FormSection title="Story">
        <Field label="Card summary" hint="Shown on the card. One paragraph per blank line.">
          <Textarea value={f.blurb} onChange={(e) => set('blurb', e.target.value)} rows={3} />
        </Field>
        <Field label="Full story" hint="Shown on the detail page. One paragraph per blank line.">
          <Textarea value={f.body} onChange={(e) => set('body', e.target.value)} rows={7} />
        </Field>
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
