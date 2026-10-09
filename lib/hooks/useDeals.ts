import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchAll } from '@/lib/reports/csv'
import { calculateDaysBetween } from '@/lib/utils/format'
import type { Deal, PipelineStage, Profile } from '@/lib/types/pipelines'

// Days the deal has sat in its current stage.
//
// `stage_changed_at` used to be consulted here as a second option, but no such
// column exists on `deals` — it read as undefined every time, so the chain was
// really stage_entered_at or created_at. Dropped rather than left looking load-bearing.
//
// created_at remains the last resort for deals that predate stage tracking, where
// it reports age-since-created rather than time-in-stage. useMoveDeal now stamps
// stage_entered_at on every move, so that gap closes as deals get touched.
function computeTimeInStage(deal: Deal): number {
  const stageDate = deal.stage_entered_at || deal.created_at
  return calculateDaysBetween(stageDate)
}

/**
 * Every deal in a pipeline — paged, because PostgREST caps a response at 1000
 * rows on this project and refuses with a plain 200 carrying the first 1000.
 * An unpaged read therefore returned the newest 1000 and dropped the oldest
 * deals, which are the ones most likely to be mid-conversation, and nothing on
 * the page could tell: My Deals, search, the status filter and the stats bar
 * all narrow this same array.
 *
 * The supplementary reads are paged too, and filter by pipeline through an
 * `!inner` embed rather than `.in('deal_id', [...ids])`. Two reasons: the id
 * list breaks on URL length past a few hundred deals, and automation_logs was
 * ALREADY hitting the cap at 542 deals (1000 returned of 1980), so
 * "last contacted" was quietly wrong on the busiest board.
 */
export function useDeals(pipelineId: string | null) {
  const supabase = createClient()

  return useQuery<Deal[]>({
    queryKey: ['deals', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return []

      // Fetch deals with their relationships (excluding owner due to FK ambiguity)
      let deals: Deal[]
      try {
        deals = await fetchAll<Deal>(() =>
          supabase
            .from('deals')
            .select(`
              *,
              contact:contacts(id, first_name, last_name, email, phone, graduation_year),
              pipeline:pipelines(*)
            `)
            .eq('pipeline_id', pipelineId)
            .order('created_at', { ascending: false }),
        )
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error('Error fetching deals:', errorMessage)
        throw new Error(`Failed to fetch deals: ${errorMessage}`)
      }
      if (deals.length === 0) return []

      // Fetch all supplementary data in parallel
      const stageIds = [...new Set(deals.map(d => d.current_stage_id).filter(Boolean))]
      const ownerIds = [...new Set(deals.map(d => d.deal_owner_id).filter(Boolean))]

      // Non-fatal reads resolve to [] on failure so a missing activity feed
      // never costs the user their board.
      const soft = async <T>(label: string, run: () => Promise<T[]>): Promise<T[]> => {
        try {
          return await run()
        } catch (err) {
          console.warn(`Failed to fetch ${label}:`, err instanceof Error ? err.message : err)
          return []
        }
      }

      const [stagesData, ownersData, emailLogs, emailActivities, enrollments] = await Promise.all([
        // Stages (using pipeline_stages - the correct table per FK constraint)
        soft('pipeline stages', () =>
          fetchAll<PipelineStage>(() => supabase.from('pipeline_stages').select('*').in('id', stageIds)),
        ),
        // Owners (fetched separately to avoid foreign key ambiguity)
        soft('deal owners', () =>
          fetchAll<Profile>(() =>
            supabase.from('profiles').select('id, email, full_name, role, avatar_url, calendly_url').in('id', ownerIds),
          ),
        ),
        // Last email sent from automation_logs
        soft('automation logs', () =>
          fetchAll<{ deal_id: string; sent_at: string }>(() =>
            supabase
              .from('automation_logs')
              .select('deal_id, sent_at, deal:deals!inner(pipeline_id)')
              .eq('status', 'sent')
              .eq('deal.pipeline_id', pipelineId)
              .order('sent_at', { ascending: false }),
          ),
        ),
        // Email activities
        soft('deal activities', () =>
          fetchAll<{ deal_id: string; created_at: string }>(() =>
            supabase
              .from('deal_activities')
              .select('deal_id, created_at, deal:deals!inner(pipeline_id)')
              .eq('activity_type', 'email_sent')
              .eq('deal.pipeline_id', pipelineId)
              .order('created_at', { ascending: false }),
          ),
        ),
        // Active automation enrollments
        soft('automation enrollments', () =>
          fetchAll<{ deal_id: string }>(() =>
            supabase
              .from('automation_enrollments')
              .select('deal_id, deal:deals!inner(pipeline_id)')
              .eq('status', 'active')
              .eq('deal.pipeline_id', pipelineId),
          ),
        ),
      ])

      const stagesMap = new Map(stagesData.map(s => [s.id, s]))
      const ownersMap = new Map(ownersData.map(o => [o.id, o]))

      // Build a map of deal_id -> last contacted at. Pages are fetched
      // concurrently, so rows can repeat across a shifted page boundary;
      // taking the latest timestamp per deal is insensitive to that.
      const lastContactedMap = new Map<string, string>()
      const noteContact = (dealId: string, at: string) => {
        const existing = lastContactedMap.get(dealId)
        if (!existing || new Date(at) > new Date(existing)) {
          lastContactedMap.set(dealId, at)
        }
      }
      emailLogs.forEach((log) => noteContact(log.deal_id, log.sent_at))
      emailActivities.forEach((activity) => noteContact(activity.deal_id, activity.created_at))

      const activeEnrollmentsSet = new Set<string>(enrollments.map((e) => e.deal_id))

      // Enrich deals with computed fields, stage data, and owner
      return deals.map((deal) => ({
        ...deal,
        stage: stagesMap.get(deal.current_stage_id),
        owner: ownersMap.get(deal.deal_owner_id),
        time_in_stage: computeTimeInStage(deal),
        last_contacted_at: lastContactedMap.get(deal.id) || null,
        has_active_automation: activeEnrollmentsSet.has(deal.id),
      }))
    },
    enabled: !!pipelineId,
  })
}

