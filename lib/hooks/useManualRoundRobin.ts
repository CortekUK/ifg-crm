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

      // Use 'manual_' prefix to distinguish from automation round-robin
      const manualAutomationId = `manual_${pipelineId}`

      // Call the existing round-robin function with the manual key
      const { data: nextUserId, error } = await supabase.rpc(
        'get_next_round_robin_user_manual',
        {
          p_pipeline_key: manualAutomationId,
          p_user_ids: userIds,
        }
      )

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
