'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useStarredItems(entityType?: 'contact' | 'deal') {
  const supabase = createClient()

  return useQuery<Set<string>>({
    queryKey: ['starred-items', entityType],
    queryFn: async () => {
      let query = supabase.from('starred_items').select('entity_id')
      if (entityType) query = query.eq('entity_type', entityType)

      const { data, error } = await query
      if (error) throw error
      return new Set((data || []).map((d) => d.entity_id))
    },
  })
}

export function useToggleStar() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      isStarred,
    }: {
      entityType: 'contact' | 'deal'
      entityId: string
      isStarred: boolean
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (isStarred) {
        // Remove star
        const { error } = await supabase
          .from('starred_items')
          .delete()
          .eq('user_id', user.id)
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
        if (error) throw error
      } else {
        // Add star
        const { error } = await supabase
          .from('starred_items')
          .insert({ user_id: user.id, entity_type: entityType, entity_id: entityId })
        if (error) throw error
      }
    },
    onMutate: async ({ entityType, entityId, isStarred }) => {
      await queryClient.cancelQueries({ queryKey: ['starred-items', entityType] })
      const prev = queryClient.getQueryData<Set<string>>(['starred-items', entityType])

      queryClient.setQueryData<Set<string>>(['starred-items', entityType], (old) => {
        const next = new Set(old)
        if (isStarred) {
          next.delete(entityId)
        } else {
          next.add(entityId)
        }
        return next
      })

      return { prev }
    },
    onError: (_err, { entityType }, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['starred-items', entityType], context.prev)
      }
    },
    onSettled: (_, __, { entityType }) => {
      queryClient.invalidateQueries({ queryKey: ['starred-items', entityType] })
      queryClient.invalidateQueries({ queryKey: ['starred-items', undefined] })
    },
  })
}
