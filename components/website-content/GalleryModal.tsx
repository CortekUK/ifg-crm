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
import { MultiImageField } from './MultiImageField'
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{category ? 'Edit gallery category' : 'New gallery category'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={f.title}
                onChange={(e) => {
                  set('title', e.target.value)
                  if (!slugTouched) set('slug', slugify(e.target.value))
                }}
                placeholder="Match Days"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input value={f.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value) }} placeholder="match-days" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Blurb</Label>
            <Textarea value={f.blurb} onChange={(e) => set('blurb', e.target.value)} rows={2} />
          </div>
          <ImageField label="Cover image (defaults to first image)" value={f.cover} onChange={(v) => set('cover', v)} />
          <MultiImageField label="Images" value={f.images} onChange={(v) => set('images', v)} />
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
            {category ? 'Save changes' : 'Create category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
