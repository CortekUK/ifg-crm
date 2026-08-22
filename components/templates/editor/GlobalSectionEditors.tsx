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
import { Upload, Loader2, Plus, Trash2, AlertTriangle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import { uploadEmailImage } from '@/lib/templates/upload-image'
import type {
  BrandingHeader,
  BrandingHeaderLogo,
  BrandingLegal,
} from '@/lib/templates/branding-types'

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

/**
 * The marks that already exist in /public as transparent PNGs sized for
 * email. Offered as one-click adds because the most common way to get this
 * wrong is uploading a logo with a white background, which renders as a
 * visible box on the dark header.
 */
const READY_MADE_LOGOS: BrandingHeaderLogo[] = [
  { src: '/signatures/ifg-white.png', alt: 'The International Football Group', width: 170 },
  { src: '/signatures/macclesfield-fc-white.png', alt: 'Macclesfield FC', width: 60 },
]

export function HeaderSectionEditor({
  header,
  onUpdate,
}: {
  header: BrandingHeader
  onUpdate: (patch: Partial<BrandingHeader>) => void
}) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const logos = header.logos ?? []
  const showLogos = header.mode === 'logos' || header.mode === 'both'
  const showText = header.mode === 'text' || header.mode === 'both'

  const setLogos = (next: BrandingHeaderLogo[]) => onUpdate({ logos: next })
  const updateLogo = (idx: number, patch: Partial<BrandingHeaderLogo>) =>
    setLogos(logos.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  const removeLogo = (idx: number) => setLogos(logos.filter((_, i) => i !== idx))
  const addLogo = (logo?: BrandingHeaderLogo) =>
    setLogos([...logos, logo ?? { src: '', alt: '', width: 150 }])

  const handleUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingIdx(idx)
    try {
      const url = await uploadEmailImage(file)
      updateLogo(idx, { src: url })
      toast({ title: 'Logo uploaded', description: 'Header logo updated.' })
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(['text', 'logos', 'both'] as const).map((m) => (
          <Button
            key={m}
            size="sm"
            variant={header.mode === m ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => onUpdate({ mode: m })}
          >
            {m === 'text' ? 'Wordmark' : m === 'logos' ? 'Logos' : 'Logos + wordmark'}
          </Button>
        ))}
      </div>

      {showLogos && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-[11px] text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Logos need a <strong>transparent background</strong>. A logo saved
              with white behind it shows as a white square on the dark header.
            </span>
          </div>

          {logos.map((logo, i) => (
            <div
              key={i}
              className="space-y-1.5 rounded-md border p-2 dark:border-slate-700"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={logo.src}
                  placeholder="Logo URL, or upload →"
                  onChange={(e) => updateLogo(i, { src: e.target.value })}
                  className="h-7 flex-1 text-xs"
                  disabled={uploadingIdx === i}
                />
                <label>
                  <input
                    type="file"
                    accept="image/png,image/gif,image/webp"
                    className="hidden"
                    disabled={uploadingIdx !== null}
                    onChange={(e) => handleUpload(i, e)}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={uploadingIdx !== null}
                    title="Upload a transparent PNG"
                    onClick={(e) => {
                      e.preventDefault()
                      ;(e.currentTarget.previousElementSibling as HTMLInputElement)?.click()
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
              <div className="flex items-center gap-2">
                <Input
                  value={logo.alt}
                  placeholder="Alt text"
                  onChange={(e) => updateLogo(i, { alt: e.target.value })}
                  className="h-7 flex-1 text-xs"
                />
                <Label className="text-[11px] text-muted-foreground">Width</Label>
                <Input
                  type="number"
                  min={20}
                  max={520}
                  value={logo.width}
                  onChange={(e) =>
                    updateLogo(i, { width: parseInt(e.target.value, 10) || 150 })
                  }
                  className="h-7 w-16 text-xs"
                />
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addLogo()}>
              <Plus className="mr-1 h-3 w-3" />
              Add logo
            </Button>
            {READY_MADE_LOGOS.filter((r) => !logos.some((l) => l.src === r.src)).map((r) => (
              <Button
                key={r.src}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => addLogo(r)}
                title="Ready-made transparent version, sized for email"
              >
                <Sparkles className="mr-1 h-3 w-3" />
                {r.alt.replace('The International Football Group', 'IFG')}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-[11px]">Gap between logos</Label>
            <Input
              type="number"
              min={0}
              max={80}
              value={header.logoGap ?? 24}
              onChange={(e) => onUpdate({ logoGap: parseInt(e.target.value, 10) || 0 })}
              className="h-7 w-16 text-xs"
            />
            <span className="text-[11px] text-muted-foreground">px</span>
          </div>
        </div>
      )}

      {showText && (
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
  const logos = (header.logos ?? []).filter((l) => l.src)
  const gap = Math.round((header.logoGap ?? 24) / 2)
  const showLogos = (header.mode === 'logos' || header.mode === 'both') && logos.length > 0
  const showText = header.mode === 'text' || header.mode === 'both' || !showLogos

  return (
    <div style={{ backgroundColor: header.bgColor }} className="px-5 py-5 text-center">
      {showLogos && (
        <div style={{ lineHeight: 0 }}>
          {logos.map((l, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={l.src}
              alt={l.alt || ''}
              style={{
                display: 'inline-block',
                width: l.width,
                maxWidth: '100%',
                height: 'auto',
                margin: `0 ${gap}px`,
                verticalAlign: 'middle',
              }}
            />
          ))}
        </div>
      )}
      {showLogos && showText && <div style={{ height: 14 }} />}
      {showText && (
        <span className="inline-flex items-center gap-2.5">
          <span style={{ color: header.textColor, fontSize: 24, fontWeight: 700 }}>
            {header.text}
          </span>
          {header.subtext && (
            <span style={{ color: header.textColor, fontSize: 16 }}>{header.subtext}</span>
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
