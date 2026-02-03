import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Player, PlayerFilters, PlayerStats, PlayerDeal } from '@/lib/types/players'

export function usePlayers(filters?: PlayerFilters) {
  const supabase = createClient()

  return useQuery<{ players: Player[]; total: number }>({
    queryKey: ['players', filters],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .not('graduation_year', 'is', null) // Players have graduation year set

      // Apply filters
      if (filters?.search) {
        query = query.or(
          `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
        )
      }
      if (filters?.graduationYear && filters.graduationYear !== 'all') {
        query = query.eq('graduation_year', filters.graduationYear)
      }
      if (filters?.gender && filters.gender !== 'all') {
        query = query.eq('gender', filters.gender)
      }
      if (filters?.country && filters.country !== 'all') {
        query = query.eq('country', filters.country)
      }
      if (filters?.position && filters.position !== 'all') {
        query = query.eq('position', filters.position)
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('subscription_status', filters.status)
      }

      query = query.order('created_at', { ascending: false })

      const { data, error, count } = await query

      if (error) throw error
      return { players: data || [], total: count || 0 }
    },
  })
}

export function usePlayer(playerId: string | null) {
  const supabase = createClient()

  return useQuery<Player | null>({
    queryKey: ['player', playerId],
    queryFn: async () => {
      if (!playerId) return null

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', playerId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!playerId,
  })
}

export function usePlayerStats() {
  const supabase = createClient()

  return useQuery<PlayerStats>({
    queryKey: ['player-stats'],
    queryFn: async () => {
      // Total players (contacts with graduation_year)
      const { count: totalPlayers } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .not('graduation_year', 'is', null)

      // Active in pipeline (players with deals)
      const { count: activeInPipeline } = await supabase
        .from('deals')
        .select('contact_id', { count: 'exact', head: true })

      // Graduating this year (2026)
      const currentYear = new Date().getFullYear()
      const { count: graduatingThisYear } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('graduation_year', currentYear)

      // US Players
      const { count: usPlayers } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .not('graduation_year', 'is', null)
        .eq('country', 'United States')

      return {
        totalPlayers: totalPlayers || 0,
        activeInPipeline: activeInPipeline || 0,
        graduatingThisYear: graduatingThisYear || 0,
        usPlayers: usPlayers || 0,
      }
    },
  })
}

export function usePlayerDeals(playerId: string | null) {
  const supabase = createClient()

  return useQuery<PlayerDeal[]>({
    queryKey: ['player-deals', playerId],
    queryFn: async () => {
      if (!playerId) return []

      const { data, error } = await supabase
        .from('deals')
        .select(`
          id,
          title,
          deal_value,
          created_at,
          deal_owner_id,
          pipeline:pipelines(id, name),
          stage:pipeline_stages!current_stage_id(id, name, color)
        `)
        .eq('contact_id', playerId)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!data || data.length === 0) return []

      // Fetch owners separately to avoid FK ambiguity
      const ownerIds = [...new Set(data.map(d => d.deal_owner_id).filter(Boolean))]
      let ownersMap = new Map<string, { id: string; full_name: string }>()
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ownerIds)
        ownersMap = new Map(owners?.map(o => [o.id, { id: o.id, full_name: o.full_name || '' }]) || [])
      }

      return data.map(deal => ({
        ...deal,
        owner: ownersMap.get(deal.deal_owner_id) || { id: '', full_name: '' },
      })) as unknown as PlayerDeal[]
    },
    enabled: !!playerId,
  })
}

export function useDistinctPositions() {
  const supabase = createClient()

  return useQuery<string[]>({
    queryKey: ['distinct-positions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('position')
        .not('position', 'is', null)
        .not('graduation_year', 'is', null)

      if (error) throw error

      // Get unique positions
      const positions = [...new Set(data?.map((d) => d.position).filter(Boolean) || [])]
      return positions.sort()
    },
  })
}

export function useDistinctCountries() {
  const supabase = createClient()

  return useQuery<string[]>({
    queryKey: ['distinct-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('country')
        .not('country', 'is', null)
        .not('graduation_year', 'is', null)

      if (error) throw error

      // Get unique countries
      const countries = [...new Set(data?.map((d) => d.country).filter(Boolean) || [])]
      return countries.sort()
    },
  })
}

export function useCreatePlayer() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (player: Partial<Player>) => {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          ...player,
          sport: 'football',
          source: 'manual',
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['player-stats'] })
    },
  })
}
