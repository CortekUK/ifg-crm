'use client'

import { useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, X } from 'lucide-react'
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
      <Label>
        {label} <span className="text-xs text-muted-foreground">({value.length})</span>
      </Label>

      {value.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {value.map((url, i) => (
            <div key={`${url}-${i}`} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

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
        <Button type="button" variant="outline" onClick={addPasted} disabled={!pending.trim()}>
          Add
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {uploading ? 'Uploading…' : 'Upload images'}
      </Button>
    </div>
  )
}
