'use client'

import { useState } from 'react'
import { PlayersPageHeader } from '@/components/players/PlayersPageHeader'
import { PlayerStats } from '@/components/players/PlayerStats'
import { PlayerFilters } from '@/components/players/PlayerFilters'
import { PlayersGrid } from '@/components/players/PlayersGrid'
import { PlayersTable } from '@/components/players/PlayersTable'
import { PlayerDetailSheet } from '@/components/players/PlayerDetailSheet'
import { AddPlayerModal } from '@/components/players/AddPlayerModal'
import { EditPlayerModal } from '@/components/players/EditPlayerModal'
import {
  usePlayers,
  usePlayerStats,
  useDistinctPositions,
  useDistinctCountries,
} from '@/lib/hooks/usePlayers'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import type { PlayerFilters as PlayerFiltersType, Player } from '@/lib/types/players'

export default function PlayersPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [filters, setFilters] = useState<PlayerFiltersType>({})
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)

  // Debounce search
  const debouncedFilters = {
    ...filters,
    search: useDebouncedValue(filters.search || '', 300),
  }

  // Fetch data
  const { data, isLoading } = usePlayers(debouncedFilters)
  const { data: stats, isLoading: statsLoading } = usePlayerStats()
  const { data: positions = [] } = useDistinctPositions()
  const { data: countries = [] } = useDistinctCountries()

  const players = data?.players || []

  const handleViewProfile = (player: Player) => {
    setSelectedPlayer(player)
  }

  const handleEmailClick = (player: Player) => {
    window.location.href = `mailto:${player.email}`
  }

  const handleSMSClick = (player: Player) => {
    if (player.phone) {
      window.location.href = `sms:${player.phone}`
    }
  }

  const handleImport = () => {
    console.log('Import CSV clicked')
  }

  const handleExport = () => {
    console.log('Export clicked')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PlayersPageHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddClick={() => setAddModalOpen(true)}
        onImportClick={handleImport}
        onExportClick={handleExport}
      />

      {/* Stats */}
      <PlayerStats
        totalPlayers={stats?.totalPlayers || 0}
        activeInPipeline={stats?.activeInPipeline || 0}
        graduatingThisYear={stats?.graduatingThisYear || 0}
        usPlayers={stats?.usPlayers || 0}
        isLoading={statsLoading}
      />

      {/* Filters */}
      <PlayerFilters
        filters={filters}
        onFiltersChange={setFilters}
        positions={positions}
        countries={countries}
      />

      {/* Players Grid or Table */}
      {viewMode === 'grid' ? (
        <PlayersGrid
          players={players}
          isLoading={isLoading}
          onViewProfile={handleViewProfile}
          onEmailClick={handleEmailClick}
          onSMSClick={handleSMSClick}
        />
      ) : (
        <PlayersTable
          players={players}
          isLoading={isLoading}
          onViewProfile={handleViewProfile}
          onEmailClick={handleEmailClick}
          onSMSClick={handleSMSClick}
        />
      )}

      {/* Player Detail Sheet */}
      <PlayerDetailSheet
        playerId={selectedPlayer?.id || null}
        isOpen={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        onEdit={(player) => {
          setSelectedPlayer(null)
          setEditingPlayer(player)
        }}
      />

      {/* Add Player Modal */}
      <AddPlayerModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />

      {/* Edit Player Modal */}
      <EditPlayerModal
        player={editingPlayer}
        isOpen={!!editingPlayer}
        onClose={() => setEditingPlayer(null)}
      />
    </div>
  )
}
