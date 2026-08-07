'use client'

import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, X, FileText, ExternalLink } from 'lucide-react'
import { uploadBrochurePdf } from '@/lib/website-content/upload'
import { toast } from '@/lib/hooks/use-toast'

/**
 * Single-PDF picker: uploads a file (→ Supabase Storage public URL) or accepts a
 * pasted URL. Mirrors ImageField but for the brochure PDF (no image preview —
 * shows a filename/open affordance instead).
 */
export function PdfField({
  label,
  hint,
  value,
  onChange,
  onUploaded,
}: {
  label: string
  hint?: string
  value: string
  onChange: (url: string) => void
  /** Fired with the original File right after a successful upload (e.g. to
   *  derive a cover image / page count from the PDF). */
  onUploaded?: (file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadBrochurePdf(file)
      onChange(url)
      onUploaded?.(file)
      toast({ title: 'PDF uploaded', description: 'Saved to storage. Remember to save the brochure.' })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative flex h-24 w-32 shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-border bg-muted text-muted-foreground">
            <FileText className="h-7 w-7 text-red-500" />
            <span className="text-[11px] font-medium">PDF attached</span>
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1 text-white transition-opacity hover:bg-black/80"
              aria-label="Remove PDF"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-32 shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/60 hover:text-foreground disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
            <span className="text-xs font-medium">{uploading ? 'Uploading…' : 'Add PDF'}</span>
          </button>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste a PDF URL, or upload below"
          />
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFile} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploading ? 'Uploading…' : 'Upload PDF'}
            </Button>
            {value && (
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
