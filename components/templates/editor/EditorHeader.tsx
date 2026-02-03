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
      <div className="h-14 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between px-4">
        {/* Left: Close + Name */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-3">
            {isEditingName ? (
              <Input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingName(false)
                  }
                }}
                className="w-64 text-lg font-semibold border-slate-300 dark:border-slate-600 focus-visible:ring-blue-500"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="text-lg font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {name || 'Untitled Template'}
              </button>
            )}

            {hasUnsavedChanges && (
              <span className="text-xs font-medium text-orange-600 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/50 px-2 py-1 rounded-full">
                Unsaved changes
              </span>
            )}
          </div>
        </div>

        {/* Center: Undo/Redo */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={!canUndo}
            className={cn(
              'h-8 w-8 p-0',
              canUndo ? 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700' : 'text-slate-300 dark:text-slate-600'
            )}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-600" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onRedo}
            disabled={!canRedo}
            className={cn(
              'h-8 w-8 p-0',
              canRedo ? 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700' : 'text-slate-300 dark:text-slate-600'
            )}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {isEditingExisting && onDelete && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDeleteClick}
              className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onPreview}
            className="text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onSaveDraft} 
            disabled={isSaving}
            className="text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Draft
          </Button>
          <Button 
            size="sm" 
            onClick={onSaveAndExit} 
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Save & Exit
          </Button>
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
