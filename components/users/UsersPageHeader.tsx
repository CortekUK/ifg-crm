'use client'

import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'

interface UsersPageHeaderProps {
  onInviteClick: () => void
}

export function UsersPageHeader({ onInviteClick }: UsersPageHeaderProps) {
  return (
    <div className="banner-gradient rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-white/90 text-base">
          Manage team members and their permissions.
        </p>

        <Button
          onClick={onInviteClick}
          className="bg-white text-blue-600 hover:bg-blue-50"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>
    </div>
  )
}
