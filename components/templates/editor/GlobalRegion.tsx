'use client'

// A globally-branded region on the template canvas: the header strip, the
// sender signature, the social row, the partner logos + disclaimer, and the
// unsubscribe strip.
//
// These behave like blocks — click to select, settings open inline — but
// they are NOT part of this template. Editing one rewrites the header or
// footer of every template, existing and future, so the region is styled
// distinctly (indigo, not blue) and its changes need an explicit
// "Apply to all templates" rather than riding the editor's auto-save.

import { Button } from '@/components/ui/button'
import { Globe, Loader2, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GlobalRegionProps {
  label: string
  /** Shown under the label when selected — what editing this affects. */
  hint?: string
  isSelected: boolean
  onSelect: () => void
  isDirty: boolean
  isSaving: boolean
  onPublish: () => void
  onDiscard: () => void
  /** Read-only rendering, shown when the region isn't selected. */
  preview: React.ReactNode
  /**
   * Settings UI shown once selected. The block-typed regions render their own
   * preview beneath their settings panel; the rest need `keepPreview`.
   */
  children?: React.ReactNode
  /**
   * Keep the read-only preview visible while the settings are open, for
   * regions whose editor doesn't render one itself. Without it the header
   * vanished the moment you clicked to change it, so you were picking a style
   * blind and had to deselect to see the result.
   */
  keepPreview?: boolean
}

export function GlobalRegion({
  label,
  hint,
  isSelected,
  onSelect,
  isDirty,
  isSaving,
  onPublish,
  onDiscard,
  preview,
  children,
  keepPreview = false,
}: GlobalRegionProps) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className={cn(
        'group relative cursor-pointer rounded-lg border-2 border-dashed transition-colors',
        isSelected
          ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-900/20'
          : 'border-transparent hover:border-indigo-300 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10',
      )}
    >
      {/* Badge — always legible on hover/selection so nobody edits the
          global footer thinking it belongs to the template in front of them. */}
      <div
        className={cn(
          'absolute -top-2.5 left-3 z-10 flex items-center gap-1.5 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white transition-opacity',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <Globe className="h-3 w-3" />
        Global · {label}
      </div>

      {isSelected && (
        <div className="space-y-3 border-b border-indigo-200 p-3 pt-5 dark:border-indigo-800">
          <p className="text-xs text-indigo-700 dark:text-indigo-300">
            {hint ??
              'Shared by every email template. Changes here apply everywhere, including templates you create later.'}
          </p>

          {/* Explicitly light. This panel floats over the email canvas — a
              white page whatever the app theme is — so dark-mode text colours
              landed pale-grey-on-white and were unreadable. `[color-scheme:light]`
              keeps native controls (colour swatches, file inputs) in step. */}
          <div className="rounded-md border border-indigo-200 bg-white p-2.5 text-slate-900 [color-scheme:light]">
            {children}
          </div>

          <div className="flex items-center gap-2 border-t border-indigo-200 pt-3 dark:border-indigo-800">
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onPublish()
              }}
              disabled={!isDirty || isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {isDirty ? 'Apply to all templates' : 'Applied'}
            </Button>
            {isDirty && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  onDiscard()
                }}
                disabled={isSaving}
              >
                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                Discard
              </Button>
            )}
            {isDirty && (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Unsaved — not live yet
              </span>
            )}
          </div>
        </div>
      )}

      {/* Click-through so a click anywhere on the region selects it. */}
      {(!isSelected || keepPreview) && (
        <div className="pointer-events-none">{preview}</div>
      )}
    </div>
  )
}
