'use client'

// Editors + canvas previews for the two globally-branded regions that were
// never blocks: the header strip and the unsubscribe/legal strip.
//
// The other three regions (sender signature, social row, partner logos) ARE
// block types, so the canvas reuses their existing block components rather
// than duplicating those editors here.

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, Plus, Trash2, AlertTriangle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import { uploadEmailImage } from '@/lib/templates/upload-image'
import { renderHeaderHtml } from '@/lib/templates/render-branding'
import type { TemplateTheme, ThemeFont } from '@/lib/templates/editor-types'
import {
  PALETTES,
  contrastRatio,
  contrastVerdict,
  matchPalette,
  type Palette,
} from '@/lib/templates/palettes'
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

type Arrangement = BrandingHeader['arrangement']

/**
 * Little visual of each arrangement. A worded list ("logos-left") tells you
 * nothing at a glance; a picture of where the logo and the text end up is
 * self-explanatory, which is the whole point of this control.
 */
function ArrangementGlyph({ value }: { value: Arrangement }) {
  const logo = <span className="block h-1.5 w-5 rounded-sm bg-current opacity-90" />
  const text = <span className="block text-[7px] font-bold leading-none">Aa</span>
  const stacked = value === 'logos-top' || value === 'text-top'
  const logoFirst = value === 'logos-top' || value === 'logos-left'

  return (
    <span
      className={cn(
        'flex items-center justify-center gap-1',
        stacked ? 'flex-col' : 'flex-row',
      )}
    >
      {logoFirst ? logo : text}
      {logoFirst ? text : logo}
    </span>
  )
}

const ARRANGEMENTS: { value: Arrangement; label: string }[] = [
  { value: 'logos-top', label: 'Logo on top' },
  { value: 'text-top', label: 'Text on top' },
  { value: 'logos-left', label: 'Logo left' },
  { value: 'text-left', label: 'Text left' },
]

