'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { FormSubmission, FormSubmissionFilters, RoundRobinState } from '@/lib/types/forms'

/**
 * Fetch form submissions with optional filters
 */
export function useFormSubmissions(filters?: FormSubmissionFilters) {
  return useQuery({
    queryKey: ['form-submissions', filters],
    queryFn: async () => {
      const supabase = createClient()
      
      let query = supabase
        .from('form_submissions')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email),
          deal:deals(id, title),
          automation:automations(id, name),
          assigned_user:profiles!form_submissions_assigned_user_id_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false })
      
      if (filters?.form_id) {
        query = query.eq('form_id', filters.form_id)
      }
      
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      
      if (filters?.automation_id) {
        query = query.eq('automation_id', filters.automation_id)
      }
      
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom)
      }
      
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo)
      }
      
      const { data, error } = await query.limit(100)
      
      if (error) throw error
      
      return (data || []) as FormSubmission[]
    },
  })
}

/**
 * Fetch a single form submission
 */
export function useFormSubmission(submissionId: string | null) {
  return useQuery({
    queryKey: ['form-submission', submissionId],
    queryFn: async () => {
      if (!submissionId) return null
      
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('form_submissions')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email),
          deal:deals(id, title),
          automation:automations(id, name),
          assigned_user:profiles!form_submissions_assigned_user_id_fkey(id, full_name, email)
        `)
        .eq('id', submissionId)
        .single()
      
      if (error) throw error
      
      return data as FormSubmission
    },
    enabled: !!submissionId,
  })
}

/**
 * Fetch form submission stats
 */
export function useFormSubmissionStats(automationId?: string) {
  return useQuery({
    queryKey: ['form-submission-stats', automationId],
    queryFn: async () => {
      const supabase = createClient()
      
      let query = supabase.from('form_submissions').select('status', { count: 'exact' })
      
      if (automationId) {
        query = query.eq('automation_id', automationId)
      }
      
      // Get total counts by status
      const [processed, failed, pending] = await Promise.all([
        supabase
          .from('form_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'processed')
          .then(r => r.count || 0),
        supabase
          .from('form_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed')
          .then(r => r.count || 0),
        supabase
          .from('form_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .then(r => r.count || 0),
      ])
      
      // Get today's submissions
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { count: todayCount } = await supabase
        .from('form_submissions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
      
      return {
        total: processed + failed + pending,
        processed,
        failed,
        pending,
        todayCount: todayCount || 0,
      }
    },
  })
}

/**
 * Fetch round-robin state for an automation. Reads the unified cursor table
 * (round_robin_cursors) and maps it back to the RoundRobinState shape that
 * existed when round_robin_state was the only source.
 */
export function useRoundRobinState(automationId: string | null) {
  return useQuery({
    queryKey: ['round-robin-state', automationId],
    queryFn: async () => {
      if (!automationId) return null

      const supabase = createClient()

      const { data, error } = await supabase
        .from('round_robin_cursors')
        .select(`
          context_type,
          context_id,
          last_assigned_user_id,
          last_assigned_at,
          updated_at,
          last_assigned_user:profiles(id, full_name, email)
        `)
        .eq('context_type', 'automation')
        .eq('context_id', automationId)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
      if (!data) return null

      const state: RoundRobinState = {
        id: `${data.context_type}:${data.context_id}`,
        automation_id: data.context_id,
        last_assigned_user_id: data.last_assigned_user_id,
        last_assigned_at: data.last_assigned_at,
        created_at: data.last_assigned_at,
        updated_at: data.updated_at,
        last_assigned_user: Array.isArray(data.last_assigned_user)
          ? data.last_assigned_user[0] ?? null
          : data.last_assigned_user,
      }
      return state
    },
    enabled: !!automationId,
  })
}

/**
 * Reset round-robin state for an automation.
 */
export function useResetRoundRobin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (automationId: string) => {
      const supabase = createClient()

      const { error } = await supabase
        .from('round_robin_cursors')
        .delete()
        .eq('context_type', 'automation')
        .eq('context_id', automationId)

      if (error) throw error
    },
    onSuccess: (_, automationId) => {
      queryClient.invalidateQueries({ queryKey: ['round-robin-state', automationId] })
    },
  })
}

/**
 * Reprocess a failed form submission
 */
export function useReprocessSubmission() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (submissionId: string) => {
      const supabase = createClient()
      
      // Get the submission
      const { data: submission, error: fetchError } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('id', submissionId)
        .single()
      
      if (fetchError) throw fetchError
      
      // Call the webhook again with the stored payload
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/form-webhook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-form-id': submission.form_id,
            'x-form-source': submission.form_source || 'generic',
          },
          body: JSON.stringify(submission.payload),
        }
      )
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reprocess submission')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions'] })
    },
  })
}

/**
 * Test form webhook with sample data
 */
export function useTestFormWebhook() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (testData: {
      form_id: string
      first_name: string
      last_name: string
      email: string
      phone?: string
    }) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/form-webhook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-form-id': testData.form_id,
            'x-form-source': 'generic',
          },
          body: JSON.stringify(testData),
        }
      )
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Webhook test failed')
      }
      
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}
