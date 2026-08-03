'use client'

import * as React from 'react'
import { Shield, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/hooks/use-toast'
import { useSaveSquad } from '@/lib/hooks/useWebsiteSquads'
import type { WebsiteSquad, WebsiteSquadInput, RosterPlayer } from '@/lib/types/website-content'
import { ContentDialog, FormSection, Field, FieldRow, PublishControls } from './_form'
import { ImageField } from './ImageField'

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

export function SquadModal({ open, item, onClose }: { open: boolean; item: WebsiteSquad | null; onClose: () => void }) {
  const save = useSaveSquad()

  const [name, setName] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [slugTouched, setSlugTouched] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [heroImg, setHeroImg] = React.useState('')
  const [photo, setPhoto] = React.useState('')
  const [leagueUrl, setLeagueUrl] = React.useState('')
  const [intro, setIntro] = React.useState<string[]>([''])
  const [roster, setRoster] = React.useState<RosterPlayer[]>([])
  const [published, setPublished] = React.useState(true)
  const [sortOrder, setSortOrder] = React.useState('0')

  React.useEffect(() => {
    if (!open) return
    setName(item?.name ?? '')
    setSlug(item?.slug ?? '')
    setSlugTouched(!!item)
    setTitle(item?.title ?? '')
    setHeroImg(item?.hero_img ?? '')
    setPhoto(item?.photo ?? '')
    setLeagueUrl(item?.league_url ?? '')
    setIntro(item?.intro?.length ? item.intro : [''])
    setRoster(item?.roster ?? [])
    setPublished(item?.published ?? true)
    setSortOrder(String(item?.sort_order ?? 0))
  }, [open, item])

  // Auto-slug from name until the user edits the slug directly.
  React.useEffect(() => {
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  // Intro paragraphs
  const setPara = (i: number, v: string) => setIntro((p) => p.map((x, idx) => (idx === i ? v : x)))
  const addPara = () => setIntro((p) => [...p, ''])
  const removePara = (i: number) => setIntro((p) => (p.length <= 1 ? [''] : p.filter((_, idx) => idx !== i)))

  // Roster
  const setPlayer = (i: number, patch: Partial<RosterPlayer>) =>
    setRoster((r) => r.map((pl, idx) => (idx === i ? { ...pl, ...patch } : pl)))
  const addPlayer = () => setRoster((r) => [...r, { name: '', pos: '' }])
  const removePlayer = (i: number) => setRoster((r) => r.filter((_, idx) => idx !== i))

  async function submit() {
    const n = name.trim(); const s = slug.trim()
    if (!n || !s) {
      toast({ title: 'Missing details', description: 'A name and slug are required.', variant: 'destructive' })
      return
    }
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(s)) {
      toast({ title: 'Invalid slug', description: 'Use lowercase letters, numbers and hyphens.', variant: 'destructive' })
      return
    }
    const payload: WebsiteSquadInput = {
      ...(item ? { id: item.id } : {}),
      slug: s, name: n, title: title.trim(),
      hero_img: heroImg.trim() || null,
      photo: photo.trim() || null,
      league_url: leagueUrl.trim() || null,
      intro: intro.map((p) => p.trim()).filter(Boolean),
      roster: roster
        .map((p) => ({ name: p.name.trim(), pos: p.pos.trim() }))
        .filter((p) => p.name || p.pos),
      published,
      sort_order: Number(sortOrder) || 0,
    }
    try {
      await save.mutateAsync(payload)
      toast({ title: item ? 'Squad updated' : 'Squad added', description: 'Live on the website within about a minute.' })
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      toast({
        title: 'Save failed',
        description: /duplicate|unique/i.test(msg) ? `A squad with slug "${s}" already exists.` : msg,
        variant: 'destructive',
      })
    }
  }

  return (
    <ContentDialog
      open={open} onClose={onClose} icon={Shield} accent="blue"
      title={item ? 'Edit squad' : 'New squad'}
      description="A playing squad with its own detail page and roster."
      onSubmit={submit} submitLabel={item ? 'Save squad' : 'Add squad'} saving={save.isPending}
    >
      <FormSection title="Squad">
        <Field label="Name" required hint="Tile label, e.g. U19 Squad">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="U19 Squad" />
        </Field>
        <FieldRow>
          <Field label="Slug" required hint="Used in the URL: /teams/your-slug">
            <Input value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true) }} placeholder="u19" />
          </Field>
          <Field label="Page title" hint="Heading on the squad page.">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Under 19 Playing Squad" />
          </Field>
        </FieldRow>
        <Field label="League table link" hint="Optional external link (FA Full-Time etc.).">
          <Input value={leagueUrl} onChange={(e) => setLeagueUrl(e.target.value)} placeholder="https://…" />
        </Field>
      </FormSection>

      <FormSection title="Images">
        <FieldRow>
          <ImageField label="Squad photo" value={photo} onChange={setPhoto} hint="Team photo — also the Teams tile image." />
          <ImageField label="Hero image" value={heroImg} onChange={setHeroImg} hint="Wide image at the top of the squad page." />
        </FieldRow>
      </FormSection>

      <FormSection title="Introduction">
        <div className="space-y-2">
          {intro.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <Textarea rows={2} value={p} onChange={(e) => setPara(i, e.target.value)} placeholder="Intro paragraph" />
              <Button type="button" variant="outline" size="icon" onClick={() => removePara(i)} aria-label="Remove paragraph">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addPara}>
            <Plus className="mr-2 h-4 w-4" />Add paragraph
          </Button>
        </div>
      </FormSection>

      <FormSection title="Roster">
        <div className="space-y-2">
          {roster.length === 0 && (
            <p className="text-sm text-muted-foreground">No players yet — add the squad list below.</p>
          )}
          {roster.map((pl, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-xs font-medium text-muted-foreground">{i + 1}</span>
              <Input className="flex-1" value={pl.name} onChange={(e) => setPlayer(i, { name: e.target.value })} placeholder="Player name" />
              <Input className="w-28 shrink-0" value={pl.pos} onChange={(e) => setPlayer(i, { pos: e.target.value })} placeholder="Position" />
              <Button type="button" variant="outline" size="icon" onClick={() => removePlayer(i)} aria-label="Remove player">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addPlayer}>
            <Plus className="mr-2 h-4 w-4" />Add player
          </Button>
        </div>
      </FormSection>

      <FormSection title="Visibility">
        <PublishControls published={published} onPublishedChange={setPublished} sortOrder={sortOrder} onSortOrderChange={setSortOrder} />
      </FormSection>
    </ContentDialog>
  )
}
