'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { ImageField } from './ImageField'
import { useSaveSiteContent } from '@/lib/hooks/useWebsiteContent'
import { toast } from '@/lib/hooks/use-toast'
import type { SiteContentItem } from '@/lib/types/website-content'

const GROUPS = ['Leadership', 'Recruiters', 'Physios', 'Coaches'] as const

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

// Staff & coaches live in website_site_content with type 'staff':
// title = name, summary = role, location = group, body = bio, image = photo.
export function StaffModal({
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
    group: 'Coaches', name: '', role: '', bio: '', image: '', published: true, sort_order: 0,
  })

  useEffect(() => {
    if (!open) return
    if (item) {
      setF({
        group: GROUPS.includes(item.location as (typeof GROUPS)[number]) ? (item.location as string) : 'Coaches',
        name: item.title,
        role: item.summary ?? '',
        bio: item.body ?? '',
        image: item.image ?? '',
        published: item.published,
        sort_order: item.sort_order,
      })
    } else {
      setF({ group: 'Coaches', name: '', role: '', bio: '', image: '', published: true, sort_order: 0 })
    }
  }, [open, item])

  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }))

  async function submit() {
    if (!f.name.trim() || !f.role.trim()) {
      toast({ title: 'Name and role are required', variant: 'destructive' })
      return
    }
    const slug = item?.slug || slugify(f.name) || `staff-${Date.now()}`
    try {
      await save.mutateAsync({
        ...(item ? { id: item.id } : {}),
        type: 'staff',
        title: f.name.trim(),
        slug,
        location: f.group,
        summary: f.role.trim(),
        body: f.bio.trim() || null,
        image: f.image || null,
        link_url: null,
        link_label: null,
        date_text: null,
        published: f.published,
        sort_order: Number(f.sort_order) || 0,
      })
      toast({ title: item ? 'Staff member updated' : 'Staff member added' })
      onClose()
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit staff member' : 'New staff member'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Group *</Label>
              <Select value={f.group} onValueChange={(v) => set('group', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort order</Label>
              <Input type="number" value={f.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Nathan Bibby" />
          </div>
          <div className="space-y-2">
            <Label>Role *</Label>
            <Input value={f.role} onChange={(e) => set('role', e.target.value)} placeholder="Head of International Recruitment & Head Coach" />
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea value={f.bio} onChange={(e) => set('bio', e.target.value)} rows={5} placeholder="A short professional biography (optional)." />
          </div>
          <ImageField label="Photo" value={f.image} onChange={(v) => set('image', v)} />
          <div className="flex items-center gap-2">
            <Switch checked={f.published} onCheckedChange={(v) => set('published', v)} />
            <Label className="!mt-0">Published</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {item ? 'Save changes' : 'Add staff member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
