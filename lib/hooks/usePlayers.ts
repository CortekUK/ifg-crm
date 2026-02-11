import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Player, PlayerFilters, PlayerStats, PlayerDeal } from '@/lib/types/players'
import type { ContactTag } from '@/lib/types/contacts'

// PostgREST has URL length limits; chunk .in() to avoid exceeding them
const IN_CHUNK_SIZE = 200
// Supabase returns max 1000 rows per request; paginate to get all
const PAGE_SIZE = 1000

async function fetchAllPlayerIds(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const allIds: string[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('contact_lists')
      .select('contact_id')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break
    allIds.push(...data.map((e) => e.contact_id))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return [...new Set(allIds)]
}

export function usePlayers(filters?: PlayerFilters) {
  const supabase = createClient()

  return useQuery<{ players: Player[]; total: number }>({
    queryKey: ['players', filters],
    queryFn: async () => {
      // Players = contacts that belong to at least one list
      let playerIds = await fetchAllPlayerIds(supabase)

      if (playerIds.length === 0) {
        return { players: [], total: 0 }
      }

      // Filter by tag if specified
      if (filters?.tagId && filters.tagId !== 'all') {
        const { data: tagEntries, error: tagError } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .eq('tag_id', filters.tagId)

        if (tagError) throw tagError
        const tagContactIds = new Set((tagEntries || []).map((e) => e.contact_id))
        playerIds = playerIds.filter((id) => tagContactIds.has(id))
        if (playerIds.length === 0) {
          return { players: [], total: 0 }
        }
      }

      // Chunk playerIds to avoid PostgREST URL length limits
      const buildQuery = (ids: string[]) => {
        let q = supabase
          .from('contacts')
          .select('*', { count: 'exact' })
          .in('id', ids)

        if (filters?.search) {
          q = q.or(
            `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
          )
        }
        if (filters?.graduationYear && filters.graduationYear !== 'all') {
          q = q.eq('graduation_year', filters.graduationYear)
        }
        if (filters?.gender && filters.gender !== 'all') {
          q = q.eq('gender', filters.gender)
        }
        if (filters?.country && filters.country !== 'all') {
          q = q.eq('country', filters.country)
        }
        if (filters?.position && filters.position !== 'all') {
          q = q.eq('position', filters.position)
        }
        if (filters?.status && filters.status !== 'all') {
          q = q.eq('subscription_status', filters.status)
        }
        if (filters?.ownerId && filters.ownerId !== 'all') {
          q = q.eq('owner_id', filters.ownerId)
        }

        return q.order('created_at', { ascending: false })
      }

      let players: Player[] = []
      let totalCount = 0

      // Run chunked queries in parallel
      const chunks: string[][] = []
      for (let c = 0; c < playerIds.length; c += IN_CHUNK_SIZE) {
        chunks.push(playerIds.slice(c, c + IN_CHUNK_SIZE))
      }

      const results = await Promise.all(chunks.map((chunk) => buildQuery(chunk)))
      for (const { data, error, count } of results) {
        if (error) throw error
        players.push(...(data || []))
        totalCount += (count || 0)
      }

      // Sort combined results
      players.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // Apply pagination after combining & sorting
      if (filters?.page && filters?.pageSize) {
        const from = (filters.page - 1) * filters.pageSize
        players = players.slice(from, from + filters.pageSize)
      }

      // Batch-fetch tags for all returned players (also chunked)
      if (players.length > 0) {
        const tagsByContact = new Map<string, ContactTag[]>()
        const idChunks: string[][] = []
        const allIds = players.map((p) => p.id)
        for (let c = 0; c < allIds.length; c += IN_CHUNK_SIZE) {
          idChunks.push(allIds.slice(c, c + IN_CHUNK_SIZE))
        }

        const tagResults = await Promise.all(
          idChunks.map((chunk) =>
            supabase
              .from('contact_tags')
              .select('contact_id, tag:tags(id, name, color, category)')
              .in('contact_id', chunk)
          )
        )

        for (const { data: tagData } of tagResults) {
          if (tagData) {
            for (const row of tagData) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const tag = (row as any).tag as ContactTag | null
              if (tag) {
                const existing = tagsByContact.get(row.contact_id) || []
                existing.push(tag)
                tagsByContact.set(row.contact_id, existing)
              }
            }
          }
        }

        for (const player of players) {
          player.tags = tagsByContact.get(player.id) || []
        }
      }

      return { players, total: totalCount }
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
        .select(`
          *,
          owner:profiles!owner_id(id, full_name, email, calendly_url)
        `)
        .eq('id', playerId)
        .single()

      if (error) throw error
      return data as Player
    },
    enabled: !!playerId,
  })
}

export function usePlayerStats() {
  const supabase = createClient()

  return useQuery<PlayerStats>({
    queryKey: ['player-stats'],
    queryFn: async () => {
      // Players = contacts that belong to at least one list
      const playerIds = await fetchAllPlayerIds(supabase)
      const totalPlayers = playerIds.length

      if (totalPlayers === 0) {
        return {
          totalPlayers: 0,
          activeInPipeline: 0,
          graduatingThisYear: 0,
          usPlayers: 0,
        }
      }

      // Chunk playerIds for queries
      const chunks: string[][] = []
      for (let c = 0; c < playerIds.length; c += IN_CHUNK_SIZE) {
        chunks.push(playerIds.slice(c, c + IN_CHUNK_SIZE))
      }

      // Active in pipeline (players with deals)
      const pipelineResults = await Promise.all(
        chunks.map((chunk) =>
          supabase.from('deals').select('contact_id', { count: 'exact', head: true }).in('contact_id', chunk)
        )
      )
      const activeInPipeline = pipelineResults.reduce((sum, r) => sum + (r.count || 0), 0)

      // Graduating this year
      const currentYear = new Date().getFullYear()
      const gradResults = await Promise.all(
        chunks.map((chunk) =>
          supabase.from('contacts').select('*', { count: 'exact', head: true }).in('id', chunk).eq('graduation_year', currentYear)
        )
      )
      const graduatingThisYear = gradResults.reduce((sum, r) => sum + (r.count || 0), 0)

      // US Players
      const usResults = await Promise.all(
        chunks.map((chunk) =>
          supabase.from('contacts').select('*', { count: 'exact', head: true }).in('id', chunk).eq('country', 'United States')
        )
      )
      const usPlayersCount = usResults.reduce((sum, r) => sum + (r.count || 0), 0)

      return {
        totalPlayers,
        activeInPipeline,
        graduatingThisYear,
        usPlayers: usPlayersCount,
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
      const playerIds = await fetchAllPlayerIds(supabase)
      if (playerIds.length === 0) return []

      const chunks: string[][] = []
      for (let c = 0; c < playerIds.length; c += IN_CHUNK_SIZE) {
        chunks.push(playerIds.slice(c, c + IN_CHUNK_SIZE))
      }

      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase.from('contacts').select('position').in('id', chunk).not('position', 'is', null)
        )
      )

      const allPositions: string[] = []
      for (const { data, error } of results) {
        if (error) throw error
        allPositions.push(...(data?.map((d) => d.position).filter(Boolean) || []))
      }

      return [...new Set(allPositions)].sort()
    },
  })
}

export function useDistinctCountries() {
  const supabase = createClient()

  return useQuery<string[]>({
    queryKey: ['distinct-countries'],
    queryFn: async () => {
      const playerIds = await fetchAllPlayerIds(supabase)
      if (playerIds.length === 0) return []

      const chunks: string[][] = []
      for (let c = 0; c < playerIds.length; c += IN_CHUNK_SIZE) {
        chunks.push(playerIds.slice(c, c + IN_CHUNK_SIZE))
      }

      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase.from('contacts').select('country').in('id', chunk).not('country', 'is', null)
        )
      )

      const allCountries: string[] = []
      for (const { data, error } of results) {
        if (error) throw error
        allCountries.push(...(data?.map((d) => d.country).filter(Boolean) || []))
      }

      return [...new Set(allCountries)].sort()
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

export function useUpdatePlayer() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ playerId, updates }: { playerId: string; updates: Partial<Player> }) => {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', playerId)
        .select()
        .single()

      if (error) {
        console.error('Supabase update error:', JSON.stringify(error, null, 2))
        // Provide specific error messages for unique constraint violations
        const errorCode = String(error.code || '')
        const errorMessage = String(error.message || '')

        if (
          errorCode === '23505' ||
          errorCode === '409' ||
          errorMessage.toLowerCase().includes('duplicate') ||
          errorMessage.toLowerCase().includes('unique') ||
          errorMessage.toLowerCase().includes('already exists') ||
          errorMessage.toLowerCase().includes('violates unique constraint')
        ) {
          throw new Error('This email address is already in use by another player')
        }
        throw new Error(errorMessage || 'Failed to update player')
      }
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['player', variables.playerId] })
      queryClient.invalidateQueries({ queryKey: ['player-stats'] })
    },
  })
}

interface PlayerActivity {
  id: string
  activity_type: string
  description: string | null
  created_at: string
  performed_by?: {
    full_name: string | null
    email: string
  } | null
}

export function usePlayerActivities(playerId: string | null) {
  const supabase = createClient()

  return useQuery<PlayerActivity[]>({
    queryKey: ['player-activities', playerId],
    queryFn: async () => {
      if (!playerId) return []

      // Get activities from deal_activities for deals associated with this player
      const { data: deals } = await supabase
        .from('deals')
        .select('id')
        .eq('contact_id', playerId)

      if (!deals || deals.length === 0) return []

      const dealIds = deals.map((d) => d.id)

      const { data, error } = await supabase
        .from('deal_activities')
        .select(`
          id,
          activity_type,
          description,
          created_at,
          user_id
        `)
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      if (!data || data.length === 0) return []

      // Fetch user info separately
      const userIds = [...new Set(data.map(a => a.user_id).filter(Boolean))]
      let usersMap = new Map<string, { full_name: string | null; email: string }>()
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds)
        usersMap = new Map(users?.map(u => [u.id, { full_name: u.full_name, email: u.email }]) || [])
      }

      return data.map(activity => ({
        id: activity.id,
        activity_type: activity.activity_type,
        description: activity.description,
        created_at: activity.created_at,
        performed_by: activity.user_id ? usersMap.get(activity.user_id) || null : null,
      }))
    },
    enabled: !!playerId,
  })
}
