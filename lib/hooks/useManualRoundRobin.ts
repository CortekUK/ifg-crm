import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook for manual round-robin assignment when creating deals manually.
 * Uses pipeline_id prefixed with 'manual_' as the key to track rotation state.
 */
export function useManualRoundRobin() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      pipelineId,
      userIds,
    }: {
      pipelineId: string
      userIds: string[]
    }): Promise<string> => {
      if (!userIds || userIds.length === 0) {
        throw new Error('No users available for round-robin assignment')
      }

      const { data: nextUserId, error } = await supabase.rpc('round_robin_next', {
        p_context_type: 'manual_pipeline',
        p_context_id: pipelineId,
        p_user_ids: userIds,
      })

      if (error) {
        console.error('Round-robin error:', error)
        // Fallback to first user if function fails
        return userIds[0]
      }

      return nextUserId as string
    },
    onSuccess: () => {
      // Invalidate any round-robin related queries if needed
      queryClient.invalidateQueries({ queryKey: ['round-robin-state'] })
    },
  })
}
