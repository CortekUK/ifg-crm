'use client'

import { useState, useMemo } from 'react'
import { UsersPageHeader } from '@/components/users/UsersPageHeader'
import { UsersFilters, UsersFiltersState } from '@/components/users/UsersFilters'
import { UsersTable } from '@/components/users/UsersTable'
import { InviteUserModal } from '@/components/users/InviteUserModal'
import { EditUserModal } from '@/components/users/EditUserModal'
import { useUsers, useUpdateUser } from '@/lib/hooks/useUsers'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import type { User } from '@/lib/types/users'

export default function UsersPage() {
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [filters, setFilters] = useState<UsersFiltersState>({
    search: '',
    role: 'all',
    status: 'all',
  })

  const { data: users = [], isLoading } = useUsers()
  const updateUser = useUpdateUser()

  // Debounce search
  const debouncedSearch = useDebouncedValue(filters.search, 300)

  // Filter users based on search, role, and status
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
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

      // Status filter
      if (filters.status === 'active' && !user.is_active) return false
      if (filters.status === 'inactive' && user.is_active) return false

      return true
    })
  }, [users, debouncedSearch, filters.role, filters.status])

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

      {/* Filters */}
      <UsersFilters filters={filters} onFiltersChange={setFilters} />

      {/* Users Table */}
      <UsersTable
        users={filteredUsers}
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
