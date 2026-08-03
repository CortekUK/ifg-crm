'use client'

import * as React from 'react'
import { Newspaper, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import { useSaveNews } from '@/lib/hooks/useWebsiteNews'
import type { WebsiteNews, WebsiteNewsInput, NewsBlock } from '@/lib/types/website-content'
import { ContentDialog, FormSection, Field, FieldRow, PublishControls } from './_form'
import { ImageField } from './ImageField'

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

const formatDate = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

const BLOCK_TYPES: { value: NewsBlock['type']; label: string }[] = [
  { value: 'p', label: 'Paragraph' },
  { value: 'h', label: 'Heading' },
  { value: 'quote', label: 'Quote' },
  { value: 'img', label: 'Image' },
  { value: 'duo', label: 'Two images' },
]

function emptyBlock(type: NewsBlock['type']): NewsBlock {
  if (type === 'img') return { type: 'img', src: '', caption: '' }
  if (type === 'duo') return { type: 'duo', src: '', src2: '', caption: '' }
  return { type, text: '' }
}

export function NewsModal({ open, item, onClose }: { open: boolean; item: WebsiteNews | null; onClose: () => void }) {
  const save = useSaveNews()

  const [title, setTitle] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [slugTouched, setSlugTouched] = React.useState(false)
  const [category, setCategory] = React.useState('Latest News')
  const [dateISO, setDateISO] = React.useState('')
  const [excerpt, setExcerpt] = React.useState('')
  const [img, setImg] = React.useState('')
  const [heroImg, setHeroImg] = React.useState('')
  const [lead, setLead] = React.useState('')
  const [body, setBody] = React.useState<NewsBlock[]>([])
  const [published, setPublished] = React.useState(true)
  const [sortOrder, setSortOrder] = React.useState('0')

  React.useEffect(() => {
    if (!open) return
    setTitle(item?.title ?? '')
    setSlug(item?.slug ?? '')
    setSlugTouched(!!item)
    setCategory(item?.category ?? 'Latest News')
    setDateISO(item?.published_at ? item.published_at.slice(0, 10) : '')
    setExcerpt(item?.excerpt ?? '')
    setImg(item?.img ?? '')
    setHeroImg(item?.hero_img ?? '')
    setLead(item?.lead ?? '')
    setBody(item?.body?.length ? item.body : [{ type: 'p', text: '' }])
    setPublished(item?.published ?? true)
    setSortOrder(String(item?.sort_order ?? 0))
  }, [open, item])

  // Auto-slug from title until the user edits the slug directly.
  React.useEffect(() => {
    if (!slugTouched) setSlug(slugify(title))
  }, [title, slugTouched])

  const setBlock = (i: number, patch: Partial<NewsBlock>) =>
    setBody((b) => b.map((blk, idx) => (idx === i ? ({ ...blk, ...patch } as NewsBlock) : blk)))
  const changeType = (i: number, type: NewsBlock['type']) =>
    setBody((b) => b.map((blk, idx) => (idx === i ? emptyBlock(type) : blk)))
  const addBlock = () => setBody((b) => [...b, { type: 'p', text: '' }])
  const removeBlock = (i: number) => setBody((b) => b.filter((_, idx) => idx !== i))
  const moveBlock = (i: number, dir: -1 | 1) =>
    setBody((b) => {
      const j = i + dir
      if (j < 0 || j >= b.length) return b
      const next = [...b]; [next[i], next[j]] = [next[j], next[i]]; return next
    })

  function cleanBody(): NewsBlock[] {
    return body.filter((b) => {
      if (b.type === 'img') return !!b.src.trim()
      if (b.type === 'duo') return !!b.src.trim() || !!b.src2.trim()
      return !!b.text.trim()
    })
  }

  async function submit() {
    const t = title.trim(); const s = slug.trim()
    if (!t || !s) {
      toast({ title: 'Missing details', description: 'A title and slug are required.', variant: 'destructive' })
      return
    }
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(s)) {
      toast({ title: 'Invalid slug', description: 'Use lowercase letters, numbers and hyphens.', variant: 'destructive' })
      return
    }
    const payload: WebsiteNewsInput = {
      ...(item ? { id: item.id } : {}),
      slug: s, category: category.trim() || 'Latest News', title: t,
      date_text: dateISO ? formatDate(dateISO) : null,
      published_at: dateISO ? new Date(dateISO + 'T00:00:00').toISOString() : new Date().toISOString(),
      excerpt: excerpt.trim() || null,
      img: img.trim() || null,
      hero_img: heroImg.trim() || null,
      lead: lead.trim() || null,
      body: cleanBody(),
      published,
      sort_order: Number(sortOrder) || 0,
    }
    try {
      await save.mutateAsync(payload)
      toast({ title: item ? 'Article updated' : 'Article published', description: 'Live on the website within about a minute.' })
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      toast({
        title: 'Save failed',
        description: /duplicate|unique/i.test(msg) ? `An article with slug "${s}" already exists.` : msg,
        variant: 'destructive',
      })
    }
  }

  return (
    <ContentDialog
      open={open} onClose={onClose} icon={Newspaper} accent="rose"
      title={item ? 'Edit article' : 'New article'}
      description="A Latest News article with its own detail page."
      onSubmit={submit} submitLabel={item ? 'Save article' : 'Publish article'} saving={save.isPending}
    >
      <FormSection title="Article">
        <Field label="Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A headline for the article" />
        </Field>
        <FieldRow>
          <Field label="Slug" required hint="Used in the URL: /news/your-slug">
            <Input value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true) }} placeholder="article-slug" />
          </Field>
          <Field label="Category" hint="Pill shown on the card.">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Latest News" />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Date">
            <Input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />
          </Field>
          <div />
        </FieldRow>
        <Field label="Excerpt" hint="Short summary for cards and search results.">
          <Textarea rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </Field>
      </FormSection>

      <FormSection title="Images">
        <FieldRow>
          <ImageField label="Card image" value={img} onChange={setImg} hint="Portrait image on the news list." />
          <ImageField label="Hero image" value={heroImg} onChange={setHeroImg} hint="Wide image on the article page." />
        </FieldRow>
      </FormSection>

      <FormSection title="Article body">
        <Field label="Lead" hint="Optional pull-quote near the top of the article.">
          <Textarea rows={2} value={lead} onChange={(e) => setLead(e.target.value)} />
        </Field>

        <div className="space-y-3">
          {body.map((b, i) => (
            <div key={i} className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <select
                  value={b.type}
                  onChange={(e) => changeType(i, e.target.value as NewsBlock['type'])}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {BLOCK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40" aria-label="Move up"><ChevronUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === body.length - 1} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40" aria-label="Move down"><ChevronDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => removeBlock(i)} className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40" aria-label="Remove block"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {(b.type === 'p' || b.type === 'h' || b.type === 'quote') && (
                <Textarea
                  rows={b.type === 'h' ? 1 : 3}
                  value={b.text}
                  onChange={(e) => setBlock(i, { text: e.target.value })}
                  placeholder={b.type === 'h' ? 'Section heading' : b.type === 'quote' ? 'Pull-quote' : 'Paragraph text'}
                  className={cn(b.type === 'h' && 'font-semibold')}
                />
              )}
              {b.type === 'img' && (
                <div className="space-y-2">
                  <ImageField label="Image" value={b.src} onChange={(v) => setBlock(i, { src: v })} />
                  <Input value={b.caption ?? ''} onChange={(e) => setBlock(i, { caption: e.target.value })} placeholder="Caption (optional)" />
                </div>
              )}
              {b.type === 'duo' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ImageField label="Left image" value={b.src} onChange={(v) => setBlock(i, { src: v })} />
                    <ImageField label="Right image" value={b.src2} onChange={(v) => setBlock(i, { src2: v })} />
                  </div>
                  <Input value={b.caption ?? ''} onChange={(e) => setBlock(i, { caption: e.target.value })} placeholder="Caption (optional)" />
                </div>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addBlock}>
            <Plus className="mr-2 h-4 w-4" />Add block
          </Button>
        </div>
      </FormSection>

      <FormSection title="Visibility">
        <PublishControls published={published} onPublishedChange={setPublished} sortOrder={sortOrder} onSortOrderChange={setSortOrder} />
      </FormSection>
    </ContentDialog>
  )
}
