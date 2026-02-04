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
import { StopCircle, Play } from 'lucide-react'

interface ActiveEnrollment {
  id: string
  automation_id: string
  automation_name: string
}

interface StopAutomationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmStop: () => void
  onConfirmKeepRunning: () => void
  enrollments: ActiveEnrollment[]
  targetStageName: string
  isStopping?: boolean
}

export function StopAutomationModal({
  isOpen,
  onClose,
  onConfirmStop,
  onConfirmKeepRunning,
  enrollments,
  targetStageName,
  isStopping = false,
}: StopAutomationModalProps) {
  const automationNames = enrollments.map(e => e.automation_name)
  const uniqueNames = [...new Set(automationNames)]

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <StopCircle className="h-5 w-5 text-amber-500" />
            Active Automation Running
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This deal has an active automation sequence:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {uniqueNames.map((name) => (
                  <li key={name} className="font-medium text-foreground">{name}</li>
                ))}
              </ul>
              <p>
                Moving to <span className="font-medium text-foreground">{targetStageName}</span> will not stop the automation - emails will continue to be sent.
              </p>
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                Do you want to stop the automation?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-4">
          <AlertDialogCancel onClick={onClose} disabled={isStopping} className="mt-0">
            Cancel
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={onConfirmKeepRunning}
            disabled={isStopping}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            Keep Running
          </Button>
          <AlertDialogAction
            onClick={onConfirmStop}
            disabled={isStopping}
            className="gap-2 bg-amber-600 hover:bg-amber-700"
          >
            <StopCircle className="h-4 w-4" />
            {isStopping ? 'Stopping...' : 'Stop Automation'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
