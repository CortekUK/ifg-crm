'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Mail, Phone, MapPin, Building2 } from 'lucide-react'
import type { Player } from '@/lib/types/players'

interface PlayerCardProps {
  player: Player
  onViewProfile: (player: Player) => void
  onEmailClick: (player: Player) => void
  onSMSClick: (player: Player) => void
}

// Generate consistent colour based on name
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

export function PlayerCard({
  player,
  onViewProfile,
  onEmailClick,
  onSMSClick,
}: PlayerCardProps) {
  const fullName = `${player.first_name} ${player.last_name}`
  const initials = `${player.first_name?.[0] || ''}${player.last_name?.[0] || ''}`.toUpperCase()
  const avatarColour = getAvatarColour(fullName)

  const location = [player.city, player.state, player.country]
    .filter(Boolean)
    .join(', ')

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onViewProfile(player)}>
      <CardContent className="p-4">
        <div className="flex flex-col items-center text-center mb-4">
          {/* Avatar */}
          <Avatar className="h-16 w-16 mb-3">
            <AvatarFallback className={`${avatarColour} text-white text-lg font-medium`}>
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Name */}
          <h3 className="font-semibold text-gray-900">{fullName}</h3>

          {/* Badges */}
          <div className="flex flex-wrap gap-1 mt-2 justify-center">
            {player.position && (
              <Badge variant="secondary" className="text-xs">
                {player.position}
              </Badge>
            )}
            {player.graduation_year && (
              <Badge variant="outline" className="text-xs">
                Class of {player.graduation_year}
              </Badge>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2 text-sm">
          {location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          )}

          {player.club_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{player.club_name}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{player.email}</span>
          </div>

          {player.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{player.phone}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation()
              onViewProfile(player)
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
              onEmailClick(player)
            }}
          >
            <Mail className="h-4 w-4" />
          </Button>
          {player.phone && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                onSMSClick(player)
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
