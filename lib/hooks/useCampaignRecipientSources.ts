import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// Tags for recipient selection, with a contact count against each.
//
// The key must stay distinct from the bare ['tags'] used by useTags(),
// ContactFilters and CreateContactModal. Those three return plain tag rows
// with no contact_count, and React Query dedupes by key — so whichever
// mounted first won, and this picker rendered their countless rows as "0".
export function useTags() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['tags', 'with-contact-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name')

      if (error) throw error

      if (!data || data.length === 0) return []

      // Counted via RPC, not client-side: contact_tags holds 352k rows and a
      // plain select is capped at 1,000, which made almost every tag read
      // "0 contacts" in the picker.
      const { data: counts } = await supabase.rpc('get_tag_contact_counts')

      const countMap = new Map<string, number>()
      counts?.forEach((c: { tag_id: string; contact_count: number }) => {
        countMap.set(c.tag_id, Number(c.contact_count))
      })

      return (data || []).map((tag) => ({
        ...tag,
        contact_count: countMap.get(tag.id) || 0,
      }))
    },
  })
}

/**
 * Active (not won, not lost) deals per stage, counted in the database.
 *
 * These counts drive the campaign audience picker, so being wrong means
 * emailing a different number of people than the screen promised. Counting
 * them by fetching deal rows and tallying in JS reads at most 1000 rows —
 * one shared budget across every stage asked for, not one each — so past a
 * thousand active deals the picker would quietly under-report. The same
 * assumption ("deals is a small table") is what made the pipeline board drop
 * deals, and the next intake is what breaks it.
 *
 * head: true returns a number and no rows, so it cannot hit the cap.
 */
async function countActiveDealsByStage(
  supabase: ReturnType<typeof createClient>,
  stageIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (stageIds.length === 0) return counts

  await Promise.all(
    stageIds.map(async (stageId) => {
      const { count } = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('current_stage_id', stageId)
        .is('won_at', null)
        .is('lost_at', null)
      counts.set(stageId, count ?? 0)
    }),
  )

  return counts
}

// Hook to fetch pipeline stages for a specific pipeline
export function usePipelineStages(pipelineId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['pipeline-stages', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return []

      const { data: stages, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('display_order')

      if (error) throw error

      // Get deal counts for each stage (active deals only)
      const stageIds = stages?.map((s) => s.id) || []
      if (stageIds.length === 0) return stages || []

      const countMap = await countActiveDealsByStage(supabase, stageIds)

      return (stages || []).map((stage) => ({
        ...stage,
        deal_count: countMap.get(stage.id) || 0,
      }))
    },
    enabled: !!pipelineId,
  })
}

// Hook to fetch ALL pipeline stages grouped by pipeline (for campaign recipient selection)
export function useAllPipelineStages() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['all-pipeline-stages'],
    queryFn: async () => {
      const { data: stages, error } = await supabase
        .from('pipeline_stages')
        .select('*, pipeline:pipelines(id, name)')
        .order('display_order')

      if (error) throw error
      if (!stages || stages.length === 0) return []

      // Get deal counts for each stage (active deals only)
      const stageIds = stages.map((s) => s.id)
      const countMap = await countActiveDealsByStage(supabase, stageIds)

      return stages.map((stage) => ({
        ...stage,
        deal_count: countMap.get(stage.id) || 0,
      }))
    },
  })
}

// Combined recipient calculation from multiple sources.
//
// Runs entirely in SQL. The previous version selected every contact_lists /
// contact_tags / deals join row and de-duplicated in JavaScript, which
// PostgREST silently truncated at 1,000 rows — so a campaign aimed at the
// 105k "ALL CONTACTS EVERYONE" list reported "1,000 recipients". The RPC
// applies the same subscription filter the sender does, so this number is
// what will actually be emailed.
export function useCalculateCombinedRecipients(
  listIds: string[],
  tagIds: string[],
  stageIds: string[]
) {
  const supabase = createClient()

  return useQuery<{ count: number }>({
    queryKey: ['campaign-audience-count', listIds, tagIds, stageIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('campaign_audience_count', {
        p_list_ids: listIds,
        p_tag_ids: tagIds,
        p_stage_ids: stageIds,
        p_type: 'email',
      })

      if (error) throw error
      return { count: Number(data ?? 0) }
    },
    enabled: listIds.length > 0 || tagIds.length > 0 || stageIds.length > 0,
    // The largest audience takes ~600ms server-side; don't re-run it on every
    // window focus while the composer is open.
    staleTime: 30_000,
  })
}