function ArrangementPicker({
  value,
  onChange,
}: {
  value: Arrangement
  onChange: (next: Arrangement) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px]">Arrangement</Label>
      <div className="grid grid-cols-4 gap-1.5">
        {ARRANGEMENTS.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => onChange(a.value)}
            title={a.label}
            className={cn(
              'flex flex-col items-center gap-1 rounded-md border px-1.5 py-2 text-[9px] transition-colors',
              value === a.value
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400',
            )}
          >
            <ArrangementGlyph value={a.value} />
            <span className="leading-tight">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Photography already in the CRM's public folder, offered as a starting point. */
const SUGGESTED_HERO_IMAGES = [
  { src: '/landing/photos/stadium.jpeg', label: 'Stadium' },
  { src: '/landing/photos/hero.jpg', label: 'Hero' },
]

/** The three header treatments, with a miniature of each. */
const STYLE_OPTIONS: {
  value: NonNullable<BrandingHeader['style']>
  label: string
  hint: string
  glyph: React.ReactNode
}[] = [
  {
    value: 'plain',
    label: 'Plain',
    hint: 'Flat band',
    glyph: (
      <span className="block h-6 w-full rounded-sm bg-slate-800">
        <span className="block h-full w-full rounded-sm border border-slate-700" />
      </span>
    ),
  },
  {
    value: 'refined',
    label: 'Refined',
    hint: 'Rule + accent',
    glyph: (
      <span className="block w-full overflow-hidden rounded-sm">
        <span className="flex h-5 w-full items-center justify-center bg-slate-800">
          <span className="h-px w-4 bg-white/40" />
        </span>
        <span className="block h-1 w-full bg-red-600" />
      </span>
    ),
  },
  {
    value: 'hero',
    label: 'Hero',
    hint: 'Photo behind',
    glyph: (
      <span className="block w-full overflow-hidden rounded-sm">
        <span className="flex h-5 w-full items-center justify-center bg-gradient-to-br from-slate-600 to-slate-900">
          <span className="h-px w-4 bg-white/50" />
        </span>
        <span className="block h-1 w-full bg-red-600" />
      </span>
    ),
  },
]

export function HeaderSectionEditor({
  header,
  onUpdate,
}: {
  header: BrandingHeader
  onUpdate: (patch: Partial<BrandingHeader>) => void
}) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const [uploadingHero, setUploadingHero] = useState(false)
  const logos = header.logos ?? []
  const showLogos = header.mode === 'logos' || header.mode === 'both'
  const showText = header.mode === 'text' || header.mode === 'both'

  const setLogos = (next: BrandingHeaderLogo[]) => onUpdate({ logos: next })
  const updateLogo = (idx: number, patch: Partial<BrandingHeaderLogo>) =>
    setLogos(logos.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  const removeLogo = (idx: number) => setLogos(logos.filter((_, i) => i !== idx))
  const addLogo = (logo?: BrandingHeaderLogo) =>
    setLogos([...logos, logo ?? { src: '', alt: '', width: 150 }])

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingHero(true)
    try {
      onUpdate({ bgImageUrl: await uploadEmailImage(file) })
      toast({ title: 'Background uploaded', description: 'Header photograph updated.' })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUploadingHero(false)
    }
  }

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

  const style = header.style ?? 'plain'

  return (
    <div className="space-y-3">
      {/* Treatment first: it frames everything below it. */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Style
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdate({ style: opt.value })}
              className={cn(
                'rounded-md border p-2 text-left transition-colors',
                style === opt.value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
              )}
            >
              {opt.glyph}
              <span className="mt-1 block text-[11px] font-medium">{opt.label}</span>
              <span className="block text-[10px] leading-tight text-muted-foreground">
                {opt.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      {style !== 'plain' && (
        <div className="space-y-2 rounded-md border border-slate-200 p-2 dark:border-slate-700">
          <div className="space-y-1">
            <Label className="text-[11px]">Strapline</Label>
            <Input
              value={header.tagline ?? ''}
              onChange={(e) => onUpdate({ tagline: e.target.value })}
              placeholder="MACCLESFIELD · ENGLAND"
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Small uppercase line under the logos. Leave blank to hide it.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-[11px]">Accent bar</Label>
            <input
              type="color"
              value={header.accentColor ?? '#BE1623'}
              onChange={(e) => onUpdate({ accentColor: e.target.value })}
              className="h-6 w-10 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
            />
            <span className="text-[10px] text-muted-foreground">
              The 3px rule closing the header.
            </span>
          </div>

          {style === 'hero' && (
            <div className="space-y-1.5">
              <Label className="text-[11px]">Background photograph</Label>
              <div className="flex gap-1.5">
                <Input
                  value={header.bgImageUrl ?? ''}
                  onChange={(e) => onUpdate({ bgImageUrl: e.target.value })}
                  placeholder="Upload one, or pick a suggestion below"
                  className="h-7 flex-1 text-xs"
                />
                <label className="inline-flex">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleHeroUpload}
                    disabled={uploadingHero}
                  />
                  <span
                    className={cn(
                      'inline-flex h-7 cursor-pointer items-center rounded-md border border-slate-300 px-2 text-xs',
                      uploadingHero && 'pointer-events-none opacity-60',
                    )}
                  >
                    {uploadingHero ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                  </span>
                </label>
                {header.bgImageUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => onUpdate({ bgImageUrl: '' })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {SUGGESTED_HERO_IMAGES.map((img) => (
                  <button
                    key={img.src}
                    type="button"
                    onClick={() => onUpdate({ bgImageUrl: img.src })}
                    className={cn(
                      'overflow-hidden rounded border-2 transition-colors',
                      header.bgImageUrl === img.src
                        ? 'border-indigo-500'
                        : 'border-transparent hover:border-slate-300',
                    )}
                    title={img.label}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.src} alt={img.label} className="h-9 w-16 object-cover" />
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-slate-500">
                Use a dark image. Outlook can&apos;t dim a background photo, so a bright
                one will swallow the white logos there.
              </p>
            </div>
          )}
        </div>
      )}

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

      {header.mode === 'both' && logos.length > 0 && (
        <ArrangementPicker
          value={header.arrangement ?? 'logos-top'}
          onChange={(v) => onUpdate({ arrangement: v })}
        />
      )}

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
  // Renders the real thing. This used to be a parallel React implementation of
  // the header, which meant every renderer feature had to be built twice — and
  // when it wasn't, the editor showed a style you had not chosen.
  const html = useMemo(() => renderHeaderHtml(header), [header])
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

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

// ── Brand & type ─────────────────────────────────────────────────────────────

const FONT_CHOICES: { value: ThemeFont; label: string; sample: string; note: string }[] = [
  { value: 'system', label: 'System', sample: 'Aa', note: 'Neutral, loads everywhere' },
  { value: 'modern', label: 'Modern', sample: 'Aa', note: 'Inter — clean, contemporary' },
  { value: 'classic', label: 'Classic', sample: 'Aa', note: 'Georgia — warm, established' },
  { value: 'editorial', label: 'Editorial', sample: 'Aa', note: 'Playfair — magazine feel' },
  { value: 'condensed', label: 'Condensed', sample: 'Aa', note: 'Oswald — sporting, bold' },
  { value: 'mono', label: 'Mono', sample: 'Aa', note: 'Space Mono — technical, modern' },
]

const PREVIEW_STACK: Record<ThemeFont, string> = {
  system: 'system-ui, sans-serif',
  modern: 'Inter, Helvetica, Arial, sans-serif',
  classic: 'Georgia, serif',
  editorial: '"Playfair Display", Georgia, serif',
  condensed: 'Oswald, "Arial Narrow", sans-serif',
  mono: '"Space Mono", "Courier New", monospace',
}

function FontRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: ThemeFont
  onChange: (v: ThemeFont) => void
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <div className="grid grid-cols-5 gap-1">
        {FONT_CHOICES.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onChange(f.value)}
            title={f.note}
            className={cn(
              'rounded-md border px-1 py-1.5 text-center transition-colors',
              value === f.value
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 hover:bg-slate-50',
            )}
          >
            <span
              className="block text-base leading-none text-slate-900"
              style={{ fontFamily: PREVIEW_STACK[f.value] }}
            >
              {f.sample}
            </span>
            <span className="mt-1 block text-[9px] leading-tight text-slate-500">
              {f.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function ThemeSectionEditor({
  theme,
  onUpdate,
  onApplyPalette,
}: {
  theme: TemplateTheme
  onUpdate: (patch: Partial<TemplateTheme>) => void
  /** A palette spans the theme and the masthead, so applying one needs a
   *  handler that can reach both sections. */
  onApplyPalette?: (palette: Palette) => void
}) {
  const swatch = (
    label: string,
    key: 'primaryColor' | 'inkColor' | 'mutedColor' | 'bodyBgColor' | 'pageBgColor',
    fallback: string,
    hint: string,
  ) => (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={theme[key] ?? fallback}
        onChange={(e) => onUpdate({ [key]: e.target.value })}
        className="h-7 w-9 shrink-0 cursor-pointer rounded border border-slate-300"
      />
      <div className="min-w-0">
        <p className="text-[11px] font-medium leading-tight text-slate-900">{label}</p>
        <p className="text-[10px] leading-tight text-slate-500">{hint}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      {onApplyPalette && (
        <PaletteRow theme={theme} onApply={onApplyPalette} />
      )}

      <ContrastReadout theme={theme} />

      <div className="grid grid-cols-2 gap-2">
        {swatch('Brand', 'primaryColor', '#BE1623', 'Every button and link')}
        {swatch('Ink', 'inkColor', '#0f172a', 'Body copy and headings')}
        {swatch('Muted', 'mutedColor', '#6b7280', 'Captions, small print')}
        {swatch('Card', 'bodyBgColor', '#ffffff', 'Behind the content')}
      </div>

      <PageBackgroundRow
        value={theme.pageBgColor ?? '#f9fafb'}
        onChange={(pageBgColor) => onUpdate({ pageBgColor })}
      />

      <FontRow
        label="Headings"
        value={theme.headingFont ?? 'system'}
        onChange={(v) => onUpdate({ headingFont: v })}
      />
      <FontRow
        label="Body"
        value={theme.bodyFont ?? 'system'}
        onChange={(v) => onUpdate({ bodyFont: v })}
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Text size</Label>
          <div className="flex gap-1">
            {[15, 16, 17, 18].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onUpdate({ baseFontSize: size })}
                className={cn(
                  'flex-1 rounded-md border py-1 text-[11px] transition-colors',
                  (theme.baseFontSize ?? 16) === size
                    ? 'border-indigo-500 bg-indigo-50 text-slate-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px]">Headings</Label>
          <div className="flex gap-1">
            {([
              { v: 0.9, l: 'S' },
              { v: 1, l: 'M' },
              { v: 1.15, l: 'L' },
              { v: 1.3, l: 'XL' },
            ] as const).map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => onUpdate({ headingScale: o.v })}
                className={cn(
                  'flex-1 rounded-md border py-1 text-[11px] transition-colors',
                  (theme.headingScale ?? 1) === o.v
                    ? 'border-indigo-500 bg-indigo-50 text-slate-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Corners</Label>
          <div className="flex gap-1">
            {(['square', 'soft', 'pill'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onUpdate({ corners: c })}
                className={cn(
                  'flex-1 rounded-md border py-1 text-[10px] capitalize transition-colors',
                  (theme.corners ?? 'soft') === c
                    ? 'border-indigo-500 bg-indigo-50 text-slate-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px]">Spacing</Label>
          <div className="flex gap-1">
            {(['compact', 'comfortable', 'airy'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onUpdate({ rhythm: r })}
                className={cn(
                  'flex-1 rounded-md border py-1 text-[10px] capitalize transition-colors',
                  (theme.rhythm ?? 'comfortable') === r
                    ? 'border-indigo-500 bg-indigo-50 text-slate-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {r === 'comfortable' ? 'normal' : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="rounded-md bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-800">
        Outlook ignores webfonts and rounded corners, so readers there see the
        fallback face and square buttons. Everywhere else — Gmail, Apple Mail,
        phones — gets the full treatment.
      </p>
    </div>
  )
}

/**
 * Whole schemes, in one click.
 *
 * Five colours that agree with each other is a design decision, not a
 * preference, and the failure mode of getting it wrong is quiet: grey small
 * print on a grey card reads fine on the laptop it was chosen on and vanishes
 * on a phone outdoors. Every palette here is contrast-checked in CI by
 * scripts/verify-palettes.mjs.
 */
function PaletteRow({
  theme,
  onApply,
}: {
  theme: TemplateTheme
  onApply: (palette: Palette) => void
}) {
  const active = matchPalette(theme)
  const current = PALETTES.find((p) => p.id === active)

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-[11px]">Colour palette</Label>
        <span className="text-[10px] text-slate-500">Page, card, text and brand together</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {PALETTES.map((palette) => (
          <button
            key={palette.id}
            type="button"
            onClick={() => onApply(palette)}
            title={palette.hint}
            className={cn(
              'overflow-hidden rounded border text-left transition-all',
              active === palette.id
                ? 'border-indigo-500 ring-2 ring-indigo-200'
                : 'border-slate-300 hover:border-slate-400',
            )}
          >
            {/* A miniature of the actual scheme: page, card, a line of text
                and the brand — not a row of abstract dots. */}
            <span
              className="flex h-9 items-center justify-center"
              style={{ backgroundColor: palette.theme.pageBgColor }}
            >
              <span
                className="flex h-6 w-[80%] items-center gap-1 rounded-sm px-1.5"
                style={{ backgroundColor: palette.theme.bodyBgColor }}
              >
                <span
                  className="h-1 flex-1 rounded-full"
                  style={{ backgroundColor: palette.theme.inkColor }}
                />
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: palette.theme.primaryColor }}
                />
              </span>
            </span>
            <span className="block truncate px-1.5 py-1 text-[10px] font-medium text-slate-700">
              {palette.name}
            </span>
          </button>
        ))}
      </div>

      {current?.caution ? (
        <p className="rounded bg-amber-50 p-1.5 text-[10px] leading-relaxed text-amber-800">
          {current.caution}
        </p>
      ) : (
        <p className="text-[10px] leading-relaxed text-slate-500">
          {current ? current.hint : 'Custom colours — the checks below apply to them too.'}
        </p>
      )}
    </div>
  )
}

/**
 * Live legibility check on whatever colours are currently set.
 *
 * Present for the custom case above all: the palettes are already verified,
 * but nothing stopped someone dragging the muted colour up until the small
 * print disappeared. AA wants 4.5:1 for body copy, 3:1 for a bold button
 * label.
 */
function ContrastReadout({ theme }: { theme: TemplateTheme }) {
  const card = theme.bodyBgColor ?? '#ffffff'
  const rows: { label: string; ratio: number; large: boolean }[] = [
    { label: 'Body text', ratio: contrastRatio(theme.inkColor ?? '#0f172a', card), large: false },
    { label: 'Small print', ratio: contrastRatio(theme.mutedColor ?? '#6b7280', card), large: false },
    {
      label: 'Button label',
      ratio: contrastRatio('#ffffff', theme.primaryColor ?? '#BE1623'),
      large: true,
    },
  ]

  const tone = {
    good: 'text-emerald-700',
    ok: 'text-slate-600',
    poor: 'text-red-700 font-semibold',
  }

  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        {rows.map((row) => {
          const verdict = contrastVerdict(row.ratio, row.large)
          return (
            <span key={row.label} className="text-[10px] leading-tight">
              <span className="block text-slate-500">{row.label}</span>
              <span className={tone[verdict]}>
                {row.ratio.toFixed(1)}:1 {verdict === 'poor' ? '· too low' : ''}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The colour around the email card.
 *
 * Split out from the swatch grid because it behaves differently from the
 * others: it is the one colour that changes how the whole email FEELS, and a
 * hex picker is a poor way to choose it — most values look wrong, and the good
 * ones are a narrow band. The presets are the band; the picker is still there
 * for a brand colour that isn't in it.
 */
const PAGE_PRESETS: { value: string; label: string }[] = [
  { value: '#ffffff', label: 'None' },
  { value: '#f9fafb', label: 'Paper' },
  { value: '#f3f0ea', label: 'Warm' },
  { value: '#e2e8f0', label: 'Slate' },
  { value: '#1e293b', label: 'Deep' },
  { value: '#0f172a', label: 'Ink' },
]

function PageBackgroundRow({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-[11px]">Page background</Label>
        <span className="text-[10px] text-slate-500">Around the email, not behind the text</span>
      </div>
      <div className="flex items-center gap-1.5">
        {PAGE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            title={preset.label}
            className={cn(
              'h-7 flex-1 rounded border transition-all',
              value.toLowerCase() === preset.value
                ? 'border-indigo-500 ring-2 ring-indigo-200'
                : 'border-slate-300 hover:border-slate-400',
            )}
            style={{ backgroundColor: preset.value }}
          >
            <span className="sr-only">{preset.label}</span>
          </button>
        ))}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 shrink-0 cursor-pointer rounded border border-slate-300"
          title="Custom colour"
        />
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        A darker page makes the email read as a card. Keep the card itself light —
        some clients invert dark backgrounds in dark mode, and light text on a
        dark card is where that goes wrong.
      </p>
    </div>
  )
}

/** Miniature of the theme, so a change is visible without leaving the panel. */
export function ThemePreview({ theme }: { theme: TemplateTheme }) {
  const ink = theme.inkColor ?? '#0f172a'
  const brand = theme.primaryColor ?? '#BE1623'
  const muted = theme.mutedColor ?? '#6b7280'
  const base = theme.baseFontSize ?? 16
  const scale = theme.headingScale ?? 1
  const radius = theme.corners === 'square' ? 0 : theme.corners === 'pill' ? 999 : 8
  const pad = theme.rhythm === 'compact' ? 16 : theme.rhythm === 'airy' ? 32 : 24

  return (
    // Two layers, because the theme has two backgrounds: the page around the
    // email and the card itself. Showing only the card meant the page colour
    // could be changed with nothing on screen reacting to it.
    <div style={{ backgroundColor: theme.pageBgColor ?? '#f9fafb', padding: 12 }}>
    <div
      style={{
        backgroundColor: theme.bodyBgColor ?? '#ffffff',
        padding: pad,
        borderRadius: 6,
        fontFamily: PREVIEW_STACK[theme.bodyFont ?? 'system'],
        color: ink,
      }}
    >
      <div
        style={{
          fontFamily: PREVIEW_STACK[theme.headingFont ?? 'system'],
          fontSize: Math.round(base * 1.625 * scale),
          lineHeight: 1.25,
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        Your place at IFG
      </div>
      <div style={{ fontSize: base, lineHeight: 1.6 }}>
        Every template uses these settings, so one change here restyles all of
        them at once.
      </div>
      <div style={{ fontSize: Math.round(base * 0.8), color: muted, marginTop: 8 }}>
        Small print and captions sit in the muted colour.
      </div>
      <div style={{ marginTop: 14 }}>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: brand,
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: radius,
            fontWeight: 700,
            fontSize: base,
          }}
        >
          Start your application
        </span>
      </div>
    </div>
    </div>
  )
}
