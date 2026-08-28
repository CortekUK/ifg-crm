'use client'

// Brand & type — the colours, fonts and spacing every template inherits.
//
// This deliberately sits OUTSIDE the email card, unlike the header and footer
// regions. Those genuinely are part of the email, so showing them inside the
// card is honest. The theme is not: it is a setting. The first version put it
// inside the card with a specimen headline and a sample button, and it read as
// content sitting at the top of the email — which it never was and never gets
// sent.
//
// So: a toolbar above the email, showing the current settings as chips rather
// than as a fake paragraph. The specimen still exists, but only inside the
// panel once you open it, where it is labelled as a sample.

import { Button } from '@/components/ui/button'
import { Loader2, Palette as PaletteIcon, Undo2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TemplateTheme, ThemeFont } from '@/lib/templates/editor-types'
import type { Palette } from '@/lib/templates/palettes'
import { ThemePreview, ThemeSectionEditor } from './GlobalSectionEditors'

/** What each stack actually renders as, for the summary chip. */
const FONT_LABELS: Record<ThemeFont, string> = {
  system: 'System',
  modern: 'Inter',
  classic: 'Georgia',
  editorial: 'Playfair',
  condensed: 'Oswald',
  mono: 'Space Mono',
}

interface ThemeBarProps {
  theme: TemplateTheme
  isSelected: boolean
  onSelect: () => void
  onClose: () => void
  onUpdate: (patch: Partial<TemplateTheme>) => void
  /** Applies a whole palette — theme colours AND the masthead band. */
  onApplyPalette: (palette: Palette) => void
  isDirty: boolean
  isSaving: boolean
  onPublish: () => void
  onDiscard: () => void
}

export function ThemeBar({
  theme,
  isSelected,
  onSelect,
  onClose,
  onUpdate,
  onApplyPalette,
  isDirty,
  isSaving,
  onPublish,
  onDiscard,
}: ThemeBarProps) {
  const heading = FONT_LABELS[theme.headingFont ?? 'system']
  const body = FONT_LABELS[theme.bodyFont ?? 'system']

  return (
    <div className="mb-3" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={isSelected ? onClose : onSelect}
        // Solid, never translucent. A half-transparent bar picked up whatever
        // page colour was behind it and read as disabled — on the darker
        // palettes it was grey-on-grey.
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left shadow-sm transition-colors',
          isSelected
            ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950'
            : 'border-slate-300 bg-white hover:border-indigo-400 hover:shadow-md dark:border-slate-600 dark:bg-slate-800',
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900">
          <PaletteIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
        </span>
        <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white">
          Brand &amp; type
        </span>

        {/* The settings themselves, at a glance — no sample sentence needed. */}
        <span className="flex min-w-0 flex-1 items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
          <span className="flex shrink-0 items-center gap-1.5">
            {[
              theme.primaryColor ?? '#BE1623',
              theme.inkColor ?? '#0f172a',
              theme.mutedColor ?? '#6b7280',
            ].map((colour) => (
              <span
                key={colour}
                className="h-4 w-4 rounded-full ring-1 ring-slate-300 dark:ring-slate-500"
                style={{ backgroundColor: colour }}
              />
            ))}
          </span>
          <span className="truncate">
            {heading} / {body} · {theme.corners ?? 'soft'} · {theme.rhythm ?? 'comfortable'}
          </span>
        </span>

        {isDirty && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            Not applied
          </span>
        )}
        <span
          className={cn(
            'shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold',
            isSelected
              ? 'text-indigo-700 dark:text-indigo-300'
              : 'bg-indigo-600 text-white',
          )}
        >
          {isSelected ? 'Close' : 'Edit'}
        </span>
      </button>

      {isSelected && (
        // Forced light for the same reason the other global panels are: it
        // floats over an always-white email canvas, and dark-mode text landed
        // pale grey on white.
        <div className="mt-2 rounded-lg border border-indigo-200 bg-white p-3 text-slate-900 [color-scheme:light]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="text-xs text-indigo-700">
              These settings style <strong>every template</strong>, including ones you
              create later. They are not part of the email you are editing.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-3 overflow-hidden rounded border border-slate-200">
            <p className="border-b border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Sample — shows your settings, never sent
            </p>
            <ThemePreview theme={theme} />
          </div>

          <ThemeSectionEditor
            theme={theme}
            onUpdate={onUpdate}
            onApplyPalette={onApplyPalette}
          />

          <div className="mt-3 flex items-center gap-2 border-t border-indigo-200 pt-3">
            <Button size="sm" onClick={onPublish} disabled={!isDirty || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {isDirty ? 'Apply to all templates' : 'Applied'}
            </Button>
            {isDirty && (
              <Button size="sm" variant="ghost" onClick={onDiscard} disabled={isSaving}>
                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                Discard
              </Button>
            )}
            {isDirty && (
              <span className="text-xs text-amber-700">Unsaved — not live yet</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
