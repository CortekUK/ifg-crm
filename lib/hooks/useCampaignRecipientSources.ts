import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// Hook to fetch all tags for recipient selection
export function useTags() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name')

      if (error) throw error

      // Get contact counts for each tag
      const tagIds = data?.map((t) => t.id) || []
      if (tagIds.length === 0) return []

      const { data: counts } = await supabase
        .from('contact_tags')
        .select('tag_id')
        .in('tag_id', tagIds)

      const countMap = new Map<string, number>()
      counts?.forEach((c) => {
        countMap.set(c.tag_id, (countMap.get(c.tag_id) || 0) + 1)
      })

      return (data || []).map((tag) => ({
        ...tag,
        contact_count: countMap.get(tag.id) || 0,
      }))
    },
  })
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

      const { data: dealCounts } = await supabase
        .from('deals')
        .select('current_stage_id')
        .in('current_stage_id', stageIds)
        .is('won_at', null)
        .is('lost_at', null)

      const countMap = new Map<string, number>()
      dealCounts?.forEach((d) => {
        countMap.set(d.current_stage_id, (countMap.get(d.current_stage_id) || 0) + 1)
      })

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
      const { data: dealCounts } = await supabase
        .from('deals')
        .select('current_stage_id')
        .in('current_stage_id', stageIds)
        .is('won_at', null)
        .is('lost_at', null)

      const countMap = new Map<string, number>()
      dealCounts?.forEach((d) => {
        countMap.set(d.current_stage_id, (countMap.get(d.current_stage_id) || 0) + 1)
      })

      return stages.map((stage) => ({
        ...stage,
        deal_count: countMap.get(stage.id) || 0,
      }))
    },
  })
}

// Calculate recipients from tags
export function useCalculateRecipientsFromTags(tagIds: string[]) {
  const supabase = createClient()

  return useQuery<{ count: number; contactIds: string[]; hasDuplicates: boolean }>({
    queryKey: ['calculate-recipients-tags', tagIds],
    queryFn: async () => {
      if (tagIds.length === 0) {
        return { count: 0, contactIds: [], hasDuplicates: false }
      }

      // Get all contact_ids from selected tags
      const { data, error } = await supabase
        .from('contact_tags')
        .select('contact_id')
        .in('tag_id', tagIds)

      if (error) throw error

      // Get unique contacts
      const allContacts = data?.map((c) => c.contact_id) || []
      const uniqueContacts = [...new Set(allContacts)]
      const hasDuplicates = uniqueContacts.length < allContacts.length

      return {
        count: uniqueContacts.length,
        contactIds: uniqueContacts,
        hasDuplicates,
      }
    },
    enabled: tagIds.length > 0,
  })
}

// Calculate recipients from pipeline stages
export function useCalculateRecipientsFromStages(stageIds: string[]) {
  const supabase = createClient()

  return useQuery<{ count: number; contactIds: string[]; hasDuplicates: boolean }>({
    queryKey: ['calculate-recipients-stages', stageIds],
    queryFn: async () => {
      if (stageIds.length === 0) {
        return { count: 0, contactIds: [], hasDuplicates: false }
      }

      // Get all contact_ids from deals in selected stages (active deals only)
      const { data, error } = await supabase
        .from('deals')
        .select('contact_id')
        .in('current_stage_id', stageIds)
        .is('won_at', null)
        .is('lost_at', null)
        .not('contact_id', 'is', null)

      if (error) throw error

      // Get unique contacts
      const allContacts = data?.map((d) => d.contact_id).filter(Boolean) as string[] || []
      const uniqueContacts = [...new Set(allContacts)]
      const hasDuplicates = uniqueContacts.length < allContacts.length

      return {
        count: uniqueContacts.length,
        contactIds: uniqueContacts,
        hasDuplicates,
      }
    },
    enabled: stageIds.length > 0,
  })
}

// Combined recipient calculation from multiple sources
export function useCalculateCombinedRecipients(
  listIds: string[],
  tagIds: string[],
  stageIds: string[]
) {
  const supabase = createClient()

  return useQuery<{ count: number; hasDuplicates: boolean }>({
    queryKey: ['calculate-combined-recipients', listIds, tagIds, stageIds],
    queryFn: async () => {
      const allContactIds: string[] = []

      // Get contacts from lists
      if (listIds.length > 0) {
        const { data } = await supabase
          .from('contact_lists')
          .select('contact_id')
          .in('list_id', listIds)

        data?.forEach((c) => allContactIds.push(c.contact_id))
      }

      // Get contacts from tags
      if (tagIds.length > 0) {
        const { data } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', tagIds)

        data?.forEach((c) => allContactIds.push(c.contact_id))
      }

      // Get contacts from stages
      if (stageIds.length > 0) {
        const { data } = await supabase
          .from('deals')
          .select('contact_id')
          .in('current_stage_id', stageIds)
          .is('won_at', null)
          .is('lost_at', null)
          .not('contact_id', 'is', null)

        data?.forEach((d) => {
          if (d.contact_id) allContactIds.push(d.contact_id)
        })
      }

      // Get unique contacts
      const uniqueContacts = new Set(allContactIds)
      const hasDuplicates = uniqueContacts.size < allContactIds.length

      return {
        count: uniqueContacts.size,
        hasDuplicates,
      }
    },
    enabled: listIds.length > 0 || tagIds.length > 0 || stageIds.length > 0,
  })
}
