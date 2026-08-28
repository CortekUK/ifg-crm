'use client'

import * as React from 'react'
import { BookOpen, Loader2, ImageIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ContentDialog, Field, FieldRow, FormSection, PublishControls } from '@/components/website-content/_form'
import { PdfField } from '@/components/website-content/PdfField'
import { generateBrochurePageImages } from '@/lib/website-content/brochure-images'
import { useSaveBrochure, slugifyBrochure } from '@/lib/hooks/useWebsiteBrochures'
import { toast } from '@/lib/hooks/use-toast'
import { BROCHURE_PROGRAMS } from '@/lib/types/website-content'
import type { BrochureProgram, WebsiteBrochure } from '@/lib/types/website-content'

const PROGRAM_NONE = 'none'

type Draft = {
  title: string
  slug: string
  description: string
  pdf_url: string
  cover_image: string
  page_count: number | null
  page_images: string[]
  program: BrochureProgram | null
  published: boolean
  sort_order: string
}

function emptyDraft(): Draft {
  return {
    title: '',
    slug: '',
    description: '',
    pdf_url: '',
    cover_image: '',
    page_count: null,
    page_images: [],
    program: null,
    published: false,
    sort_order: '0',
  }
}

function fromBrochure(b: WebsiteBrochure): Draft {
  return {
    title: b.title ?? '',
    slug: b.slug ?? '',
    description: b.description ?? '',
    pdf_url: b.pdf_url ?? '',
    cover_image: b.cover_image ?? '',
    page_count: b.page_count,
    page_images: b.page_images ?? [],
    program: b.program,
    published: b.published,
    sort_order: String(b.sort_order ?? 0),
  }
}

export function BrochureModal({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing: WebsiteBrochure | null
}) {
  const save = useSaveBrochure()
  const [draft, setDraft] = React.useState<Draft>(emptyDraft)
  // Track whether the user has hand-edited the slug so we stop auto-syncing it.
  const [slugTouched, setSlugTouched] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)
  const [genProgress, setGenProgress] = React.useState<string | null>(null)

  // Re-seed the form each time the dialog opens or the target changes.
  React.useEffect(() => {
    if (!open) return
    setDraft(editing ? fromBrochure(editing) : emptyDraft())
    setSlugTouched(!!editing)
    setGenerating(false)
  }, [open, editing])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  function handleTitle(value: string) {
    setDraft((d) => ({
      ...d,
      title: value,
      slug: slugTouched ? d.slug : slugifyBrochure(value),
    }))
  }

  async function handleUploaded(file: File) {
    // Pre-render every page to a small image so the website loads images instead
    // of the whole PDF (much faster to open). The cover is the first page. This
    // runs once here in the admin's browser; visitors never render the PDF.
    setGenerating(true)
    setGenProgress(null)
    try {
      const { urls, pageCount } = await generateBrochurePageImages(file, setGenProgress)
      setDraft((d) => ({
        ...d,
        page_images: urls,
        cover_image: urls[0] ?? d.cover_image,
        page_count: pageCount,
      }))
      toast({ title: 'Brochure processed', description: `${pageCount} page${pageCount === 1 ? '' : 's'} ready for fast viewing.` })
    } catch (err) {
      toast({
        title: 'Could not process the PDF',
        description: err instanceof Error ? err.message : 'You can still save; the viewer will fall back to the PDF.',
        variant: 'destructive',
      })
    } finally {
      setGenerating(false)
      setGenProgress(null)
    }
  }

  async function handleSubmit() {
    const title = draft.title.trim()
    if (!title) {
      toast({ title: 'Title is required', variant: 'destructive' })
      return
    }
    if (draft.published && !draft.pdf_url) {
      toast({
        title: 'A PDF is required to publish',
        description: 'Upload a PDF or turn off Published.',
        variant: 'destructive',
      })
      return
    }

    const slug = (draft.slug.trim() || slugifyBrochure(title))
    const sortOrder = Number.parseInt(draft.sort_order, 10)

    try {
      await save.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        title,
        slug,
        description: draft.description.trim() || null,
        pdf_url: draft.pdf_url || null,
        cover_image: draft.cover_image || null,
        page_count: draft.page_count,
        page_images: draft.page_images,
        program: draft.program,
        published: draft.published,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      })
      toast({ title: editing ? 'Brochure updated' : 'Brochure created' })
      onClose()
    } catch (err) {
      toast({
        title: 'Could not save the brochure',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <ContentDialog
      open={open}
      onClose={onClose}
      icon={BookOpen}
      accent="violet"
      title={editing ? 'Edit brochure' : 'Add brochure'}
      description="Self-hosted flipbook with gated lead capture into the CRM."
      onSubmit={handleSubmit}
      submitLabel={editing ? 'Save changes' : 'Create brochure'}
      saving={save.isPending}
    >
      <FormSection title="Details">
        <Field label="Title" required htmlFor="brochure-title">
          <Input
            id="brochure-title"
            value={draft.title}
            onChange={(e) => handleTitle(e.target.value)}
            placeholder="e.g. Summer Residency 2026"
          />
        </Field>

        <Field
          label="Slug"
          htmlFor="brochure-slug"
          hint={<>Used in the public link <code className="rounded bg-muted px-1 py-0.5">/b/{draft.slug || 'slug'}</code></>}
        >
          <Input
            id="brochure-slug"
            value={draft.slug}
            onChange={(e) => {
              setSlugTouched(true)
              set('slug', slugifyBrochure(e.target.value))
            }}
            placeholder="summer-residency-2026"
          />
        </Field>

        <Field label="Description" htmlFor="brochure-desc">
          <Textarea
            id="brochure-desc"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder="Short summary shown alongside the brochure."
          />
        </Field>
      </FormSection>

      <FormSection title="PDF & cover">
        <PdfField
          label="Brochure PDF"
          value={draft.pdf_url}
          onChange={(url) => set('pdf_url', url)}
          onUploaded={handleUploaded}
          hint="Pages are pre-rendered for fast viewing; the cover + page count are automatic."
        />

        {(generating || draft.cover_image) && (
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
            <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
              {generating ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : draft.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.cover_image} alt="Cover preview" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">
                {generating ? 'Processing brochure…' : 'Ready for fast viewing'}
              </p>
              <p className="text-xs text-muted-foreground">
                {generating
                  ? genProgress ?? 'Rendering pages…'
                  : draft.page_count
                    ? `${draft.page_count} page${draft.page_count === 1 ? '' : 's'}${draft.page_images.length ? ' · fast images ready' : ''}`
                    : 'Auto-generated from the first page.'}
              </p>
            </div>
          </div>
        )}
      </FormSection>

      <FormSection title="Association & visibility">
        <FieldRow>
          <Field label="Programme" hint="Optional — routes captured leads to the matching programme.">
            <Select
              value={draft.program ?? PROGRAM_NONE}
              onValueChange={(v) => set('program', v === PROGRAM_NONE ? null : (v as BrochureProgram))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PROGRAM_NONE}>None</SelectItem>
                {BROCHURE_PROGRAMS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldRow>

        <PublishControls
          published={draft.published}
          onPublishedChange={(v) => set('published', v)}
          sortOrder={draft.sort_order}
          onSortOrderChange={(v) => set('sort_order', v)}
        />
        {draft.published && !draft.pdf_url && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            A PDF is required before a brochure can be published.
          </p>
        )}
      </FormSection>
    </ContentDialog>
  )
}
