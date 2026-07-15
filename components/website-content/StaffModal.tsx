'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users } from 'lucide-react'
import { ImageField } from './ImageField'
import { ContentDialog, Field, FieldRow, FormSection, PublishControls } from './_form'
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
    <ContentDialog
      open={open}
      onClose={onClose}
      icon={Users}
      accent="violet"
      title={item ? 'Edit staff member' : 'New staff member'}
      description="A person shown on the Coaches & Staff page."
      onSubmit={submit}
      submitLabel={item ? 'Save changes' : 'Add staff member'}
      saving={save.isPending}
    >
      <FormSection title="Person">
        <FieldRow>
          <Field label="Group" required>
            <Select value={f.group} onValueChange={(v) => set('group', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Name" required>
            <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Nathan Bibby" />
          </Field>
        </FieldRow>
        <Field label="Role" required>
          <Input value={f.role} onChange={(e) => set('role', e.target.value)} placeholder="Head of International Recruitment & Head Coach" />
        </Field>
        <Field label="Bio">
          <Textarea value={f.bio} onChange={(e) => set('bio', e.target.value)} rows={5} placeholder="A short professional biography (optional)." />
        </Field>
        <ImageField label="Photo" value={f.image} onChange={(v) => set('image', v)} />
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
