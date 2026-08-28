'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { QuoteBlockContent } from '@/lib/templates/editor-types'
import { useEditorTheme } from '../EditorThemeContext'
import { fontStack } from '@/lib/templates/render-html'

interface QuoteBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

export function QuoteBlock({ content, isSelected, onUpdate }: QuoteBlockProps) {
  const c = content as unknown as QuoteBlockContent
  const theme = useEditorTheme()
  const isStat = c.variant === 'stat'
  // Blank accent means "use the brand colour" — same rule as the renderer.
  const accent = c.accentColor || theme.primaryColor

  return (
    <div className="py-2">
      {isSelected && (
        <div className="mb-3 space-y-2 rounded-md border border-slate-200 bg-white p-2.5 text-slate-900 [color-scheme:light]">
          <div className="flex items-center gap-2">
            <Label className="text-[11px]">Style</Label>
            {(['quote', 'stat'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onUpdate({ variant: v })}
                className={cn(
                  'rounded-md border px-3 py-1 text-[11px] capitalize transition-colors',
                  (c.variant ?? 'quote') === v
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                {v === 'stat' ? 'Statistic' : 'Quote'}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1.5 text-[11px]">
              Accent
              <input
                type="color"
                value={accent}
                onChange={(e) => onUpdate({ accentColor: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded border border-slate-300"
              />
            </label>
          </div>

          <Textarea
            value={c.text ?? ''}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder={isStat ? '92% progress to university' : 'What someone said about IFG.'}
            rows={2}
            className="text-xs"
          />
          <Input
            value={c.attribution ?? ''}
            onChange={(e) => onUpdate({ attribution: e.target.value })}
            placeholder="Who said it, or what the number means"
            className="h-7 text-xs"
          />
        </div>
      )}

      {/* Preview */}
      <div
        style={{
          paddingTop: c.paddingTop,
          paddingBottom: c.paddingBottom,
          backgroundColor: c.backgroundColor || undefined,
        }}
      >
        <div className="flex">
          <div style={{ width: 4, backgroundColor: accent }} />
          <div className="py-1 pl-4">
            <div
              style={
                isStat
                  ? {
                      fontFamily: fontStack(theme.headingFont),
                      fontSize: Math.round(theme.baseFontSize * 2.5 * (theme.headingScale || 1)),
                      lineHeight: 1.1,
                      fontWeight: 700,
                      color: accent,
                    }
                  : {
                      fontFamily: fontStack(theme.headingFont),
                      fontSize: Math.round(theme.baseFontSize * 1.375),
                      lineHeight: 1.45,
                      fontStyle: 'italic',
                      color: theme.inkColor,
                    }
              }
            >
              {c.text || (isStat ? '92%' : 'What someone said about IFG.')}
            </div>
            {c.attribution && (
              <div
                className="mt-2 text-[13px] uppercase tracking-wide"
                style={{ color: theme.mutedColor, fontFamily: fontStack(theme.bodyFont) }}
              >
                {c.attribution}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
