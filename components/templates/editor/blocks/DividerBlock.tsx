'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DividerBlockContent } from '@/lib/templates/editor-types'

interface DividerBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

export function DividerBlock({ content, isSelected, onUpdate }: DividerBlockProps) {
  const dividerContent = content as unknown as DividerBlockContent

  return (
    <div
      style={{
        paddingTop: `${dividerContent.paddingTop}px`,
        paddingBottom: `${dividerContent.paddingBottom}px`,
      }}
    >
      {/* Settings panel when selected */}
      {isSelected && (
        <div className="space-y-3 mb-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Style:</Label>
              <select
                value={dividerContent.style}
                onChange={(e) =>
                  onUpdate({ style: e.target.value as 'solid' | 'dashed' | 'dotted' })
                }
                className="h-7 px-2 text-xs border rounded bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs">Colour:</Label>
              <input
                type="color"
                value={dividerContent.color}
                onChange={(e) => onUpdate({ color: e.target.value })}
                className="h-7 w-10 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Thickness:</Label>
              <select
                value={dividerContent.thickness}
                onChange={(e) => onUpdate({ thickness: parseInt(e.target.value) })}
                className="h-7 px-2 text-xs border rounded bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              >
                <option value="1">1px</option>
                <option value="2">2px</option>
                <option value="3">3px</option>
                <option value="4">4px</option>
                <option value="5">5px</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs">Width:</Label>
              <select
                value={(dividerContent as unknown as { width?: string }).width || '100'}
                onChange={(e) => onUpdate({ width: e.target.value })}
                className="h-7 px-2 text-xs border rounded bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              >
                <option value="100">Full (100%)</option>
                <option value="75">75%</option>
                <option value="50">50%</option>
                <option value="25">25%</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Padding top:</Label>
              <Input
                type="number"
                value={dividerContent.paddingTop}
                onChange={(e) => onUpdate({ paddingTop: parseInt(e.target.value) || 0 })}
                className="h-6 w-14 text-xs"
                min={0}
                max={50}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Padding bottom:</Label>
              <Input
                type="number"
                value={dividerContent.paddingBottom}
                onChange={(e) => onUpdate({ paddingBottom: parseInt(e.target.value) || 0 })}
                className="h-6 w-14 text-xs"
                min={0}
                max={50}
              />
            </div>
          </div>
        </div>
      )}

      {/* Divider Preview */}
      <div style={{ textAlign: 'center' }}>
        <hr
          style={{
            border: 'none',
            borderTop: `${dividerContent.thickness}px ${dividerContent.style} ${dividerContent.color}`,
            margin: '0 auto',
            width: `${(dividerContent as unknown as { width?: string }).width || '100'}%`,
          }}
        />
      </div>
    </div>
  )
}
