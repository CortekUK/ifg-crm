'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Loader2,
  Mail,
  RotateCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserX,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import { usePortalStatus } from '@/lib/hooks/usePortalStatus'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import type { User, UserOrInvite } from '@/lib/types/users'

interface PlayerPortalDialogProps {
  user: UserOrInvite | null
  onClose: () => void
  onDelete: (user: User) => void
}

function PlayerStatusBadge({ user }: { user: UserOrInvite }) {
  if (user.is_invite) {
    return (
      <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
        Pending
      </Badge>
    )
  }
  return (
    <Badge
      className={
        user.is_active
          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
      }
    >
      {user.is_active ? 'Active' : 'Inactive'}
    </Badge>
  )
}

function getInitials(name: string | null | undefined, email: string) {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return email.slice(0, 2).toUpperCase()
}

// Pull parent_name + parent_email off the linked contact for display.
function useContactParentFields(contactId: string | null | undefined) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['contact-parent', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts')
        .select('parent_name, parent_email')
        .eq('id', contactId!)
        .single()
      return {
        parent_name: data?.parent_name ?? null,
        parent_email: data?.parent_email ?? null,
      }
    },
  })
}

export function PlayerPortalDialog({
  user,
  onClose,
  onDelete,
}: PlayerPortalDialogProps) {
  const queryClient = useQueryClient()
  const open = !!user
  const contactId = user?.contact_id ?? null

  const { data: portalStatus } = usePortalStatus(contactId)
  const { data: parentFields } = useContactParentFields(contactId)

  const inviteGuardian = useMutation({
    mutationFn: async (resend: boolean) => {
      if (!contactId) throw new Error('Player contact missing')
      const res = await fetch('/api/portal/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId,
          invite_guardian: true,
          resend,
        }),
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

  const removeGuardian = useMutation({
    mutationFn: async () => {
      if (!contactId) throw new Error('Player contact missing')
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

  if (!user) return null

  const guardian = portalStatus?.guardian
  const playerActive = portalStatus?.state === 'active'
  const parentEmail = parentFields?.parent_email ?? null
  const parentName = parentFields?.parent_name ?? null

  const handleInvite = async () => {
    try {
      const isResend = guardian?.state === 'invited'
      await inviteGuardian.mutateAsync(isResend)
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
      await removeGuardian.mutateAsync()
      toast({ title: 'Guardian access removed' })
    } catch (err) {
      toast({
        title: 'Failed to remove',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Player portal</DialogTitle>
          <DialogDescription>
            Manage portal access for this player and their guardian.
          </DialogDescription>
        </DialogHeader>

        {/* Player block */}
        <div className="rounded border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs">
                {getInitials(user.full_name, user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{user.full_name || 'Unnamed Player'}</span>
                <PlayerStatusBadge user={user} />
              </div>
              <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                <Mail className="h-3 w-3" /> {user.email}
              </div>
              {!user.is_invite && user.last_login_at && (
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Last login {formatDate(user.last_login_at)}
                </div>
              )}
              {user.is_invite && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                  Invited {formatDate(user.created_at)} — awaiting password setup
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Guardian block */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-300 uppercase">
            Guardian
          </h4>

          {!playerActive && (
            <p className="text-xs text-slate-500 italic">
              Player must activate their portal first before a guardian can be
              invited.
            </p>
          )}

          {playerActive && !parentEmail && (
            <p className="text-xs text-slate-500 italic">
              No parent/guardian email on this contact. Add one from the
              contact&apos;s detail panel to invite a guardian.
            </p>
          )}

          {playerActive && parentEmail && (
            <div className="rounded border border-slate-200 dark:border-slate-700 p-3">
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
                      disabled={inviteGuardian.isPending}
                      onClick={handleInvite}
                    >
                      {inviteGuardian.isPending ? (
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
                      disabled={removeGuardian.isPending}
                      onClick={handleRemove}
                      title="Remove guardian access"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row sm:justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => {
              onDelete(user as unknown as User)
              onClose()
            }}
            disabled={user.is_invite}
            title={user.is_invite ? 'Cancel the invite to remove' : undefined}
          >
            <UserX className="h-3.5 w-3.5 mr-1.5" />
            Delete player
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
