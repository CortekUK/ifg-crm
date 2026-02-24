'use client'

import { useState, useMemo } from 'react'
import { UsersPageHeader } from '@/components/users/UsersPageHeader'
import { UsersFilters, UsersFiltersState } from '@/components/users/UsersFilters'
import { UsersTable } from '@/components/users/UsersTable'
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
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [isConfirmLoading, setIsConfirmLoading] = useState(false)
  const [filters, setFilters] = useState<UsersFiltersState>({
    search: '',
    role: 'all',
    status: 'all',
  })

  const { data: usersAndInvites = [], isLoading, refetch } = useUsersAndInvites()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const inviteUser = useInviteUser()
  const supabase = createClient()

  // Debounce search
  const debouncedSearch = useDebouncedValue(filters.search, 300)

  const hasActiveFilters = debouncedSearch !== '' || filters.role !== 'all' || filters.status !== 'all'

  // Filter users based on search, role, and status
  const filteredUsers = useMemo(() => {
    return usersAndInvites.filter((user) => {
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
  }, [usersAndInvites, debouncedSearch, filters.role, filters.status])

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
      // Re-invite by calling the invite API (will clean up old invite and create new one)
      await inviteUser.mutateAsync({
        email: invite.email,
        fullName: invite.full_name || '',
        role: invite.role,
        title: invite.title || undefined,
        pipelineIds: invite.pipeline_assignments,
      })

      toast({
        title: 'Invitation resent',
        description: `A new invitation has been sent to ${invite.email}.`,
      })
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
        const { error } = await supabase
          .from('user_invites')
          .delete()
          .eq('id', invite.id)

        if (error) throw error

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
      {/* Page Header */}
      <UsersPageHeader onInviteClick={() => setInviteModalOpen(true)} />

      {/* Filters */}
      <UsersFilters filters={filters} onFiltersChange={setFilters} />

      {/* Users Table */}
      <UsersTable
        users={filteredUsers}
        isLoading={isLoading}
        hasActiveFilters={hasActiveFilters}
        onEdit={handleEdit}
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
