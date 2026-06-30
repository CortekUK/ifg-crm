'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { ImageField } from './ImageField'
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{story ? 'Edit success story' : 'New success story'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Player name *</Label>
              <Input
                value={f.name}
                onChange={(e) => {
                  set('name', e.target.value)
                  if (!slugTouched) set('slug', slugify(e.target.value))
                }}
                placeholder="Carlos Dos Santos"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input value={f.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value) }} placeholder="carlos-dos-santos" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Tag</Label><Input value={f.tag} onChange={(e) => set('tag', e.target.value)} placeholder="Latest News" /></div>
            <div className="space-y-2"><Label>Year</Label><Input value={f.year} onChange={(e) => set('year', e.target.value)} placeholder="2024" /></div>
            <div className="space-y-2"><Label>Club</Label><Input value={f.club} onChange={(e) => set('club', e.target.value)} placeholder="Macclesfield FC" /></div>
          </div>
          <ImageField label="Card image" value={f.img} onChange={(v) => set('img', v)} />
          <ImageField label="Hero image (detail page)" value={f.hero_img} onChange={(v) => set('hero_img', v)} />
          <div className="space-y-2">
            <Label>Card summary <span className="text-xs text-muted-foreground">(one paragraph per blank line)</span></Label>
            <Textarea value={f.blurb} onChange={(e) => set('blurb', e.target.value)} rows={4} />
          </div>
          <div className="space-y-2">
            <Label>Full story <span className="text-xs text-muted-foreground">(one paragraph per blank line)</span></Label>
            <Textarea value={f.body} onChange={(e) => set('body', e.target.value)} rows={8} />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={f.published} onCheckedChange={(v) => set('published', v)} />
              <Label className="!mt-0">Published</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label className="!mt-0">Sort order</Label>
              <Input type="number" className="w-20" value={f.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {story ? 'Save changes' : 'Create story'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
