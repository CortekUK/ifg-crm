'use client'

import { useState, useEffect } from 'react'
import { PlayersPageHeader } from '@/components/players/PlayersPageHeader'
import { PlayerStats } from '@/components/players/PlayerStats'
import { PlayerFilters } from '@/components/players/PlayerFilters'
import { PlayersGrid } from '@/components/players/PlayersGrid'
import { PlayersTable } from '@/components/players/PlayersTable'
import { PlayerDetailSheet } from '@/components/players/PlayerDetailSheet'
import { AddPlayerModal } from '@/components/players/AddPlayerModal'
import { EditPlayerModal } from '@/components/players/EditPlayerModal'
import { ImportCSVModal } from '@/components/players/ImportCSVModal'
import {
  usePlayers,
  usePlayerStats,
  useDistinctPositions,
  useDistinctCountries,
} from '@/lib/hooks/usePlayers'
import { useTags } from '@/lib/hooks/useContacts'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { TablePagination } from '@/components/ui/table-pagination'
import { createClient } from '@/lib/supabase/client'
import type { PlayerFilters as PlayerFiltersType, Player } from '@/lib/types/players'

export default function PlayersPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [filters, setFilters] = useState<PlayerFiltersType>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  // Debounce search
  const debouncedSearch = useDebouncedValue(filters.search || '', 300)
  const debouncedFilters = {
    ...filters,
    search: debouncedSearch,
    page,
    pageSize,
  }

  // Reset page when filters change
  const handleFiltersChange = (newFilters: PlayerFiltersType) => {
    setFilters(newFilters)
    setPage(1)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1)
  }

  // Fetch data
  const { data, isLoading } = usePlayers(debouncedFilters)
  const { data: stats, isLoading: statsLoading } = usePlayerStats()
  const { data: positions = [] } = useDistinctPositions()
  const { data: countries = [] } = useDistinctCountries()
  const { data: tags = [] } = useTags()

  const players = data?.players || []
  const total = data?.total || 0

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
    setImportModalOpen(true)
  }

  const handleExport = () => {
    if (players.length === 0) return
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Country', 'Position', 'Graduation Year', 'Gender']
    const rows = players.map((p) => [
      p.first_name || '',
      p.last_name || '',
      p.email || '',
      p.phone || '',
      p.country || '',
      p.position || '',
      p.graduation_year?.toString() || '',
      p.gender || '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `players-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
        onFiltersChange={handleFiltersChange}
        positions={positions}
        countries={countries}
        userId={userId}
        tags={tags}
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

      {/* Pagination */}
      {total > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          label="players"
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

      {/* Import CSV Modal */}
      <ImportCSVModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        requireList
      />
    </div>
  )
}
