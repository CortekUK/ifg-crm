'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Users } from 'lucide-react'
import { ContactCard } from './ContactCard'
import type { Contact } from '@/lib/types/contacts'

interface ContactsGridProps {
  contacts: Contact[]
  isLoading: boolean
  onViewProfile: (contact: Contact) => void
  onEmailClick: (contact: Contact) => void
  onSMSClick: (contact: Contact) => void
}

export function ContactsGrid({
  contacts,
  isLoading,
  onViewProfile,
  onEmailClick,
  onSMSClick,
}: ContactsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="flex flex-col items-center mb-4">
              <Skeleton className="h-16 w-16 rounded-full mb-3" />
              <Skeleton className="h-5 w-32 mb-2" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (contacts.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No contacts found</h3>
        <p className="text-muted-foreground">
          Try adjusting your filters or add a new contact.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {contacts.map((contact) => (
        <ContactCard
          key={contact.id}
          contact={contact}
          onViewProfile={onViewProfile}
          onEmailClick={onEmailClick}
          onSMSClick={onSMSClick}
        />
      ))}
    </div>
  )
}
