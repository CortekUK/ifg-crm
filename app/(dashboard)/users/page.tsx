'use client'

import { useState } from 'react'
import { UsersPageHeader } from '@/components/users/UsersPageHeader'
import { UsersTable } from '@/components/users/UsersTable'
import { InviteUserModal } from '@/components/users/InviteUserModal'
import { EditUserModal } from '@/components/users/EditUserModal'
import { useUsers, useUpdateUser } from '@/lib/hooks/useUsers'
import type { User } from '@/lib/types/users'

export default function UsersPage() {
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const { data: users = [], isLoading } = useUsers()
  const updateUser = useUpdateUser()

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <UsersPageHeader onInviteClick={() => setInviteModalOpen(true)} />

      {/* Users Table */}
      <UsersTable
        users={users}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDeactivate={handleDeactivate}
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
    </div>
  )
}
