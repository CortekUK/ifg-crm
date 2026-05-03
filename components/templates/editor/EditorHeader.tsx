'use client'

// Single source of truth for the editor's top bar. The previous design
// rendered a second toolbar strip below the header for mode + view toggles
// — that left the page feeling cluttered (two horizontal bars, one of
// them pure chrome). All controls now live here on a single row, sized so
// the title gets centre-stage and the actions never crowd it.
//
// Layout (left → right):
//   [×] [Title] [Unsaved pill]
//   ────────  flex spacer  ────────
//   [Undo|Redo]  [D&D | AI]  [Preview eye]  [Save Draft] [Save & Exit]
//
// Mode toggle and Preview toggle are passed in optionally so the header
// stays portable. When `canUseAi` is false the mode toggle just isn't
// rendered (drag-and-drop only, the existing default).

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  X,
  Undo2,
  Redo2,
  Save,
  Loader2,
  Trash2,
  Sparkles,
  MousePointer2,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type EditorMode = 'manual' | 'ai'

interface EditorHeaderProps {
  name: string
  onNameChange: (name: string) => void
  onClose: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onSaveDraft: () => void
  onSaveAndExit: () => void
  onDelete?: () => void
  isSaving: boolean
  isAutoSaving?: boolean
  lastSavedAt?: Date | null
  hasUnsavedChanges: boolean
  isEditingExisting?: boolean
  // Mode toggle (super_admin only). Renders the D&D | AI segmented
  // control to the right of Undo/Redo when these are provided.
  mode?: EditorMode
  onModeChange?: (m: EditorMode) => void
  canUseAi?: boolean
}

export function EditorHeader({
  name,
  onNameChange,
  onClose,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSaveDraft,
  onSaveAndExit,
  onDelete,
  isSaving,
  isAutoSaving = false,
  lastSavedAt = null,
  hasUnsavedChanges,
  isEditingExisting = false,
  mode,
  onModeChange,
  canUseAi = false,
}: EditorHeaderProps) {
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)

  const handleClose = () => {
    if (hasUnsavedChanges) setShowCloseDialog(true)
    else onClose()
  }
  const handleConfirmClose = () => {
    setShowCloseDialog(false)
    onClose()
  }
  const handleDeleteClick = () => setShowDeleteDialog(true)
  const handleConfirmDelete = () => {
    setShowDeleteDialog(false)
    onDelete?.()
  }

  const showModeToggle = canUseAi && mode && onModeChange

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 md:px-4">
        <div className="flex items-center gap-2">
          {/* Left — close + title + unsaved pill */}
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 shrink-0 text-slate-500"
            >
              <X className="h-5 w-5" />
            </Button>

            {isEditingName ? (
              <Input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingName(false)
                }}
                className="w-32 text-sm font-semibold md:w-64 md:text-base"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="max-w-[140px] truncate text-sm font-semibold text-slate-800 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white md:max-w-none md:text-base"
                title="Click to rename"
              >
                {name || 'Untitled Template'}
              </button>
            )}

            <SaveStatus
              isAutoSaving={isAutoSaving}
              hasUnsavedChanges={hasUnsavedChanges}
              lastSavedAt={lastSavedAt}
            />
          </div>

          {/* Spacer pushes everything else right */}
          <div className="flex-1" />

          {/* Right — undo/redo, mode, preview toggle, save buttons */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Undo / Redo — quiet, paired in a small group */}
            <div className="hidden items-center rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800 md:flex">
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                className="h-7 w-7 p-0"
                title="Undo"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRedo}
                disabled={!canRedo}
                className="h-7 w-7 p-0"
                title="Redo"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Mode toggle — super_admin only, drives whether the left
                pane is the drag-and-drop sidebar or the AI chat. */}
            {showModeToggle && (
              <div className="hidden items-center rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800 md:flex">
                <button
                  type="button"
                  onClick={() => onModeChange!('manual')}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition',
                    mode === 'manual'
                      ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                  )}
                  title="Drag-and-drop builder"
                >
                  <MousePointer2 className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Build</span>
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange!('ai')}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition',
                    mode === 'ai'
                      ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                  )}
                  title="Generate with AI"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">AI</span>
                </button>
              </div>
            )}

            {isEditingExisting && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDeleteClick}
                className="hidden h-8 w-8 text-red-500 md:flex"
                title="Delete template"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onSaveDraft}
              disabled={isSaving}
              className="h-8"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4 md:mr-1.5" />
              )}
              <span className="hidden md:inline">Save Draft</span>
            </Button>
            <Button
              size="sm"
              onClick={onSaveAndExit}
              disabled={isSaving}
              className="h-8 bg-blue-600 text-white hover:bg-blue-700"
            >
              {isSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {/* Existing templates use "Update" (more honest about what
                  the action does — the row already exists). New templates
                  get "Save & Exit" since the action both creates and exits. */}
              <span className="hidden md:inline">
                {isEditingExisting ? 'Update' : 'Save & Exit'}
              </span>
              <span className="md:hidden">{isEditingExisting ? 'Update' : 'Save'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Delete dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Template
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{name}&quot;? This action cannot be
              undone. This template may be used in automations or campaigns.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved changes dialog — three actions: stay, save then leave,
          or discard and leave. The "Save & leave" path goes through the
          parent's Save & Exit handler so the routing logic stays in one
          place (the hook). */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
              Unsaved Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Save them before leaving, or discard
              and lose them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClose}
              className="bg-red-600 hover:bg-red-700"
            >
              Discard
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setShowCloseDialog(false)
                onSaveAndExit()
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isEditingExisting ? 'Update & Leave' : 'Save & Leave'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Tiny pill that surfaces the current save state next to the title:
//   • saving      — auto-save in flight
//   • unsaved     — changes pending
//   • saved (timestamp) — clean, last save was a moment ago
// Lives inline with the header rather than as a toast so the user
// always knows where the document stands without breaking flow.
function SaveStatus({
  isAutoSaving,
  hasUnsavedChanges,
  lastSavedAt,
}: {
  isAutoSaving: boolean
  hasUnsavedChanges: boolean
  lastSavedAt: Date | null
}) {
  // Force a re-render every 30s so the "Saved 2m ago" relative text
  // doesn't go stale while the user is staring at the editor.
  const [, force] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  if (isAutoSaving) {
    return (
      <span className="hidden items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 md:inline-flex">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    )
  }
  if (hasUnsavedChanges) {
    return (
      <span className="hidden rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 md:inline">
        Unsaved
      </span>
    )
  }
  if (lastSavedAt) {
    return (
      <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 md:inline-flex">
        <Check className="h-3 w-3" />
        Saved {formatRelative(lastSavedAt)}
      </span>
    )
  }
  return null
}

function formatRelative(d: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}
