import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Pipeline } from '@/lib/types/pipelines'

export function usePipelines() {
  const supabase = createClient()

  return useQuery<Pipeline[]>({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('*, programme:programmes(*)')
        .eq('is_active', true)
        .order('display_order')

      if (error) throw error
      return data || []
    },
  })
}
