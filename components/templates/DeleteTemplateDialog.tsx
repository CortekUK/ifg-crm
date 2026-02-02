'use client'

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
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTemplateUsage } from '@/lib/hooks/useTemplates'
import type { Template } from '@/lib/types/templates'

interface DeleteTemplateDialogProps {
  template: Template | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isDeleting?: boolean
}

export function DeleteTemplateDialog({
  template,
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: DeleteTemplateDialogProps) {
  const { data: usage, isLoading: usageLoading } = useTemplateUsage(template?.id || '')

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Template
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Are you sure you want to delete <strong>"{template?.name}"</strong>? 
              This action cannot be undone.
            </p>
            
            {usageLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking template usage...
              </div>
            ) : usage?.isUsed ? (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="text-amber-800 font-medium text-sm">
                  Warning: This template is used in {usage.usedInAutomations.length} automation(s):
                </p>
                <ul className="mt-2 text-sm text-amber-700 list-disc list-inside">
                  {usage.usedInAutomations.slice(0, 5).map((automation) => (
                    <li key={automation.id}>{automation.name}</li>
                  ))}
                  {usage.usedInAutomations.length > 5 && (
                    <li>...and {usage.usedInAutomations.length - 5} more</li>
                  )}
                </ul>
                <p className="mt-2 text-sm text-amber-700">
                  Deleting this template will affect these automations.
                </p>
              </div>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting || usageLoading}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Template'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
