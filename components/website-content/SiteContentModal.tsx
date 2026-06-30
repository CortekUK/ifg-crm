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
import { useSaveSiteContent } from '@/lib/hooks/useWebsiteContent'
import { toast } from '@/lib/hooks/use-toast'
import type { SiteContentItem } from '@/lib/types/website-content'

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

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
    type: 'id_clinic', title: '', slug: '', summary: '', body: '', date_text: '',
    location: '', image: '', link_url: '', link_label: '', published: true, sort_order: 0,
  })
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    if (item) {
      setF({
        type: item.type, title: item.title, slug: item.slug, summary: item.summary ?? '',
        body: item.body ?? '', date_text: item.date_text ?? '', location: item.location ?? '',
        image: item.image ?? '', link_url: item.link_url ?? '', link_label: item.link_label ?? '',
        published: item.published, sort_order: item.sort_order,
      })
      setSlugTouched(true)
    } else {
      setF({ type: 'id_clinic', title: '', slug: '', summary: '', body: '', date_text: '', location: '', image: '', link_url: '', link_label: '', published: true, sort_order: 0 })
      setSlugTouched(false)
    }
  }, [open, item])

  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }))

  async function submit() {
    if (!f.title.trim() || !f.slug.trim() || !f.type.trim()) {
      toast({ title: 'Type, title and slug are required', variant: 'destructive' })
      return
    }
    try {
      await save.mutateAsync({
        ...(item ? { id: item.id } : {}),
        type: f.type.trim(), title: f.title.trim(), slug: f.slug.trim(),
        summary: f.summary || null, body: f.body || null, date_text: f.date_text || null,
        location: f.location || null, image: f.image || null,
        link_url: f.link_url || null, link_label: f.link_label || null,
        published: f.published, sort_order: Number(f.sort_order) || 0,
      })
      toast({ title: item ? 'Item updated' : 'Item created' })
      onClose()
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit content item' : 'New content item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Input value={f.type} onChange={(e) => set('type', slugify(e.target.value))} placeholder="id_clinic" />
              <p className="text-xs text-muted-foreground">Groups items into a section, e.g. <code>id_clinic</code>.</p>
            </div>
            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input value={f.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value) }} placeholder="london-id-clinic-july" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={f.title}
              onChange={(e) => { set('title', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)) }}
              placeholder="London ID Clinic"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Date (text)</Label><Input value={f.date_text} onChange={(e) => set('date_text', e.target.value)} placeholder="12 July 2026" /></div>
            <div className="space-y-2"><Label>Location</Label><Input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="London, UK" /></div>
          </div>
          <div className="space-y-2">
            <Label>Summary</Label>
            <Textarea value={f.summary} onChange={(e) => set('summary', e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Body / details</Label>
            <Textarea value={f.body} onChange={(e) => set('body', e.target.value)} rows={5} />
          </div>
          <ImageField label="Image" value={f.image} onChange={(v) => set('image', v)} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Button link (URL)</Label><Input value={f.link_url} onChange={(e) => set('link_url', e.target.value)} placeholder="/programmes/macclesfield/apply" /></div>
            <div className="space-y-2"><Label>Button label</Label><Input value={f.link_label} onChange={(e) => set('link_label', e.target.value)} placeholder="Register interest" /></div>
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
            {item ? 'Save changes' : 'Create item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
