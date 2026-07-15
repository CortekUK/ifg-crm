'use client'

import { useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, X, ImagePlus } from 'lucide-react'
import { uploadWebsiteImage } from '@/lib/website-content/upload'
import { toast } from '@/lib/hooks/use-toast'

/**
 * Ordered list of images for a gallery category. Upload one or many files, or
 * paste a URL / existing /public path to add. Remove individually.
 */
export function MultiImageField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string[]
  onChange: (urls: string[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, setPending] = useState('')

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const f of files) {
        urls.push(await uploadWebsiteImage(f))
      }
      onChange([...value, ...urls])
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

  function addPasted() {
    const url = pending.trim()
    if (!url) return
    onChange([...value, url])
    setPending('')
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm font-medium">
        {label}
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{value.length}</span>
      </Label>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {value.map((url, i) => (
          <div key={`${url}-${i}`} className="group/thumb relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover/thumb:opacity-100"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/60 hover:text-foreground disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          <span className="text-[10px] font-medium">{uploading ? '…' : 'Add'}</span>
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      <div className="flex gap-2">
        <Input
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addPasted()
            }
          }}
          placeholder="Paste an image URL or /public path, then Enter"
        />
        <Button type="button" variant="outline" onClick={addPasted} disabled={!pending.trim()}>Add</Button>
        <Button type="button" variant="outline" size="icon" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Upload images">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
