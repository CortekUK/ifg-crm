'use client'

// Manage shared links — a link that lives in one place and is used by many
// buttons across many templates.
//
// The problem this solves: the registration-form buttons each held a pasted
// URL, so six buttons across six templates carried two links, and changing
// where they point meant editing all six by hand. Buttons now reference a
// shared link by merge tag, so changing it here updates every button that
// uses it, in every template, including ones created later.
//
// Saving writes the whole branding record, so this is deliberately an
// explicit Save rather than an auto-save — it changes what recipients get.

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Plus, Trash2, Upload, Link2, FileText } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'
import { useEmailBranding } from '@/lib/hooks/useEmailBranding'
import { uploadEmailFile, ACCEPTED_DOC_EXTENSIONS } from '@/lib/templates/upload-file'
import type { BrandingLink } from '@/lib/templates/branding-types'

/**
 * Merge-tag key derived from the label. Generated once, on creation, and
 * never regenerated: templates reference the key, so renaming a link must
 * not silently break every button pointing at it.
 */
function keyFromLabel(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `${base || 'shared_link'}_url`
}

export function SharedLinksDialog({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when a link is picked for the button being edited. */
  onInsert?: (link: BrandingLink) => void
}) {
  const { data, isLoading, save, isSaving } = useEmailBranding()
  const [draft, setDraft] = useState<BrandingLink[] | null>(null)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)

  const links = draft ?? data?.config.links ?? []
  const dirty = draft !== null

  const update = (idx: number, patch: Partial<BrandingLink>) =>
    setDraft(links.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const add = () =>
    setDraft([
      ...links,
      { key: `shared_link_${Date.now()}_url`, label: '', url: '' },
    ])

  const remove = (idx: number) => setDraft(links.filter((_, i) => i !== idx))

  const handleUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingKey(links[idx].key)
    try {
      const uploaded = await uploadEmailFile(file)
      update(idx, {
        url: uploaded.url,
        fileName: uploaded.name,
        label: links[idx].label || uploaded.name.replace(/\.[^.]+$/, ''),
      })
      toast({
        title: 'File uploaded',
        description: 'Save to point every button using this link at the new file.',
      })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUploadingKey(null)
    }
  }

  const handleSave = async () => {
    if (!data?.config) return
    // Give any link still on a generated placeholder key a readable one
    // before it is committed and templates start referencing it.
    const cleaned = links
      .filter((l) => l.label.trim() || l.url.trim())
      .map((l) =>
        l.key.startsWith('shared_link_') && l.label.trim()
          ? { ...l, key: keyFromLabel(l.label) }
          : l,
      )

    try {
      await save({ ...data.config, links: cleaned })
      setDraft(null)
      toast({
        title: 'Shared links saved',
        description: 'Every button using them now points at the new destination.',
      })
    } catch (err) {
      toast({
        title: 'Failed to save',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Shared links</DialogTitle>
          <DialogDescription>
            A link set in one place and used by buttons across every template.
            Change it here and every button using it follows — including
            templates you build later.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {links.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No shared links yet.
              </p>
            )}

            {links.map((link, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Input
                    value={link.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    placeholder="Name, e.g. Academy Registration Form"
                    className="h-8 flex-1 text-sm font-medium"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-red-600"
                    onClick={() => remove(i)}
                    title="Delete shared link"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    value={link.url}
                    onChange={(e) => update(i, { url: e.target.value, fileName: undefined })}
                    placeholder="https://… or upload a file →"
                    className="h-8 flex-1 text-xs"
                    disabled={uploadingKey === link.key}
                  />
                  <label>
                    <input
                      type="file"
                      accept={ACCEPTED_DOC_EXTENSIONS}
                      className="hidden"
                      disabled={uploadingKey !== null}
                      onChange={(e) => handleUpload(i, e)}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={uploadingKey !== null}
                      title="Upload a PDF or document"
                      onClick={(e) => {
                        e.preventDefault()
                        ;(e.currentTarget.previousElementSibling as HTMLInputElement)?.click()
                      }}
                    >
                      {uploadingKey === link.key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {link.fileName ? (
                      <>
                        <FileText className="h-3 w-3" />
                        {link.fileName}
                      </>
                    ) : (
                      <>
                        <Link2 className="h-3 w-3" />
                        Web page
                      </>
                    )}
                  </span>
                  {onInsert && link.url && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        onInsert(link)
                        onOpenChange(false)
                      }}
                    >
                      Use for this button
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={add}>
              <Plus className="mr-1 h-3 w-3" />
              Add a shared link
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={!dirty || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {dirty ? 'Save shared links' : 'Saved'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
