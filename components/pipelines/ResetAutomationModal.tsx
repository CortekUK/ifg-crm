'use client'

import { useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RotateCcw, ArrowRight } from 'lucide-react'
import type { ResettableEnrollment } from '@/lib/hooks/useAutomationEnrollments'

interface ResetAutomationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmReset: (sendAsUserId?: string | null) => void
  onConfirmKeep: (sendAsUserId?: string | null) => void
  enrollments: ResettableEnrollment[]
  targetStageName: string
  isResetting?: boolean
  isSuperAdmin?: boolean
  currentUserId?: string
  currentUserName?: string
}

export function ResetAutomationModal({
  isOpen,
  onClose,
  onConfirmReset,
  onConfirmKeep,
  enrollments,
  targetStageName,
  isResetting = false,
  isSuperAdmin = false,
  currentUserId,
  currentUserName,
}: ResetAutomationModalProps) {
  const [sendAsMe, setSendAsMe] = useState(false)
  const automationNames = enrollments.map(e => e.automation_name)
  const uniqueNames = [...new Set(automationNames)]

  const getSendAsUserId = () => sendAsMe && currentUserId ? currentUserId : null

  const handleClose = () => {
    setSendAsMe(false)
    onClose()
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
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
        {isSuperAdmin && currentUserName && (
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              id="send-as-me-reset"
              checked={sendAsMe}
              onCheckedChange={(checked) => setSendAsMe(checked === true)}
            />
            <Label htmlFor="send-as-me-reset" className="text-sm cursor-pointer">
              Send emails as {currentUserName}
            </Label>
          </div>
        )}
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-4">
          <AlertDialogCancel onClick={handleClose} disabled={isResetting} className="mt-0">
            Cancel
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => onConfirmKeep(getSendAsUserId())}
            disabled={isResetting}
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            Skip Restart
          </Button>
          <AlertDialogAction
            onClick={() => onConfirmReset(getSendAsUserId())}
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
