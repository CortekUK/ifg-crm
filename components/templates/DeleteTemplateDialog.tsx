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
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 space-y-2">
                <p className="text-amber-800 dark:text-amber-200 font-medium text-sm">
                  Warning: this template is currently referenced by{' '}
                  {usage.usedInAutomations.length > 0 && (
                    <>
                      <strong>{usage.usedInAutomations.length}</strong> automation
                      {usage.usedInAutomations.length === 1 ? '' : 's'}
                    </>
                  )}
                  {usage.usedInAutomations.length > 0 && usage.usedInCampaigns.length > 0 && ' and '}
                  {usage.usedInCampaigns.length > 0 && (
                    <>
                      <strong>{usage.usedInCampaigns.length}</strong> campaign
                      {usage.usedInCampaigns.length === 1 ? '' : 's'}
                    </>
                  )}
                  .
                </p>
                {usage.usedInAutomations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase">Automations</p>
                    <ul className="mt-1 text-sm text-amber-700 dark:text-amber-300 list-disc list-inside">
                      {usage.usedInAutomations.slice(0, 5).map((a) => (
                        <li key={a.id}>{a.name}</li>
                      ))}
                      {usage.usedInAutomations.length > 5 && (
                        <li>…and {usage.usedInAutomations.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
                {usage.usedInCampaigns.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase">Campaigns</p>
                    <ul className="mt-1 text-sm text-amber-700 dark:text-amber-300 list-disc list-inside">
                      {usage.usedInCampaigns.slice(0, 5).map((c) => (
                        <li key={c.id}>
                          {c.name}
                          {c.status && (
                            <span className="ml-1 text-[10px] uppercase opacity-70">({c.status})</span>
                          )}
                        </li>
                      ))}
                      {usage.usedInCampaigns.length > 5 && (
                        <li>…and {usage.usedInCampaigns.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-amber-700 dark:text-amber-300 italic">
                  Deleting will null these references — affected automation steps will fail to send and campaigns will lose their template.
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
