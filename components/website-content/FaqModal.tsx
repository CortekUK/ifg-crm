'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HelpCircle } from 'lucide-react'
import { ContentDialog, Field, PublishControls } from './_form'
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
    <ContentDialog
      open={open}
      onClose={onClose}
      icon={HelpCircle}
      accent="emerald"
      title={item ? 'Edit FAQ' : 'New FAQ'}
      description="A question and answer on the website's FAQ page."
      onSubmit={submit}
      submitLabel={item ? 'Save changes' : 'Create FAQ'}
      saving={save.isPending}
    >
      <Field label="Question" required>
        <Input value={f.question} onChange={(e) => set('question', e.target.value)} placeholder="How do I apply?" />
      </Field>
      <Field label="Answer" required>
        <Textarea value={f.answer} onChange={(e) => set('answer', e.target.value)} rows={6} placeholder="Start by submitting an application…" />
      </Field>
      <PublishControls
        published={f.published}
        onPublishedChange={(v) => set('published', v)}
        sortOrder={f.sort_order}
        onSortOrderChange={(v) => set('sort_order', v)}
      />
    </ContentDialog>
  )
}
