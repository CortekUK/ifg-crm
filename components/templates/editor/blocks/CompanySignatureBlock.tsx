'use client'

// Static "company / brand" footer block — partner logos plus the legal
// confidentiality paragraph. Pairs with the Sender Details (recruiter
// signature) block: that one carries the per-deal-owner info, this one
// carries the bits that don't change between recruiters.

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { AlignLeft, AlignCenter, AlignRight, Building2, Plus, Trash2, Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadEmailImage } from '@/lib/templates/upload-image'
import { toast } from '@/lib/hooks/use-toast'
import type { CompanySignatureBlockContent } from '@/lib/templates/editor-types'

interface CompanySignatureBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

// Render the disclaimer string with simple **bold** handling. We keep
// the markup deliberately small — it covers the existing IFG footer
// without reaching for a full markdown lib.
function renderDisclaimerHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

export function CompanySignatureBlock({ content, isSelected, onUpdate }: CompanySignatureBlockProps) {
  const c = content as unknown as CompanySignatureBlockContent
  const logos = Array.isArray(c.logos) ? c.logos : []
  // Index of the logo currently uploading, or null. Used to disable inputs
  // and show a spinner on the row being replaced.
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)

  const updateLogo = (idx: number, patch: Partial<{ src: string; alt: string; href: string }>) => {
    const next = [...logos]
    next[idx] = { ...next[idx], ...patch }
    onUpdate({ logos: next })
  }
  const addLogo = () => onUpdate({ logos: [...logos, { src: '', alt: '' }] })
  const removeLogo = (idx: number) =>
    onUpdate({ logos: logos.filter((_, i) => i !== idx) })

  const handleLogoUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so re-selecting the same file fires onChange
    if (!file) return

    setUploadingIdx(idx)
    try {
      const url = await uploadEmailImage(file)
      updateLogo(idx, { src: url })
      toast({ title: 'Logo uploaded', description: 'The logo image has been updated.' })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUploadingIdx(null)
    }
  }

  return (
    <div
      style={{
        paddingTop: `${c.paddingTop ?? 24}px`,
        paddingBottom: `${c.paddingBottom ?? 16}px`,
      }}
    >
      {/* Settings panel */}
      {isSelected && (
        <div className="mb-3 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Company Signature Settings
            </span>
          </div>

          <p className="text-xs text-blue-600 dark:text-blue-400">
            Static footer — partner logos + legal disclaimer. Per-recruiter
            details live in the separate Sender Details block.
          </p>

          {/* Logos editor */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Logos</Label>
            {logos.map((logo, i) => (
              <div key={i} className="space-y-1.5 rounded-md border border-blue-200 bg-white p-2 dark:border-blue-800 dark:bg-slate-800/40">
                <div className="flex items-center gap-2">
                  <Input
                    value={logo.src}
                    placeholder="Logo URL (https://…) or upload →"
                    onChange={(e) => updateLogo(i, { src: e.target.value })}
                    className="h-7 flex-1 text-xs"
                    disabled={uploadingIdx === i}
                  />
                  <label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      className="hidden"
                      disabled={uploadingIdx !== null}
                      onChange={(e) => handleLogoUpload(i, e)}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={uploadingIdx !== null}
                      title={logo.src ? 'Replace logo' : 'Upload logo'}
                      onClick={(e) => {
                        e.preventDefault()
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement
                        input?.click()
                      }}
                    >
                      {uploadingIdx === i ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-500 hover:text-red-600"
                    onClick={() => removeLogo(i)}
                    title="Remove logo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  value={logo.alt}
                  placeholder="Alt text (e.g. UCLan logo)"
                  onChange={(e) => updateLogo(i, { alt: e.target.value })}
                  className="h-7 w-full text-xs"
                />
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/40"
              onClick={addLogo}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add logo
            </Button>
          </div>

          {/* Logo size + alignment */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Logo width:</Label>
              <Input
                type="number"
                min={40}
                max={300}
                value={c.logoWidth ?? 120}
                onChange={(e) => onUpdate({ logoWidth: parseInt(e.target.value, 10) || 120 })}
                className="h-7 w-20 text-xs"
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>

            <div className="flex items-center gap-1">
              <Label className="text-xs mr-1">Align:</Label>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', c.alignment === 'left' && 'bg-blue-200 dark:bg-blue-800')}
                onClick={() => onUpdate({ alignment: 'left' })}
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', c.alignment === 'center' && 'bg-blue-200 dark:bg-blue-800')}
                onClick={() => onUpdate({ alignment: 'center' })}
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', c.alignment === 'right' && 'bg-blue-200 dark:bg-blue-800')}
                onClick={() => onUpdate({ alignment: 'right' })}
              >
                <AlignRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Disclaimer textarea */}
          <div>
            <Label className="text-xs">Disclaimer (use **bold** for emphasis)</Label>
            <Textarea
              value={c.disclaimer || ''}
              onChange={(e) => onUpdate({ disclaimer: e.target.value })}
              className="mt-1 min-h-[120px] text-xs leading-relaxed"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Label className="text-xs">Text colour:</Label>
            <input
              type="color"
              value={c.textColor || '#475569'}
              onChange={(e) => onUpdate({ textColor: e.target.value })}
              className="h-6 w-8 cursor-pointer rounded border border-blue-200 bg-white p-0 dark:border-blue-800"
            />
            {c.textColor && (
              <button
                type="button"
                onClick={() => onUpdate({ textColor: null })}
                className="text-[10px] text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Preview */}
      <div style={{ textAlign: c.alignment ?? 'center' }}>
        {logos.length > 0 && (
          <div
            style={{
              display: 'block',
              marginBottom: 16,
            }}
          >
            {logos
              .filter((l) => l.src)
              .map((logo, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={logo.src}
                  alt={logo.alt || ''}
                  style={{
                    display: 'inline-block',
                    width: `${c.logoWidth ?? 120}px`,
                    height: 'auto',
                    margin: '0 16px',
                    verticalAlign: 'middle',
                  }}
                />
              ))}
          </div>
        )}

        <p
          className="text-[12px] italic leading-relaxed"
          style={{
            color: c.textColor || '#475569',
            margin: 0,
          }}
          dangerouslySetInnerHTML={{
            __html: renderDisclaimerHtml(c.disclaimer || ''),
          }}
        />
      </div>
    </div>
  )
}
