'use client'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { RotateCcw, ArrowRight } from 'lucide-react'
import type { ResettableEnrollment } from '@/lib/hooks/useAutomationEnrollments'

interface ResetAutomationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmReset: () => void
  onConfirmKeep: () => void
  enrollments: ResettableEnrollment[]
  targetStageName: string
  isResetting?: boolean
}

export function ResetAutomationModal({
  isOpen,
  onClose,
  onConfirmReset,
  onConfirmKeep,
  enrollments,
  targetStageName,
  isResetting = false,
}: ResetAutomationModalProps) {
  const automationNames = enrollments.map(e => e.automation_name)
  const uniqueNames = [...new Set(automationNames)]

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-500" />
            Restart Automation Sequence?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This contact has already received emails from the following automation{uniqueNames.length > 1 ? 's' : ''}:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {uniqueNames.map((name) => (
                  <li key={name} className="font-medium text-foreground">{name}</li>
                ))}
              </ul>
              <p>
                Moving to <span className="font-medium text-foreground">{targetStageName}</span> will trigger this automation again.
              </p>
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                Do you want to restart the sequence from the beginning?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-4">
          <AlertDialogCancel onClick={onClose} disabled={isResetting} className="mt-0">
            Cancel
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={onConfirmKeep}
            disabled={isResetting}
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            Skip Restart
          </Button>
          <AlertDialogAction
            onClick={onConfirmReset}
            disabled={isResetting}
            className="gap-2 bg-amber-600 hover:bg-amber-700"
          >
            <RotateCcw className="h-4 w-4" />
            {isResetting ? 'Restarting...' : 'Restart'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
