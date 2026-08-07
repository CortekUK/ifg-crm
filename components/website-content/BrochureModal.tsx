'use client'

import * as React from 'react'
import { BookOpen } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/hooks/use-toast'
import { useSaveBrochure } from '@/lib/hooks/useWebsiteBrochures'
import {
  BROCHURE_PROGRAMS,
  type BrochureProgram,
  type WebsiteBrochure,
  type WebsiteBrochureInput,
} from '@/lib/types/website-content'
import { ContentDialog, FormSection, Field, FieldRow, PublishControls } from './_form'
import { ImageField } from './ImageField'
import { PdfField } from './PdfField'

const DEFAULT_TITLE: Record<BrochureProgram, string> = {
  summer: 'Summer Residency Brochure',
  university: 'University Brochure',
  'gap-year': 'Gap Year Brochure',
}

export function BrochureModal({
  open,
  item,
  takenPrograms,
  onClose,
}: {
  open: boolean
  item: WebsiteBrochure | null
  takenPrograms: BrochureProgram[]
  onClose: () => void
}) {
  const save = useSaveBrochure()

  // Programmes available when adding: those without a brochure yet.
  const available = BROCHURE_PROGRAMS.filter((p) => !takenPrograms.includes(p.key))

  const [program, setProgram] = React.useState<BrochureProgram>('summer')
  const [title, setTitle] = React.useState('')
  const [titleTouched, setTitleTouched] = React.useState(false)
  const [description, setDescription] = React.useState('')
  const [pdfUrl, setPdfUrl] = React.useState('')
  const [coverImage, setCoverImage] = React.useState('')
  const [pageCount, setPageCount] = React.useState('')
  const [published, setPublished] = React.useState(true)
  const [sortOrder, setSortOrder] = React.useState('0')

  React.useEffect(() => {
    if (!open) return
    const initialProgram = item?.program ?? available[0]?.key ?? 'summer'
    setProgram(initialProgram)
    setTitle(item?.title ?? DEFAULT_TITLE[initialProgram])
    setTitleTouched(!!item)
    setDescription(item?.description ?? '')
    setPdfUrl(item?.pdf_url ?? '')
    setCoverImage(item?.cover_image ?? '')
    setPageCount(item?.page_count != null ? String(item.page_count) : '')
    setPublished(item?.published ?? true)
    setSortOrder(String(item?.sort_order ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  // Default the title from the programme until the user edits it (add mode only).
  React.useEffect(() => {
    if (!titleTouched) setTitle(DEFAULT_TITLE[program])
  }, [program, titleTouched])

  async function submit() {
    const t = title.trim()
    if (!t) {
      toast({ title: 'Missing title', description: 'A brochure title is required.', variant: 'destructive' })
      return
    }
    if (published && !pdfUrl.trim()) {
      toast({
        title: 'No PDF attached',
        description: 'Upload a PDF before publishing, or save as a draft.',
        variant: 'destructive',
      })
      return
    }
    const parsedPages = pageCount.trim() ? Math.max(0, parseInt(pageCount, 10) || 0) : null
    const payload: WebsiteBrochureInput = {
      ...(item ? { id: item.id } : {}),
      program,
      title: t,
      description: description.trim() || null,
      pdf_url: pdfUrl.trim() || null,
      cover_image: coverImage.trim() || null,
      page_count: parsedPages,
      published,
      sort_order: Number(sortOrder) || 0,
    }
    try {
      await save.mutateAsync(payload)
      toast({ title: item ? 'Brochure updated' : 'Brochure added', description: 'Live on the website within about a minute.' })
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      toast({
        title: 'Save failed',
        description: /duplicate|unique/i.test(msg) ? 'A brochure for this programme already exists.' : msg,
        variant: 'destructive',
      })
    }
  }

  return (
    <ContentDialog
      open={open} onClose={onClose} icon={BookOpen} accent="blue"
      title={item ? 'Edit brochure' : 'New brochure'}
      description="A downloadable brochure shown as a flipbook on the programme page."
      onSubmit={submit} submitLabel={item ? 'Save brochure' : 'Add brochure'} saving={save.isPending}
    >
      <FormSection title="Brochure">
        <FieldRow>
          <Field label="Programme" required hint={item ? 'Fixed once created.' : 'One brochure per programme.'}>
            <select
              value={program}
              disabled={!!item}
              onChange={(e) => setProgram(e.target.value as BrochureProgram)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {(item ? BROCHURE_PROGRAMS : available).map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Page count" hint="Optional — shown as a hint while the flipbook loads.">
            <Input type="number" min={0} value={pageCount} onChange={(e) => setPageCount(e.target.value)} placeholder="e.g. 24" />
          </Field>
        </FieldRow>
        <Field label="Title" required>
          <Input value={title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true) }} placeholder="Summer Residency Brochure" />
        </Field>
        <Field label="Description" hint="Short line shown under the title.">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Everything you need to know about the programme." />
        </Field>
      </FormSection>

      <FormSection title="Files">
        <PdfField label="Brochure PDF" value={pdfUrl} onChange={setPdfUrl} hint="Required to publish. Max 50MB." />
        <ImageField label="Cover image" value={coverImage} onChange={setCoverImage} hint="Optional — thumbnail on the programme page." />
      </FormSection>

      <FormSection title="Visibility">
        <PublishControls published={published} onPublishedChange={setPublished} sortOrder={sortOrder} onSortOrderChange={setSortOrder} />
      </FormSection>
    </ContentDialog>
  )
}
