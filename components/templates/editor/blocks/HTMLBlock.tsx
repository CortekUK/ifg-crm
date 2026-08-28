'use client'

import { useRef } from 'react'
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
  const ref = useRef<HTMLTextAreaElement>(null)
  const code = htmlContent.code ?? ''
  const lineCount = code ? code.split('\n').length : 0

  // Tab is for indenting markup here, not for leaving the field — losing your
  // place mid-edit is worse than losing keyboard traversal of one textarea.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const el = e.currentTarget
    const { selectionStart, selectionEnd } = el
    const next = `${code.slice(0, selectionStart)}  ${code.slice(selectionEnd)}`
    onUpdate({ code: next })
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = selectionStart + 2
    })
  }

  return (
    <div className="py-2">
      {isSelected && (
        <div className="space-y-3 mb-3">
          <Alert
            variant="default"
            className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
              Custom HTML may not render correctly in all email clients. Prefer the
              normal blocks where you can.
            </AlertDescription>
          </Alert>

          {/* A code surface, not a prose field. The shared Textarea inherits
              body colours and soft-wraps, which broke tags across lines
              mid-attribute and made pasted markup nearly unreadable. */}
          <div className="overflow-hidden rounded-md border border-slate-300 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              <span>HTML</span>
              <span>
                {lineCount} {lineCount === 1 ? 'line' : 'lines'} · {code.length} chars
              </span>
            </div>
            <textarea
              ref={ref}
              value={code}
              onChange={(e) => onUpdate({ code: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="<!-- Enter custom HTML -->"
              // Browser text assistance corrupts markup — it has capitalised
              // tags and "corrected" attribute values in fields like this.
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              // No soft wrap: markup stays on its own line and scrolls
              // sideways, so an element reads as one element.
              wrap="off"
              className="block max-h-[420px] min-h-[220px] w-full resize-y overflow-auto whitespace-pre bg-slate-50 p-3 font-mono text-[12px] leading-[1.7] text-slate-800 outline-none dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>
      )}

      {/* Rendered result. No `prose` — email markup is tables and inline
          styles, and Tailwind's typography plugin restyles it into something
          the recipient will never see. */}
      <div className="max-h-[500px] overflow-auto rounded border bg-white p-3 dark:bg-slate-800">
        {code ? (
          <div dangerouslySetInnerHTML={{ __html: code }} />
        ) : (
          <div className="py-4 text-center text-sm text-gray-400">Custom HTML block</div>
        )}
      </div>
    </div>
  )
}
