import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Programme } from '@/lib/types/pipelines'

export function useProgrammes() {
  const supabase = createClient()

  return useQuery<Programme[]>({
    queryKey: ['programmes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programmes')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data || []
    },
  })
}

export function useAllProgrammes() {
  const supabase = createClient()

  return useQuery<Programme[]>({
    queryKey: ['all-programmes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programmes')
        .select('*')
        .order('name')

      if (error) throw error
      return data || []
    },
  })
}
