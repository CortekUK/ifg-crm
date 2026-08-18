'use client'

// Editors + canvas previews for the two globally-branded regions that were
// never blocks: the header strip and the unsubscribe/legal strip.
//
// The other three regions (sender signature, social row, partner logos) ARE
// block types, so the canvas reuses their existing block components rather
// than duplicating those editors here.

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import { uploadEmailImage } from '@/lib/templates/upload-image'
import type { BrandingHeader, BrandingLegal } from '@/lib/templates/branding-types'

/** Colour swatch + hex input, sized for the narrow canvas column. */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded border bg-white p-0.5 dark:border-slate-700"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 flex-1 font-mono text-[11px]"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- header

export function HeaderSectionEditor({
  header,
  onUpdate,
}: {
  header: BrandingHeader
  onUpdate: (patch: Partial<BrandingHeader>) => void
}) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadEmailImage(file)
      onUpdate({ logoUrl: url, mode: 'image' })
      toast({ title: 'Logo uploaded', description: 'Header logo updated.' })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant={header.mode === 'text' ? 'default' : 'outline'}
          className="h-7 text-xs"
          onClick={() => onUpdate({ mode: 'text' })}
        >
          Wordmark
        </Button>
        <Button
          size="sm"
          variant={header.mode === 'image' ? 'default' : 'outline'}
          className="h-7 text-xs"
          onClick={() => onUpdate({ mode: 'image' })}
        >
          Logo image
        </Button>
      </div>

      {header.mode === 'text' ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px]">Wordmark</Label>
            <Input
              value={header.text}
              onChange={(e) => onUpdate({ text: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Strapline</Label>
            <Input
              value={header.subtext}
              onChange={(e) => onUpdate({ subtext: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[11px]">Logo URL</Label>
            <Input
              value={header.logoUrl}
              onChange={(e) => onUpdate({ logoUrl: e.target.value })}
              placeholder="https://…"
              className="h-7 text-xs"
            />
          </div>
          <label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={uploading}
              onClick={(e) => {
                e.preventDefault()
                ;(e.currentTarget.previousElementSibling as HTMLInputElement)?.click()
              }}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
            </Button>
          </label>
          <div className="space-y-1">
            <Label className="text-[11px]">Width</Label>
            <Input
              type="number"
              min={40}
              max={560}
              value={header.logoWidth}
              onChange={(e) =>
                onUpdate({ logoWidth: parseInt(e.target.value, 10) || 160 })
              }
              className="h-7 w-20 text-xs"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <ColorField
          label="Background"
          value={header.bgColor}
          onChange={(v) => onUpdate({ bgColor: v })}
        />
        <ColorField
          label="Text"
          value={header.textColor}
          onChange={(v) => onUpdate({ textColor: v })}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Click-through URL (optional)</Label>
        <Input
          value={header.linkUrl}
          onChange={(e) => onUpdate({ linkUrl: e.target.value })}
          placeholder="https://theinternationalfootballgroup.com"
          className="h-7 text-xs"
        />
      </div>
    </div>
  )
}

export function HeaderPreview({ header }: { header: BrandingHeader }) {
  return (
    <div
      style={{ backgroundColor: header.bgColor }}
      className="px-5 py-5 text-center"
    >
      {header.mode === 'image' && header.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={header.logoUrl}
          alt={header.text || 'Logo'}
          style={{ width: header.logoWidth, maxWidth: '100%' }}
          className="mx-auto h-auto"
        />
      ) : (
        <span className="inline-flex items-center gap-2.5">
          <span style={{ color: header.textColor, fontSize: 24, fontWeight: 700 }}>
            {header.text}
          </span>
          {header.subtext && (
            <span style={{ color: header.textColor, fontSize: 16 }}>
              {header.subtext}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

// ----------------------------------------------------------------- legal

export function LegalSectionEditor({
  legal,
  onUpdate,
}: {
  legal: BrandingLegal
  onUpdate: (patch: Partial<BrandingLegal>) => void
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-[11px]">Company name</Label>
        <Input
          value={legal.companyName}
          onChange={(e) => onUpdate({ companyName: e.target.value })}
          className="h-7 text-xs"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Postal address</Label>
        <Input
          value={legal.addressLine}
          onChange={(e) => onUpdate({ addressLine: e.target.value })}
          className="h-7 text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          UK PECR and CAN-SPAM expect a real registered address, not just a city.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={legal.showUnsubscribe}
          onCheckedChange={(v) => onUpdate({ showUnsubscribe: v })}
        />
        <span className="text-[11px] text-muted-foreground">
          Show the unsubscribe link
        </span>
      </div>

      {legal.showUnsubscribe && (
        <div className="space-y-1">
          <Label className="text-[11px]">Unsubscribe link text</Label>
          <Input
            value={legal.unsubscribeLabel}
            onChange={(e) => onUpdate({ unsubscribeLabel: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <ColorField
          label="Background"
          value={legal.bgColor}
          onChange={(v) => onUpdate({ bgColor: v })}
        />
        <ColorField
          label="Text"
          value={legal.textColor}
          onChange={(v) => onUpdate({ textColor: v })}
        />
        <ColorField
          label="Link"
          value={legal.linkColor}
          onChange={(v) => onUpdate({ linkColor: v })}
        />
      </div>
    </div>
  )
}

export function LegalPreview({ legal }: { legal: BrandingLegal }) {
  return (
    <div
      style={{ backgroundColor: legal.bgColor, color: legal.textColor, fontSize: 12 }}
      className={cn('px-5 py-5 text-center')}
    >
      {legal.companyName && <p className="mb-2.5">{legal.companyName}</p>}
      {legal.addressLine && <p className="mb-2.5">{legal.addressLine}</p>}
      {legal.showUnsubscribe && (
        <span style={{ color: legal.linkColor }} className="underline">
          {legal.unsubscribeLabel || 'Unsubscribe'}
        </span>
      )}
    </div>
  )
}
