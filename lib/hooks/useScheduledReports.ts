import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface ScheduledReport {
  id: string
  report_type: string
  report_name: string
  frequency: 'daily' | 'weekly' | 'monthly'
  recipients: string[]
  is_active: boolean
  last_sent_at: string | null
  next_run_at: string | null
  created_by: string
  created_at: string
}

export function useScheduledReports() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['scheduled-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as ScheduledReport[]
    },
  })
}

export function useCreateScheduledReport() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (report: {
      report_type: string
      report_name: string
      frequency: 'daily' | 'weekly' | 'monthly'
      recipients: string[]
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Calculate next_run_at based on frequency
      const now = new Date()
      let nextRun: Date
      switch (report.frequency) {
        case 'daily':
          nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          nextRun.setHours(8, 0, 0, 0) // 8 AM next day
          break
        case 'weekly':
          nextRun = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          nextRun.setHours(8, 0, 0, 0)
          break
        case 'monthly':
          nextRun = new Date(now.getFullYear(), now.getMonth() + 1, 1, 8, 0, 0)
          break
      }

      const { data, error } = await supabase
        .from('scheduled_reports')
        .insert({
          ...report,
          created_by: user.id,
          next_run_at: nextRun.toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] })
    },
  })
}

export function useToggleScheduledReport() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('scheduled_reports')
        .update({ is_active })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] })
    },
  })
}

export function useDeleteScheduledReport() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_reports')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] })
    },
  })
}
