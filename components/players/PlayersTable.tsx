'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Mail, Phone, Users } from 'lucide-react'
import type { Player } from '@/lib/types/players'

interface PlayersTableProps {
  players: Player[]
  isLoading: boolean
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

export function PlayersTable({
  players,
  isLoading,
  onViewProfile,
  onEmailClick,
  onSMSClick,
}: PlayersTableProps) {
  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Club</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>GPA</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-10 w-36" /></TableCell>
                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (players.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center bg-white dark:bg-slate-900 dark:border-slate-700">
        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No players found</h3>
        <p className="text-muted-foreground">
          Try adjusting your filters or add a new player.
        </p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Year</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Club</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>GPA</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => {
            const fullName = `${player.first_name} ${player.last_name}`
            const initials = `${player.first_name?.[0] || ''}${player.last_name?.[0] || ''}`.toUpperCase()
            const avatarColour = getAvatarColour(fullName)
            const location = [player.city, player.state, player.country]
              .filter(Boolean)
              .slice(0, 2)
              .join(', ')

            return (
              <TableRow
                key={player.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onViewProfile(player)}
              >
                {/* Player */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={`${avatarColour} text-white text-xs`}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{fullName}</span>
                  </div>
                </TableCell>

                {/* Email */}
                <TableCell className="text-sm text-muted-foreground">
                  {player.email}
                </TableCell>

                {/* Phone */}
                <TableCell className="text-sm text-muted-foreground">
                  {player.phone || '—'}
                </TableCell>

                {/* Year */}
                <TableCell>
                  {player.graduation_year || '—'}
                </TableCell>

                {/* Position */}
                <TableCell>
                  {player.position ? (
                    <Badge variant="secondary" className="text-xs">
                      {player.position}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </TableCell>

                {/* Club */}
                <TableCell className="text-sm">
                  {player.club_name || '—'}
                </TableCell>

                {/* Location */}
                <TableCell className="text-sm text-muted-foreground">
                  {location || '—'}
                </TableCell>

                {/* GPA */}
                <TableCell className="text-sm">
                  {player.gpa ? player.gpa.toFixed(2) : '—'}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge
                    className={
                      player.subscription_status === 'subscribed'
                        ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }
                  >
                    {player.subscription_status === 'subscribed' ? 'Subscribed' : 'Unsubscribed'}
                  </Badge>
                </TableCell>

                {/* Actions */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewProfile(player)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEmailClick(player)}>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Email
                      </DropdownMenuItem>
                      {player.phone && (
                        <DropdownMenuItem onClick={() => onSMSClick(player)}>
                          <Phone className="h-4 w-4 mr-2" />
                          Send SMS
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
