import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { isExcludedDealOwnerEmail } from '@/lib/constants/deal-owners'

export interface AssignedUser {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

/**
 * Hook to fetch users assigned to a specific pipeline.
 * Checks the profile.pipeline_assignments JSONB array for pipeline ID matches.
 * Falls back to all active recruiters/admins if no specific assignments exist.
 */
export function usePipelineAssignedUsers(pipelineId: string | null) {
  const supabase = createClient()

  return useQuery<AssignedUser[]>({
    queryKey: ['pipeline-assigned-users', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return []

      // First try to get users specifically assigned to this pipeline
      const { data: assignedUsers, error: assignedError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .contains('pipeline_assignments', [pipelineId])
        .eq('is_active', true)

      if (assignedError) {
        console.error('Error fetching pipeline assigned users:', assignedError)
        throw assignedError
      }

      // If users are specifically assigned, return them
      if (assignedUsers && assignedUsers.length > 0) {
        return assignedUsers.filter((user) => !isExcludedDealOwnerEmail(user.email))
      }

      // Fallback: return all active recruiters and admins
      const { data: allUsers, error: allError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .eq('is_active', true)
        .in('role', ['recruiter', 'admin', 'super_admin'])
        .order('full_name')

      if (allError) {
        console.error('Error fetching all users:', allError)
        throw allError
      }

      return (allUsers || []).filter((user) => !isExcludedDealOwnerEmail(user.email))
    },
    enabled: !!pipelineId,
  })
}
