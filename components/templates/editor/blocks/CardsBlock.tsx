'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CardsBlockContent, CardItem } from '@/lib/templates/editor-types'
import { useEditorTheme } from '../EditorThemeContext'
import { cornerRadius, fontStack } from '@/lib/templates/render-html'

interface CardsBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

const MAX_CARDS = 3

export function CardsBlock({ content, isSelected, onUpdate }: CardsBlockProps) {
  const c = content as unknown as CardsBlockContent
  const theme = useEditorTheme()
  const items = c.items ?? []

  const setItems = (next: CardItem[]) => onUpdate({ items: next })
  const patch = (i: number, p: Partial<CardItem>) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)))

  return (
    <div className="py-2">
      {isSelected && (
        <div className="mb-3 space-y-2 rounded-md border border-slate-200 bg-white p-2.5 text-slate-900 [color-scheme:light]">
          <div className="flex items-center gap-2">
            <Label className="text-[11px]">Columns</Label>
            {([2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onUpdate({ columns: n })}
                className={cn(
                  'rounded-md border px-3 py-1 text-[11px] transition-colors',
                  (c.columns ?? 2) === n
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                {n}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-slate-500">
              Stacks on phones
            </span>
          </div>

          {items.map((item, i) => (
            <div key={i} className="space-y-1 rounded border border-slate-200 p-2">
              <div className="flex gap-1.5">
                <Input
                  value={item.icon ?? ''}
                  onChange={(e) => patch(i, { icon: e.target.value })}
                  placeholder="🏆"
                  className="h-7 w-12 text-center text-xs"
                />
                <Input
                  value={item.title ?? ''}
                  onChange={(e) => patch(i, { title: e.target.value })}
                  placeholder="Title"
                  className="h-7 flex-1 text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea
                value={item.body ?? ''}
                onChange={(e) => patch(i, { body: e.target.value })}
                placeholder="A sentence or two."
                rows={2}
                className="text-xs"
              />
            </div>
          ))}

          {items.length < MAX_CARDS && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-full text-xs"
              onClick={() => setItems([...items, { title: '', body: '', icon: '' }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add panel
            </Button>
          )}

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px]">
              Fill
              <input
                type="color"
                value={c.backgroundColor || '#f7f7f5'}
                onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded border border-slate-300"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px]">
              Border
              <input
                type="color"
                value={c.borderColor || '#e5e7eb'}
                onChange={(e) => onUpdate({ borderColor: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded border border-slate-300"
              />
            </label>
          </div>
        </div>
      )}

      {/* Preview */}
      <div
        style={{ paddingTop: c.paddingTop, paddingBottom: c.paddingBottom }}
        className="flex gap-3"
      >
        {items.slice(0, c.columns ?? 2).map((item, i) => (
          <div
            key={i}
            className="flex-1 p-4"
            style={{
              backgroundColor: c.backgroundColor || '#f7f7f5',
              border: `1px solid ${c.borderColor || '#e5e7eb'}`,
              borderRadius: cornerRadius(theme.corners),
            }}
          >
            {item.icon && <div className="mb-2 text-xl leading-none">{item.icon}</div>}
            <div
              className="mb-1.5 font-bold"
              style={{
                fontFamily: fontStack(theme.headingFont),
                fontSize: Math.round(theme.baseFontSize * 1.0625),
                color: theme.inkColor,
              }}
            >
              {item.title || 'Title'}
            </div>
            <div
              className="leading-snug"
              style={{
                fontFamily: fontStack(theme.bodyFont),
                fontSize: Math.round(theme.baseFontSize * 0.875),
                color: theme.mutedColor,
              }}
            >
              {item.body || 'A sentence or two.'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
