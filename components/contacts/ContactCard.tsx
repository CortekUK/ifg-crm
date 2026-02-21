'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Mail, Phone, MapPin, Building2 } from 'lucide-react'
import type { Contact } from '@/lib/types/contacts'

interface ContactCardProps {
  contact: Contact
  onViewProfile: (contact: Contact) => void
  onEmailClick: (contact: Contact) => void
  onSMSClick: (contact: Contact) => void
}

const getAvatarColour = (name: string) => {
  const colours = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500',
  ]
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colours[hash % colours.length]
}

export function ContactCard({
  contact,
  onViewProfile,
  onEmailClick,
  onSMSClick,
}: ContactCardProps) {
  const fullName = `${contact.first_name} ${contact.last_name}`
  const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase()
  const avatarColour = getAvatarColour(fullName)

  const location = [contact.city, contact.state, contact.country]
    .filter(Boolean)
    .join(', ')

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onViewProfile(contact)}>
      <CardContent className="p-4">
        <div className="flex flex-col items-center text-center mb-4">
          <Avatar className="h-16 w-16 mb-3">
            <AvatarFallback className={`${avatarColour} text-white text-lg font-medium`}>
              {initials}
            </AvatarFallback>
          </Avatar>

          <h3 className="font-semibold text-gray-900 dark:text-white">{fullName}</h3>

          <div className="flex flex-wrap gap-1 mt-2 justify-center">
            {contact.position && (
              <Badge variant="secondary" className="text-xs">
                {contact.position}
              </Badge>
            )}
            {contact.graduation_year && (
              <Badge variant="outline" className="text-xs">
                Class of {contact.graduation_year}
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          )}

          {contact.club_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{contact.club_name}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{contact.email}</span>
          </div>

          {contact.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{contact.phone}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation()
              onViewProfile(contact)
            }}
          >
            View Profile
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onEmailClick(contact)
            }}
          >
            <Mail className="h-4 w-4" />
          </Button>
          {contact.phone && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                onSMSClick(contact)
              }}
            >
              <Phone className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
