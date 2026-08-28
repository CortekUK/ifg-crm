'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import { uploadEmailImage } from '@/lib/templates/upload-image'
import type { HeroBlockContent } from '@/lib/templates/editor-types'
import { useEditorTheme } from '../EditorThemeContext'
import { cornerRadius, fontStack } from '@/lib/templates/render-html'

interface HeroBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

const HEIGHTS = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'tall', label: 'Tall' },
] as const

export function HeroBlock({ content, isSelected, onUpdate }: HeroBlockProps) {
  const c = content as unknown as HeroBlockContent
  const theme = useEditorTheme()
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      onUpdate({ imageUrl: await uploadEmailImage(file) })
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

  const pad = c.height === 'short' ? 36 : c.height === 'tall' ? 84 : 60

  return (
    <div className="py-2">
      {isSelected && (
        <div className="mb-3 space-y-2 rounded-md border border-slate-200 bg-white p-2.5 text-slate-900 [color-scheme:light]">
          <div className="space-y-1">
            <Label className="text-[11px]">Background photograph</Label>
            <div className="flex gap-1.5">
              <Input
                value={c.imageUrl ?? ''}
                onChange={(e) => onUpdate({ imageUrl: e.target.value })}
                placeholder="Upload an image"
                className="h-7 flex-1 text-xs"
              />
              <label className="inline-flex">
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <span className="inline-flex h-7 cursor-pointer items-center rounded-md border border-slate-300 px-2">
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                </span>
              </label>
              {c.imageUrl && (
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onUpdate({ imageUrl: '' })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <Input
            value={c.heading ?? ''}
            onChange={(e) => onUpdate({ heading: e.target.value })}
            placeholder="Headline"
            className="h-7 text-xs"
          />
          <Input
            value={c.subheading ?? ''}
            onChange={(e) => onUpdate({ subheading: e.target.value })}
            placeholder="Supporting line"
            className="h-7 text-xs"
          />

          <div className="grid grid-cols-2 gap-1.5">
            <Input
              value={c.buttonText ?? ''}
              onChange={(e) => onUpdate({ buttonText: e.target.value })}
              placeholder="Button text"
              className="h-7 text-xs"
            />
            <Input
              value={c.buttonUrl ?? ''}
              onChange={(e) => onUpdate({ buttonUrl: e.target.value })}
              placeholder="Button link"
              className="h-7 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Height</Label>
              <div className="flex gap-1">
                {HEIGHTS.map((h) => (
                  <button
                    key={h.value}
                    type="button"
                    onClick={() => onUpdate({ height: h.value })}
                    className={cn(
                      'flex-1 rounded-md border py-1 text-[10px] transition-colors',
                      (c.height ?? 'medium') === h.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">
                Darken photo · {c.overlayOpacity ?? 55}%
              </Label>
              <input
                type="range"
                min={0}
                max={90}
                value={c.overlayOpacity ?? 55}
                onChange={(e) => onUpdate({ overlayOpacity: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          <p className="rounded bg-amber-50 p-1.5 text-[10px] text-amber-800">
            Outlook can&apos;t darken a background photo, so pick a dark image — a
            bright one will swallow the white text there.
          </p>
        </div>
      )}

      {/* Preview */}
      <div
        style={{
          backgroundColor: theme.inkColor,
          backgroundImage: c.imageUrl ? `url(${c.imageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          style={{
            backgroundColor: `rgba(0,0,0,${(c.overlayOpacity ?? 55) / 100})`,
            padding: `${pad}px 24px`,
            textAlign: c.alignment === 'left' ? 'left' : 'center',
            color: c.textColor || '#ffffff',
          }}
        >
          {c.heading && (
            <div
              style={{
                fontFamily: fontStack(theme.headingFont),
                fontSize: Math.round(theme.baseFontSize * 2 * (theme.headingScale || 1)),
                lineHeight: 1.2,
                fontWeight: 700,
              }}
            >
              {c.heading}
            </div>
          )}
          {c.subheading && (
            <div
              style={{
                marginTop: 10,
                fontFamily: fontStack(theme.bodyFont),
                fontSize: Math.round(theme.baseFontSize * 1.05),
                opacity: 0.9,
              }}
            >
              {c.subheading}
            </div>
          )}
          {c.buttonText && (
            <div style={{ marginTop: 20 }}>
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: theme.primaryColor,
                  color: '#fff',
                  padding: '13px 28px',
                  borderRadius: cornerRadius(theme.corners),
                  fontFamily: fontStack(theme.bodyFont),
                  fontWeight: 700,
                }}
              >
                {c.buttonText}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
