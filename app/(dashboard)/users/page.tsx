'use client'

import { useState, useMemo } from 'react'
import { UsersPageHeader } from '@/components/users/UsersPageHeader'
import { UsersFilters, UsersFiltersState } from '@/components/users/UsersFilters'
import { UsersTable } from '@/components/users/UsersTable'
import { InviteUserModal } from '@/components/users/InviteUserModal'
import { EditUserModal } from '@/components/users/EditUserModal'
import { DeleteUserModal } from '@/components/users/DeleteUserModal'
import { useUsersAndInvites, useUpdateUser, useDeleteUser } from '@/lib/hooks/useUsers'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'
import type { User, UserOrInvite } from '@/lib/types/users'

export default function UsersPage() {
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [filters, setFilters] = useState<UsersFiltersState>({
    search: '',
    role: 'all',
    status: 'all',
  })

  const { data: usersAndInvites = [], isLoading, refetch } = useUsersAndInvites()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const supabase = createClient()

  // Debounce search
  const debouncedSearch = useDebouncedValue(filters.search, 300)

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

  const handleDeactivate = async (user: User) => {
    const action = user.is_active ? 'deactivate' : 'activate'
    if (confirm(`Are you sure you want to ${action} ${user.full_name || user.email}?`)) {
      try {
        await updateUser.mutateAsync({
          userId: user.id,
          updates: { is_active: !user.is_active },
        })
      } catch (error) {
        console.error(`Failed to ${action} user:`, error)
      }
    }
  }

  const handleCancelInvite = async (invite: UserOrInvite) => {
    if (!invite.is_invite) return
    if (confirm(`Are you sure you want to cancel the invitation for ${invite.email}?`)) {
      try {
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
      } catch (error) {
        console.error('Failed to cancel invite:', error)
        toast({
          title: 'Failed to cancel invitation',
          description: 'An error occurred while cancelling the invitation.',
          variant: 'destructive',
        })
      }
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
        onEdit={handleEdit}
        onDeactivate={handleDeactivate}
        onDelete={handleDelete}
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
    </div>
  )
}
