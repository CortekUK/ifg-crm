'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Loader2,
  RotateCw,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import type { PortalStatus } from '@/lib/hooks/usePortalStatus'

interface GuardianAccessPanelProps {
  contactId: string
  parentName: string | null
  parentEmail: string | null
  portalStatus: PortalStatus | undefined
}

export function GuardianAccessPanel({
  contactId,
  parentName,
  parentEmail,
  portalStatus,
}: GuardianAccessPanelProps) {
  const queryClient = useQueryClient()
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)

  const playerActive = portalStatus?.state === 'active'
  const guardian = portalStatus?.guardian

  const inviteMutation = useMutation({
    mutationFn: async (resend: boolean) => {
      const res = await fetch('/api/portal/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId, invite_guardian: true, resend }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to invite guardian')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-status', contactId] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/portal/invite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId, remove_guardian: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove guardian')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-status', contactId] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const handleInvite = async () => {
    try {
      const isResend = guardian?.state === 'invited'
      await inviteMutation.mutateAsync(isResend)
      toast({ title: isResend ? 'Invitation resent' : 'Guardian invited' })
    } catch (err) {
      toast({
        title: 'Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const handleRemove = async () => {
    try {
      await removeMutation.mutateAsync()
      toast({ title: 'Guardian access removed' })
      setConfirmRemoveOpen(false)
    } catch (err) {
      toast({
        title: 'Failed to remove',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
      setConfirmRemoveOpen(false)
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
        Guardian Access
      </h3>

      {!playerActive && (
        <p className="text-xs text-slate-500 italic">
          Activate the player&apos;s portal first to invite a guardian.
        </p>
      )}

      {playerActive && !parentEmail && (
        <p className="text-xs text-slate-500 italic">
          Add a parent/guardian email to the contact to invite them.
        </p>
      )}

      {playerActive && parentEmail && (
        <div className="rounded border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">
                  {parentName || parentEmail}
                </span>
                {guardian?.state === 'active' && (
                  <Badge className="text-[10px] uppercase bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                    Active
                  </Badge>
                )}
                {guardian?.state === 'invited' && (
                  <Badge className="text-[10px] uppercase bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                    Pending
                  </Badge>
                )}
                {guardian?.state === 'none' && (
                  <Badge className="text-[10px] uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Not invited
                  </Badge>
                )}
              </div>
              <div className="text-xs text-slate-500 truncate">{parentEmail}</div>
              {guardian?.state === 'active' && guardian.last_sign_in_at && (
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Last login {formatDate(guardian.last_sign_in_at)}
                </div>
              )}
              {guardian?.state === 'invited' && guardian.invited_at && (
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Invited {formatDate(guardian.invited_at)}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {guardian?.state === 'active' ? (
                <ShieldCheck className="h-4 w-4 text-green-600" />
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    'h-8 gap-1.5 text-xs',
                    guardian?.state === 'invited' &&
                      'border-amber-500/40 text-amber-700 dark:text-amber-300'
                  )}
                  disabled={inviteMutation.isPending}
                  onClick={handleInvite}
                >
                  {inviteMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : guardian?.state === 'invited' ? (
                    <RotateCw className="h-3.5 w-3.5" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  {guardian?.state === 'invited' ? 'Resend' : 'Invite'}
                </Button>
              )}
              {guardian && guardian.state !== 'none' && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-600 hover:text-red-700"
                  onClick={() => setConfirmRemoveOpen(true)}
                  title="Remove guardian access"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove guardian access?</AlertDialogTitle>
            <AlertDialogDescription>
              {parentEmail
                ? `${parentEmail} will lose portal access immediately. Their portal account will be deleted.`
                : 'The guardian will lose portal access immediately.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removeMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {removeMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  Removing…
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
