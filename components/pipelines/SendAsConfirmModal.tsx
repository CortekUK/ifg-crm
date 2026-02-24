'use client'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Mail, User } from 'lucide-react'

interface SendAsConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (sendAsUserId: string | null) => void
  currentUserId: string
  currentUserName: string
  targetStageName: string
}

export function SendAsConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  currentUserId,
  currentUserName,
  targetStageName,
}: SendAsConfirmModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            Automation Email Sender
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Moving to <span className="font-medium text-foreground">{targetStageName}</span> will trigger an automation email sequence.
              </p>
              <p>
                Who should the emails be sent from?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
          <Button
            onClick={() => onConfirm(currentUserId)}
            className="gap-2 w-full sm:w-auto"
          >
            <Mail className="h-4 w-4" />
            Send as {currentUserName}
          </Button>
          <Button
            variant="outline"
            onClick={() => onConfirm(null)}
            className="gap-2 w-full sm:w-auto"
          >
            <User className="h-4 w-4" />
            Send as Deal Owner
          </Button>
          <AlertDialogCancel onClick={onClose} className="mt-0 w-full sm:w-auto">
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
