'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const shortcuts = [
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['/'], description: 'Focus search' },
  { keys: ['Esc'], description: 'Close modal / deselect' },
  { keys: ['G', 'D'], description: 'Go to Dashboard' },
  { keys: ['G', 'C'], description: 'Go to Contacts' },
  { keys: ['G', 'P'], description: 'Go to Pipelines' },
]

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex items-center justify-between py-2 px-1"
            >
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-xs text-muted-foreground mx-0.5">then</span>}
                    <Kbd>{key}</Kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
