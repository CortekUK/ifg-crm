'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Users } from 'lucide-react'
import { PlayerCard } from './PlayerCard'
import type { Player } from '@/lib/types/players'

interface PlayersGridProps {
  players: Player[]
  isLoading: boolean
  onViewProfile: (player: Player) => void
  onEmailClick: (player: Player) => void
  onSMSClick: (player: Player) => void
}

export function PlayersGrid({
  players,
  isLoading,
  onViewProfile,
  onEmailClick,
  onSMSClick,
}: PlayersGridProps) {
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

  if (players.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No players found</h3>
        <p className="text-muted-foreground">
          Try adjusting your filters or add a new player.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {players.map((player) => (
        <PlayerCard
          key={player.id}
          player={player}
          onViewProfile={onViewProfile}
          onEmailClick={onEmailClick}
          onSMSClick={onSMSClick}
        />
      ))}
    </div>
  )
}
