'use client'

import { useState, useMemo } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UsersPageHeader } from '@/components/users/UsersPageHeader'
import { UsersFilters, UsersFiltersState } from '@/components/users/UsersFilters'
import { UsersTable } from '@/components/users/UsersTable'
import { PlayerPortalDialog } from '@/components/users/PlayerPortalDialog'
import { InviteUserModal } from '@/components/users/InviteUserModal'
import { EditUserModal } from '@/components/users/EditUserModal'
import { DeleteUserModal } from '@/components/users/DeleteUserModal'
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
import { Loader2 } from 'lucide-react'
import { useUsersAndInvites, useUpdateUser, useDeleteUser, useInviteUser } from '@/lib/hooks/useUsers'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'
import type { User, UserOrInvite } from '@/lib/types/users'

type ConfirmAction =
  | { type: 'deactivate'; user: User }
  | { type: 'cancel-invite'; invite: UserOrInvite }

export default function UsersPage() {
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [playerDialogUser, setPlayerDialogUser] = useState<UserOrInvite | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [isConfirmLoading, setIsConfirmLoading] = useState(false)
  const [filters, setFilters] = useState<UsersFiltersState>({
    search: '',
    role: 'all',
    status: 'all',
  })
  const [activeTab, setActiveTab] = useState<'staff' | 'players'>('staff')

  const { data: usersAndInvites = [], isLoading, refetch } = useUsersAndInvites()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const inviteUser = useInviteUser()
  const supabase = createClient()

  // Debounce search
  const debouncedSearch = useDebouncedValue(filters.search, 300)

  const hasActiveFilters = debouncedSearch !== '' || filters.role !== 'all' || filters.status !== 'all'

  // Separate staff and players
  const staffUsers = useMemo(() =>
    usersAndInvites.filter((u) => u.role !== 'player'),
    [usersAndInvites]
  )
  // Players tab counts and lists exclude guardian profiles (those have
  // guardian_for_contact_id set). Guardians live inside the player dialog.
  const playerUsers = useMemo(() =>
    usersAndInvites.filter(
      (u) => u.role === 'player' && !u.guardian_for_contact_id
    ),
    [usersAndInvites]
  )

  const currentList = activeTab === 'staff' ? staffUsers : playerUsers

  // Filter users based on search, role, and status
  const filteredUsers = useMemo(() => {
    return currentList.filter((user) => {
      // Search filter
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase()
        const matchesName = user.full_name?.toLowerCase().includes(searchLower)
        const matchesEmail = user.email.toLowerCase().includes(searchLower)
        if (!matchesName && !matchesEmail) return false
      }

      // Role filter
      if (filters.role !== 'all' && user.role !== filters.role) {
        return false
      }

      // Status filter - pending invites shown with all statuses or 'pending'
      if (filters.status === 'active' && (user.is_invite || !user.is_active)) return false
      if (filters.status === 'inactive' && (user.is_invite || user.is_active)) return false
      if (filters.status === 'pending' && !user.is_invite) return false

      return true
    })
  }, [currentList, debouncedSearch, filters.role, filters.status])

  const handleEdit = (user: User) => {
    setEditingUser(user)
  }

  const handleDeactivate = (user: User) => {
    setConfirmAction({ type: 'deactivate', user })
  }

  const handleCancelInvite = (invite: UserOrInvite) => {
    if (!invite.is_invite) return
    setConfirmAction({ type: 'cancel-invite', invite })
  }

  const handleResendInvite = async (invite: UserOrInvite) => {
    if (!invite.is_invite) return

    try {
      // Player invites are surfaced from unconfirmed profile rows (not user_invites),
      // so they go through the dedicated portal endpoint with contact_id.
      // Guardian profiles point at the player's contact via guardian_for_contact_id;
      // we route those through the same endpoint with invite_guardian:true.
      if (invite.role === 'player') {
        const isGuardian = !!invite.guardian_for_contact_id
        const targetContactId = isGuardian
          ? invite.guardian_for_contact_id!
          : invite.contact_id
        if (!targetContactId) {
          throw new Error('Player invite is missing contact link')
        }
        const res = await fetch('/api/portal/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_id: targetContactId,
            invite_guardian: isGuardian,
            resend: true,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to resend invitation')
      } else {
        await inviteUser.mutateAsync({
          email: invite.email,
          fullName: invite.full_name || '',
          role: invite.role,
          title: invite.title || undefined,
          pipelineIds: invite.pipeline_assignments,
        })
      }

      toast({
        title: 'Invitation resent',
        description: `A new invitation has been sent to ${invite.email}.`,
      })
      refetch()
    } catch (error) {
      console.error('Failed to resend invite:', error)
      toast({
        title: 'Failed to resend invitation',
        description: error instanceof Error ? error.message : 'An error occurred while resending the invitation.',
        variant: 'destructive',
      })
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return

    setIsConfirmLoading(true)
    try {
      if (confirmAction.type === 'deactivate') {
        const { user } = confirmAction
        const action = user.is_active ? 'deactivated' : 'activated'
        await updateUser.mutateAsync({
          userId: user.id,
          updates: { is_active: !user.is_active },
        })
        toast({
          title: `User ${action}`,
          description: `${user.full_name || user.email} has been ${action}.`,
        })
      } else if (confirmAction.type === 'cancel-invite') {
        const { invite } = confirmAction

        // Player "invites" are profile rows (unconfirmed). Cancel = full delete
        // of the auth user, which cascades the profile + player_invites row.
        if (invite.role === 'player') {
          await deleteUser.mutateAsync(invite.id)
        } else {
          // A staff invite ALSO created an unconfirmed auth user + profile
          // (via generateLink at invite time). That profile is hidden in the
          // list only while the user_invites row exists — so deleting just the
          // invite row would unmask it as an "Active" user. Delete the whole
          // account instead; DELETE /api/users/[id] also clears the
          // user_invites rows for that email. Fall back to a plain invite-row
          // delete if no profile was created (e.g. link generation failed).
          // ilike, not eq: emails were stored with whatever case was typed,
          // so an exact match could miss the very profile this is about to
          // reason over.
          //
          // password_set_at is the guard that matters. Without it, cancelling
          // a duplicate invite raised against someone who had ALREADY joined
          // would delete their live account, auth user and all — the invite
          // shell and a working user are indistinguishable by email alone.
          const { data: pendingProfile } = await supabase
            .from('profiles')
            .select('id, password_set_at')
            .ilike('email', invite.email)
            .maybeSingle()

          if (pendingProfile?.id && !pendingProfile.password_set_at) {
            await deleteUser.mutateAsync(pendingProfile.id)
          } else {
            // Either no profile was created, or one exists but belongs to an
            // active user — in both cases only the invite row should go.
            const { error } = await supabase
              .from('user_invites')
              .delete()
              .eq('id', invite.id)

            if (error) throw error
          }
        }

        toast({
          title: 'Invitation cancelled',
          description: `The invitation for ${invite.email} has been cancelled.`,
        })
        refetch()
      }
    } catch (error) {
      console.error('Action failed:', error)
      const errorMsg = confirmAction.type === 'deactivate'
        ? 'Failed to update user status.'
        : 'Failed to cancel invitation.'
      toast({
        title: 'Action failed',
        description: error instanceof Error ? error.message : errorMsg,
        variant: 'destructive',
      })
    } finally {
      setIsConfirmLoading(false)
      setConfirmAction(null)
    }
  }

  const handleDelete = (user: User) => {
    setDeletingUser(user)
  }

  const handleConfirmDelete = async () => {
    if (!deletingUser) return

    try {
      await deleteUser.mutateAsync(deletingUser.id)
      toast({
        title: 'User deleted',
        description: `${deletingUser.full_name || deletingUser.email} has been permanently deleted.`,
      })
      setDeletingUser(null)
    } catch (error) {
      console.error('Failed to delete user:', error)
      toast({
        title: 'Failed to delete user',
        description: error instanceof Error ? error.message : 'An error occurred while deleting the user.',
        variant: 'destructive',
      })
    }
  }

  // Build confirm dialog content
  const confirmTitle = confirmAction?.type === 'deactivate'
    ? confirmAction.user.is_active ? 'Deactivate User' : 'Activate User'
    : 'Cancel Invitation'

  const confirmDescription = confirmAction?.type === 'deactivate'
    ? confirmAction.user.is_active
      ? `Are you sure you want to deactivate ${confirmAction.user.full_name || confirmAction.user.email}? They will no longer be able to access the system.`
      : `Are you sure you want to activate ${confirmAction.user.full_name || confirmAction.user.email}? They will regain access to the system.`
    : confirmAction?.type === 'cancel-invite'
      ? `Are you sure you want to cancel the invitation for ${confirmAction.invite.email}?`
      : ''

  return (
    <div className="space-y-6">
      {/* Page Header — only on Staff tab. Players are invited from the
          contact sheet, not via this page. */}
      {activeTab === 'staff' && (
        <UsersPageHeader onInviteClick={() => setInviteModalOpen(true)} />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'staff' | 'players')}>
        <TabsList>
          <TabsTrigger value="staff">
            Staff ({staffUsers.length})
          </TabsTrigger>
          <TabsTrigger value="players">
            Players ({playerUsers.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <UsersFilters
        filters={filters}
        onFiltersChange={setFilters}
        showRoleFilter={activeTab === 'staff'}
      />

      {/* Users Table — for players, row click opens PlayerPortalDialog instead
          of EditUserModal so admin can manage guardian access from the same place. */}
      <UsersTable
        users={filteredUsers}
        isLoading={isLoading}
        hasActiveFilters={hasActiveFilters}
        onEdit={
          activeTab === 'players'
            ? (user) => setPlayerDialogUser(user as unknown as UserOrInvite)
            : handleEdit
        }
        onDeactivate={handleDeactivate}
        onDelete={handleDelete}
        onResendInvite={handleResendInvite}
        onCancelInvite={handleCancelInvite}
      />

      {/* Invite User Modal */}
      <InviteUserModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />

      {/* Edit User Modal */}
      <EditUserModal
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
      />

      {/* Player Portal Dialog — opened on player row click; shows guardian inline */}
      <PlayerPortalDialog
        user={playerDialogUser}
        onClose={() => setPlayerDialogUser(null)}
        onDelete={(u) => setDeletingUser(u)}
      />

      {/* Delete User Confirmation Modal */}
      <DeleteUserModal
        user={deletingUser}
        isOpen={!!deletingUser}
        isDeleting={deleteUser.isPending}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Deactivate / Cancel Invite Confirmation */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirmLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={isConfirmLoading}
              className={confirmAction?.type === 'cancel-invite' || (confirmAction?.type === 'deactivate' && confirmAction.user.is_active)
                ? 'bg-red-600 hover:bg-red-700'
                : ''
              }
            >
              {isConfirmLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
