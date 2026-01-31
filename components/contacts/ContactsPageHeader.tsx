'use client'

import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'

interface ContactsPageHeaderProps {
  onAddContact?: () => void
}

export function ContactsPageHeader({ onAddContact }: ContactsPageHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-900 rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-oswald text-2xl font-bold uppercase text-white tracking-wide">
            Contacts
          </h1>
          <p className="text-white/80 text-sm mt-1">
            Manage your contacts and lists for targeted marketing campaigns.
          </p>
        </div>

        {onAddContact && (
          <Button
            onClick={onAddContact}
            className="bg-white text-blue-600 hover:bg-blue-50"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        )}
      </div>
    </div>
  )
}
