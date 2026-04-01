'use client'

import { useState } from 'react'
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
import { X, Undo2, Redo2, Eye, Save, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditorHeaderProps {
  name: string
  onNameChange: (name: string) => void
  onClose: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onPreview: () => void
  onSaveDraft: () => void
  onSaveAndExit: () => void
  onDelete?: () => void
  isSaving: boolean
  hasUnsavedChanges: boolean
  isEditingExisting?: boolean
}

export function EditorHeader({
  name,
  onNameChange,
  onClose,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onPreview,
  onSaveDraft,
  onSaveAndExit,
  onDelete,
  isSaving,
  hasUnsavedChanges,
  isEditingExisting = false,
}: EditorHeaderProps) {
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowCloseDialog(true)
    } else {
      onClose()
    }
  }

  const handleConfirmClose = () => {
    setShowCloseDialog(false)
    onClose()
  }

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = () => {
    setShowDeleteDialog(false)
    onDelete?.()
  }

  return (
    <>
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 md:px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Close + Name */}
          <div className="flex items-center gap-2 min-w-0">
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
                onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingName(false) }}
                className="w-32 md:w-64 text-sm md:text-lg font-semibold"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="text-sm md:text-lg font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px] md:max-w-none"
              >
                {name || 'Untitled Template'}
              </button>
            )}

            {hasUnsavedChanges && (
              <span className="hidden md:inline text-xs font-medium text-orange-600 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/50 px-2 py-1 rounded-full">
                Unsaved changes
              </span>
            )}
          </div>

          {/* Center: Undo/Redo - hidden on mobile */}
          <div className="hidden md:flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-lg p-1">
            <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} className="h-8 w-8 p-0">
              <Undo2 className="h-4 w-4" />
            </Button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-600" />
            <Button variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo} className="h-8 w-8 p-0">
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isEditingExisting && onDelete && (
              <Button variant="ghost" size="icon" onClick={handleDeleteClick} className="h-8 w-8 text-red-500 hidden md:flex">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onPreview} className="hidden md:flex h-8">
              <Eye className="h-4 w-4 mr-1.5" />
              Preview
            </Button>
            <Button variant="outline" size="sm" onClick={onSaveDraft} disabled={isSaving} className="h-8">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 md:mr-1.5" />}
              <span className="hidden md:inline">Save Draft</span>
            </Button>
            <Button size="sm" onClick={onSaveAndExit} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white h-8">
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <span className="hidden md:inline">Save & Exit</span>
              <span className="md:hidden">Save</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Template
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{name}"? This action cannot be undone.
              This template may be used in automations or campaigns.
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

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
              Unsaved Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose} className="bg-red-600 hover:bg-red-700">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
