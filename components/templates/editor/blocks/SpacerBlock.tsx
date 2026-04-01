'use client'

import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import type { SpacerBlockContent } from '@/lib/templates/editor-types'

interface SpacerBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

export function SpacerBlock({ content, isSelected, onUpdate }: SpacerBlockProps) {
  const spacerContent = content as unknown as SpacerBlockContent

  return (
    <div>
      {/* Settings panel when selected */}
      {isSelected && (
        <div className="space-y-3 mb-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-4">
            <Label className="text-xs">Height:</Label>
            <Slider
              value={[spacerContent.height]}
              onValueChange={([value]) => onUpdate({ height: value })}
              min={10}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="text-xs text-gray-500 w-12">{spacerContent.height}px</span>
          </div>
        </div>
      )}

      {/* Spacer Preview */}
      <div
        style={{ height: `${spacerContent.height}px` }}
        className={isSelected ? 'bg-gray-100 border border-dashed border-gray-300 rounded' : ''}
      >
        {isSelected && (
          <div className="h-full flex items-center justify-center text-xs text-gray-400">
            Spacer: {spacerContent.height}px
          </div>
        )}
      </div>
    </div>
  )
}
