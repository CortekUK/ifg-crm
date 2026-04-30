'use client'

import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import type { HTMLBlockContent } from '@/lib/templates/editor-types'

interface HTMLBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

export function HTMLBlock({ content, isSelected, onUpdate }: HTMLBlockProps) {
  const htmlContent = content as unknown as HTMLBlockContent

  return (
    <div className="py-2">
      {/* Settings panel when selected */}
      {isSelected && (
        <div className="space-y-3 mb-3">
          <Alert variant="default" className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
              Custom HTML may not render correctly in all email clients.
            </AlertDescription>
          </Alert>

          <Textarea
            value={htmlContent.code}
            onChange={(e) => onUpdate({ code: e.target.value })}
            placeholder="<!-- Enter custom HTML -->"
            className="font-mono text-sm min-h-[200px] max-h-[400px] overflow-auto"
          />
        </div>
      )}

      {/* HTML Preview — capped height with internal scroll so a long block
          (e.g. an imported full-email HTML doc) doesn't push the canvas
          past the viewport, which made the surrounding canvas appear
          unscrollable. */}
      <div className="border rounded p-3 bg-gray-50 dark:bg-slate-800 max-h-[500px] overflow-auto">
        {htmlContent.code ? (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: htmlContent.code }}
          />
        ) : (
          <div className="text-sm text-gray-400 text-center py-4">
            Custom HTML block
          </div>
        )}
      </div>
    </div>
  )
}
