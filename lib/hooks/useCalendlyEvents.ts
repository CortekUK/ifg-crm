'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { CalendlyEvent, CalendlyEventFilters, CalendlyConnectionStatus } from '@/lib/types/calendly'

/**
 * Fetch Calendly events for a specific contact
 */
export function useCalendlyEvents(contactId: string | null) {
  return useQuery({
    queryKey: ['calendly-events', 'contact', contactId],
    queryFn: async () => {
      if (!contactId) return []
      
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('calendly_events')
        .select('*')
        .eq('contact_id', contactId)
        .order('start_time', { ascending: false })
      
      if (error) throw error
      
      return (data || []) as CalendlyEvent[]
    },
    enabled: !!contactId,
  })
}

/**
 * Fetch Calendly events for a specific user (recruiter)
 */
export function useUserCalendlyEvents(userId: string | null, filters?: CalendlyEventFilters) {
  return useQuery({
    queryKey: ['calendly-events', 'user', userId, filters],
    queryFn: async () => {
      if (!userId) return []
      
      const supabase = createClient()
      
      let query = supabase
        .from('calendly_events')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email)
        `)
        .eq('user_id', userId)
      
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      
      if (filters?.upcoming_only) {
        query = query.gte('start_time', new Date().toISOString())
      }
      
      if (filters?.past_only) {
        query = query.lt('start_time', new Date().toISOString())
      }
      
      query = query.order('start_time', { ascending: !filters?.past_only })
      
      const { data, error } = await query
      
      if (error) throw error
      
      return (data || []) as CalendlyEvent[]
    },
    enabled: !!userId,
  })
}

/**
 * Fetch Calendly events for a specific deal
 */
export function useDealCalendlyEvents(dealId: string | null) {
  return useQuery({
    queryKey: ['calendly-events', 'deal', dealId],
    queryFn: async () => {
      if (!dealId) return []
      
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('calendly_events')
        .select('*')
        .eq('deal_id', dealId)
        .order('start_time', { ascending: false })
      
      if (error) throw error
      
      return (data || []) as CalendlyEvent[]
    },
    enabled: !!dealId,
  })
}

/**
 * Fetch upcoming Calendly event for a contact (for quick indicator)
 */
export function useUpcomingCalendlyEvent(contactId: string | null) {
  return useQuery({
    queryKey: ['calendly-events', 'upcoming', contactId],
    queryFn: async () => {
      if (!contactId) return null
      
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('calendly_events')
        .select('*')
        .eq('contact_id', contactId)
        .eq('status', 'scheduled')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(1)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      
      return data as CalendlyEvent | null
    },
    enabled: !!contactId,
  })
}

/**
 * Get Calendly connection status for current user
 */
export function useCalendlyConnectionStatus() {
  return useQuery({
    queryKey: ['calendly-connection-status'],
    queryFn: async () => {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { connected: false }
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('calendly_user_uri, calendly_connected_at')
        .eq('id', user.id)
        .single()
      
      if (error) throw error
      
      return {
        connected: !!profile?.calendly_user_uri,
        user_uri: profile?.calendly_user_uri || undefined,
        connected_at: profile?.calendly_connected_at || undefined,
      } as CalendlyConnectionStatus
    },
  })
}

/**
 * Connect Calendly account
 */
export function useConnectCalendly() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (params: {
      accessToken: string
      webhookSecret?: string
    }) => {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      
      // Fetch Calendly user info to get the user URI
      const response = await fetch('https://api.calendly.com/users/me', {
        headers: {
          'Authorization': `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to connect to Calendly')
      }
      
      const calendlyUser = await response.json()
      
      // Update profile with Calendly connection
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          calendly_access_token: params.accessToken, // In production, encrypt this
          calendly_webhook_secret: params.webhookSecret || null,
          calendly_user_uri: calendlyUser.resource.uri,
          calendly_connected_at: new Date().toISOString(),
        })
        .eq('id', user.id)
      
      if (updateError) throw updateError
      
      return {
        connected: true,
        user_uri: calendlyUser.resource.uri,
        user_name: calendlyUser.resource.name,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendly-connection-status'] })
    },
  })
}

/**
 * Disconnect Calendly account
 */
export function useDisconnectCalendly() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      
      const { error } = await supabase
        .from('profiles')
        .update({
          calendly_access_token: null,
          calendly_webhook_secret: null,
          calendly_user_uri: null,
          calendly_connected_at: null,
        })
        .eq('id', user.id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendly-connection-status'] })
    },
  })
}

/**
 * Manually mark event as completed
 */
export function useMarkEventCompleted() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (eventId: string) => {
      const supabase = createClient()
      
      const { error } = await supabase
        .from('calendly_events')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', eventId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendly-events'] })
    },
  })
}

/**
 * Manually mark event as no-show
 */
export function useMarkEventNoShow() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (eventId: string) => {
      const supabase = createClient()
      
      const { error } = await supabase
        .from('calendly_events')
        .update({
          status: 'no_show',
          updated_at: new Date().toISOString(),
        })
        .eq('id', eventId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendly-events'] })
    },
  })
}
