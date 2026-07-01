'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { ImageField } from './ImageField'
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit course' : 'New course'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>School *</Label>
              <Select value={f.school} onValueChange={(v) => set('school', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCHOOLS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <Input value={f.level} onChange={(e) => set('level', e.target.value)} placeholder="Bachelor's · 3 Years" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Course name *</Label>
            <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="BSc (Hons) Football Studies" />
          </div>
          <div className="space-y-2">
            <Label>UCLan course link *</Label>
            <Input value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://www.uclan.ac.uk/courses/..." />
            <p className="text-xs text-muted-foreground">The visitor&apos;s details are captured before they&apos;re taken to this page.</p>
          </div>
          <ImageField label="Tile image" value={f.image} onChange={(v) => set('image', v)} />
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
            {item ? 'Save changes' : 'Create course'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
