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
import { PdfField } from './PdfField'
import { renderPdfFirstPage } from '@/lib/website-content/pdf'
import { uploadWebsiteImage } from '@/lib/website-content/upload'
import { Loader2 } from 'lucide-react'

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
  const [coverBusy, setCoverBusy] = React.useState(false)

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
    setCoverBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  // When a PDF is uploaded, derive the cover from its first page and the page
  // count automatically — no separate cover upload needed.
  async function handlePdfUploaded(file: File) {
    setCoverBusy(true)
    try {
      const { blob, pageCount: pages } = await renderPdfFirstPage(file)
      const coverFile = new File([blob], 'brochure-cover.jpg', { type: 'image/jpeg' })
      const url = await uploadWebsiteImage(coverFile)
      setCoverImage(url)
      setPageCount(String(pages))
    } catch (e) {
      toast({
        title: 'Could not generate the cover',
        description: e instanceof Error ? e.message : 'The PDF was uploaded, but the cover image could not be created.',
        variant: 'destructive',
      })
    } finally {
      setCoverBusy(false)
    }
  }

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
        <PdfField
          label="Brochure PDF"
          value={pdfUrl}
          onChange={setPdfUrl}
          onUploaded={handlePdfUploaded}
          hint="Required to publish. Max 200MB. The cover is taken from the first page automatically."
        />
        {coverBusy ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating cover from the first page…
          </div>
        ) : coverImage ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImage} alt="" className="h-24 w-auto rounded-md border border-border object-cover" />
            <span className="text-xs text-muted-foreground">Cover — taken from the first page of the PDF.</span>
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Visibility">
        <PublishControls published={published} onPublishedChange={setPublished} sortOrder={sortOrder} onSortOrderChange={setSortOrder} />
      </FormSection>
    </ContentDialog>
  )
}