export function useDeal(dealId: string | null) {
  const supabase = createClient()

  return useQuery<Deal | null>({
    queryKey: ['deal', dealId],
    queryFn: async () => {
      if (!dealId) return null

      const { data: deal, error } = await supabase
        .from('deals')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, phone, graduation_year),
          pipeline:pipelines(*)
        `)
        .eq('id', dealId)
        .single()

      if (error) {
        const errorMessage = error.message || error.details || JSON.stringify(error) || 'Unknown error'
        console.error('Error fetching deal:', errorMessage)
        throw new Error(`Failed to fetch deal: ${errorMessage}`)
      }
      if (!deal) return null

      // Fetch stage separately (using pipeline_stages - the correct table per FK constraint)
      let stage = null
      if (deal.current_stage_id) {
        const { data: stageData } = await supabase
          .from('pipeline_stages')
          .select('*')
          .eq('id', deal.current_stage_id)
          .single()
        stage = stageData
      }

      // Fetch owner separately to avoid foreign key ambiguity
      let owner = null
      if (deal.deal_owner_id) {
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url, calendly_url')
          .eq('id', deal.deal_owner_id)
          .single()
        owner = ownerData
      }

      // Fetch last contacted time for this deal
      const { data: emailLogs } = await supabase
        .from('automation_logs')
        .select('sent_at')
        .eq('deal_id', dealId)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(1)

      const { data: emailActivities } = await supabase
        .from('deal_activities')
        .select('created_at')
        .eq('deal_id', dealId)
        .eq('activity_type', 'email_sent')
        .order('created_at', { ascending: false })
        .limit(1)

      // Determine last contacted date
      let lastContactedAt: string | null = null
      const logDate = emailLogs?.[0]?.sent_at
      const activityDate = emailActivities?.[0]?.created_at

      if (logDate && activityDate) {
        lastContactedAt = new Date(logDate) > new Date(activityDate) ? logDate : activityDate
      } else {
        lastContactedAt = logDate || activityDate || null
      }

      return {
        ...deal,
        stage,
        owner,
        time_in_stage: computeTimeInStage(deal),
        last_contacted_at: lastContactedAt,
      }
    },
    enabled: !!dealId,
  })
}

export function useDealAutomations(dealId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['deal-automations', dealId],
    queryFn: async () => {
      if (!dealId) return []

      const { data, error } = await supabase
        .from('automation_enrollments')
        .select(`
          *,
          automation:automations(id, name, is_active),
          current_step:automation_steps(id, step_order, step_type, conditions)
        `)
        .eq('deal_id', dealId)
        .order('enrolled_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!dealId,
  })
}

export function useMoveDeal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dealId,
      newStageId,
      pipelineId,
      oldStageName,
      newStageName,
      performedById,
      boardPosition,
    }: {
      dealId: string
      newStageId: string
      pipelineId: string
      oldStageName?: string
      newStageName?: string
      performedById?: string
      /** Where in the destination stage the card was dropped. */
      boardPosition?: number | null
    }) => {
      // Read the stage the deal is leaving, so the activity log records its id
      // (and its name, if the caller didn't pass one)
      const { data: deal } = await supabase
        .from('deals')
        .select('current_stage_id')
        .eq('id', dealId)
        .single()
      // oldStageId used to be captured for the activity row this hook wrote.
      // The database writes that now (migration 242), so only the stage NAME
      // is still needed, for the toast.
      let oldStage = oldStageName
      if (!oldStage) {
        if (deal?.current_stage_id) {
          const { data: stageData } = await supabase
            .from('pipeline_stages')
            .select('name')
            .eq('id', deal.current_stage_id)
            .single()
          
          if (stageData) {
            oldStage = stageData.name
          }
        }
      }

      // Get new stage name if not provided
      let newStage = newStageName
      if (!newStage) {
        const { data: stage } = await supabase
          .from('pipeline_stages')
          .select('name')
          .eq('id', newStageId)
          .single()

        if (stage) {
          newStage = stage.name
        }
      }

      // Get current user if not provided
      let userId = performedById
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id
      }

      // Update the deal's stage (only current_stage_id - trigger handles stage_id sync)
      const { data: moved, error: updateError } = await supabase
        .from('deals')
        .update({
          current_stage_id: newStageId,
          // Stamp when the deal entered this stage. Nothing on this path set it
          // before — only the inbound-reply handler did — so all 613 deals had
          // it NULL and every card's "time in stage" was silently reporting
          // days since the lead was created instead.
          stage_entered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Where the card was dropped in its new column. Without this a moved
          // card keeps the position it held in the stage it came from, which
          // bears no relation to the order of the stage it landed in.
          ...(typeof boardPosition === 'number' ? { board_position: boardPosition } : {}),
        })
        .eq('id', dealId)
        .select('id')

      if (updateError) {
        console.error('Failed to move deal:', updateError)
        throw new Error(updateError.message || 'Failed to update deal stage')
      }
      // RLS refuses a move on someone else's deal by matching zero rows, not
      // by erroring; report it rather than toasting "Deal moved".
      if (!moved?.length) throw new Error('You can only move deals that are assigned to you.')

      // The 'stage_changed' activity is NOT written here any more.
      //
      // The database writes it, for every stage move, in
      // handle_deal_stage_change (migration 242). Two writers for one fact is
      // what left a gap: this one only knew about moves the board made, so a
      // move the user triggered and a trigger carried out — Mark Paid landing
      // a card on Deposit Paid — was logged by neither. The database sees them
      // all, and uses auth.uid() to keep the same "Moved from X to Y" wording
      // and attribution for a move made here.
      //
      // Removing this insert is what stops a board drag being logged twice.

      return { dealId, newStageId, newStageName: newStage }
    },
    onMutate: async ({ dealId, newStageId, pipelineId, boardPosition }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['deals', pipelineId] })

      // Snapshot previous value
      const previousDeals = queryClient.getQueryData<Deal[]>(['deals', pipelineId])

      // Optimistically update. board_position moves with the stage: without
      // it the card arrived in its new column carrying the position it had in
      // the old one, so it sat in the wrong slot — usually jumping to the top
      // — and then visibly hopped to where it was dropped once the refetch
      // landed. Under a remote database that hop is long enough to read as
      // the drop having gone to the wrong place.
      queryClient.setQueryData<Deal[]>(['deals', pipelineId], (old) => {
        if (!old) return old
        return old.map((deal) =>
          deal.id === dealId
            ? {
                ...deal,
                current_stage_id: newStageId,
                ...(typeof boardPosition === 'number' ? { board_position: boardPosition } : {}),
              }
            : deal
        )
      })

      return { previousDeals }
    },
    onError: (err, { pipelineId }, context) => {
      // Rollback on error
      if (context?.previousDeals) {
        queryClient.setQueryData(['deals', pipelineId], context.previousDeals)
      }
    },
    onSettled: (data, error, { pipelineId, dealId }) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['deals', pipelineId] })
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
      queryClient.invalidateQueries({ queryKey: ['deal-activities', dealId] })
      // Stage moves can trigger enrollment via DB trigger
      queryClient.invalidateQueries({ queryKey: ['deal-automations', dealId] })
    },
  })
}

export function useUpdateDeal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dealId,
      updates,
    }: {
      dealId: string
      updates: Partial<Deal>
    }) => {
      const { error } = await supabase
        .from('deals')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', dealId)

      if (error) throw error
    },
    onSuccess: (_, { dealId }) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] })
    },
  })
}

// Hard-delete a deal. Schema FKs cascade:
//   automation_enrollments → CASCADE
//   email_sends            → SET NULL on deal_id (so historical sends remain
//                            but lose deal linkage)
//   deal_activities        → CASCADE (audit trail goes with the deal)
// Caller is responsible for confirmation UX. Admin-gate at the call site.
export function useDeleteDeal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (dealId: string) => {
      const { data, error } = await supabase
        .from('deals')
        .delete()
        .eq('id', dealId)
        .select('id')

      if (error) throw error
      // RLS refuses a delete by matching zero rows rather than erroring, so
      // without this a refused delete would report success.
      if (!data?.length) throw new Error('You do not have permission to delete this deal.')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline-deal-counts'] })
      queryClient.invalidateQueries({ queryKey: ['deal-automations'] })
    },
  })
}

/**
 * Reorder a card within its stage.
 *
 * Deliberately separate from useMoveDeal: nothing about the deal changes
 * except where it sits on the board, so this writes no stage, stamps no
 * stage_entered_at and logs no activity. A recruiter tidying their column
 * should not fill the deal's timeline with "moved" entries, and it must not
 * reset time-in-stage.
 */
export function useReorderDeal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dealId,
      position,
      stageId,
    }: {
      dealId: string
      /** null when the midpoint ran out of precision — renumber the stage first. */
      position: number | null
      stageId: string
    }) => {
      let target = position

      if (target === null) {
        // Precision backstop. Rewrite the stage on the gaps the backfill used,
        // then drop the card at the end; the user can nudge it again and the
        // midpoints will have room.
        const { data: rows } = await supabase
          .from('deals')
          .select('id, board_position, created_at')
          .eq('current_stage_id', stageId)
          .order('board_position', { ascending: true, nullsFirst: false })

        const ordered = rows ?? []
        await Promise.all(
          ordered.map((row, i) =>
            supabase.from('deals').update({ board_position: (i + 1) * 1000 }).eq('id', row.id),
          ),
        )
        target = (ordered.length + 1) * 1000
      }

      const { data, error } = await supabase
        .from('deals')
        .update({ board_position: target })
        .eq('id', dealId)
        .select('id')

      if (error) throw new Error(error.message || 'Failed to reorder deal')
      // RLS refuses someone else's deal by matching zero rows rather than
      // erroring — same trap as useMoveDeal.
      if (!data?.length) throw new Error('You can only reorder deals that are assigned to you.')
    },
    // Reorder is the one drag whose whole result is the new position, so
    // waiting for the round-trip meant the card snapped back to where it
    // started and only moved once the refetch returned. That read as the drag
    // being rejected. The position is known before the request goes out, so
    // apply it immediately and roll back if the write is refused.
    //
    // setQueriesData rather than setQueryData: the cache is keyed
    // ['deals', pipelineId] and a reorder never changes pipeline, so patching
    // every cached board by prefix avoids threading pipelineId through a
    // mutation that has no other use for it.
    onMutate: async ({ dealId, position }) => {
      if (position === null) return { previous: undefined }

      await queryClient.cancelQueries({ queryKey: ['deals'] })
      const previous = queryClient.getQueriesData<Deal[]>({ queryKey: ['deals'] })

      queryClient.setQueriesData<Deal[]>({ queryKey: ['deals'] }, (old) =>
        old?.map((deal) =>
          deal.id === dealId ? { ...deal, board_position: position } : deal
        )
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      context?.previous?.forEach(([key, deals]) => queryClient.setQueryData(key, deals))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}
