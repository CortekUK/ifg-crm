'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { useSaveSiteContent } from '@/lib/hooks/useWebsiteContent'
import { toast } from '@/lib/hooks/use-toast'
import type { SiteContentItem } from '@/lib/types/website-content'

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

// FAQs are stored in website_site_content with type 'faq': title = question,
// body = answer. This modal is a focused Q&A editor over that generic table.
export function FaqModal({
  open,
  onClose,
  item,
}: {
  open: boolean
  onClose: () => void
  item: SiteContentItem | null
}) {
  const save = useSaveSiteContent()
  const [f, setF] = useState({ question: '', answer: '', published: true, sort_order: 0 })

  useEffect(() => {
    if (!open) return
    if (item) {
      setF({
        question: item.title,
        answer: item.body ?? '',
        published: item.published,
        sort_order: item.sort_order,
      })
    } else {
      setF({ question: '', answer: '', published: true, sort_order: 0 })
    }
  }, [open, item])

  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }))

  async function submit() {
    if (!f.question.trim() || !f.answer.trim()) {
      toast({ title: 'Question and answer are required', variant: 'destructive' })
      return
    }
    // Keep an existing slug; generate one from the question for new FAQs.
    const slug = item?.slug || slugify(f.question) || `faq-${Date.now()}`
    try {
      await save.mutateAsync({
        ...(item ? { id: item.id } : {}),
        type: 'faq',
        title: f.question.trim(),
        slug,
        body: f.answer.trim(),
        summary: null,
        date_text: null,
        location: null,
        image: null,
        link_url: null,
        link_label: null,
        published: f.published,
        sort_order: Number(f.sort_order) || 0,
      })
      toast({ title: item ? 'FAQ updated' : 'FAQ created' })
      onClose()
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit FAQ' : 'New FAQ'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Question *</Label>
            <Input value={f.question} onChange={(e) => set('question', e.target.value)} placeholder="How do I apply?" />
          </div>
          <div className="space-y-2">
            <Label>Answer *</Label>
            <Textarea value={f.answer} onChange={(e) => set('answer', e.target.value)} rows={6} placeholder="Start by submitting an application…" />
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
            {item ? 'Save changes' : 'Create FAQ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
