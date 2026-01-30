'use client'

import { Draggable } from '@hello-pangea/dnd'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatRelativeTime } from '@/lib/utils/format'
import type { Deal } from '@/lib/types/pipelines'

interface DealCardProps {
  deal: Deal
  index: number
  onClick?: () => void
}

// Colour palette for avatar backgrounds
const avatarColours = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-red-500',
]

function getAvatarColour(name: string): string {
  const index = name.charCodeAt(0) % avatarColours.length
  return avatarColours[index]
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function getOwnerInitials(owner: Deal['owner']): string {
  if (!owner) return '?'
  if (owner.full_name) {
    const parts = owner.full_name.split(' ')
    return parts.map((p) => p.charAt(0)).join('').toUpperCase().slice(0, 2)
  }
  return owner.email.slice(0, 2).toUpperCase()
}

export function DealCard({ deal, index, onClick }: DealCardProps) {
  const contact = deal.contact
  const contactName = contact
    ? `${contact.first_name} ${contact.last_name}`
    : deal.title
  const initials = contact
    ? getInitials(contact.first_name, contact.last_name)
    : deal.title.slice(0, 2).toUpperCase()
  const avatarColour = getAvatarColour(contactName)

  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`
            bg-white rounded-lg border p-3 mb-2 cursor-pointer
            hover:shadow-md hover:border-blue-200 transition-all
            ${snapshot.isDragging ? 'shadow-lg border-blue-300 rotate-2' : ''}
          `}
        >
          {/* Contact Info */}
          <div className="flex items-start gap-3">
            <Avatar className={`h-9 w-9 ${avatarColour}`}>
              <AvatarFallback className="text-white text-xs font-medium bg-transparent">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{contactName}</p>
              <p className="text-sm font-semibold text-green-600">
                {formatCurrency(deal.deal_value)}
              </p>
            </div>
          </div>

          {/* Programme Badge */}
          {deal.stage && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs font-normal">
                {contact?.graduation_year || 'N/A'}
              </Badge>
            </div>
          )}

          {/* Footer: Owner + Time */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t">
            <div className="flex items-center gap-1">
              <Avatar className="h-5 w-5 bg-gray-200">
                <AvatarFallback className="text-[10px] text-gray-600 bg-transparent">
                  {getOwnerInitials(deal.owner)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {deal.owner?.full_name?.split(' ')[0] || 'Unassigned'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(deal.created_at)}
            </span>
          </div>
        </div>
      )}
    </Draggable>
  )
}
