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
      if (!user) return { connected: false } as CalendlyConnectionStatus

      const { data: profile } = await supabase
        .from('profiles')
        .select('calendly_url')
        .eq('id', user.id)
        .single()

      return {
        connected: !!profile?.calendly_url,
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

      // 1. Fetch Calendly user info to get the user URI + scheduling URL.
      const meResponse = await fetch('https://api.calendly.com/users/me', {
        headers: {
          'Authorization': `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!meResponse.ok) {
        const error = await meResponse.json().catch(() => ({}))
        throw new Error(error.message || 'Failed to connect to Calendly')
      }

      const calendlyUser = await meResponse.json()
      const userUri = calendlyUser.resource.uri as string
      const schedulingUrl = calendlyUser.resource.scheduling_url as string | null

      // Calendly scopes webhook subscriptions to a (user, organization)
      // pair. Both URIs come from /users/me.
      const orgUri = calendlyUser.resource.current_organization as string

      // 2. Register a webhook subscription so events actually flow to us.
      // It's OK if one already exists — Calendly returns 409 in that case
      // and we just keep going with whatever URI they send back.
      const webhookUrl =
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/calendly-webhook`

      const subBody: Record<string, unknown> = {
        url: webhookUrl,
        events: ['invitee.created', 'invitee.canceled'],
        organization: orgUri,
        user: userUri,
        scope: 'user',
      }
      if (params.webhookSecret) {
        subBody.signing_key = params.webhookSecret
      }

      let webhookUri: string | null = null
      const subResponse = await fetch('https://api.calendly.com/webhook_subscriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subBody),
      })

      if (subResponse.ok) {
        const sub = await subResponse.json()
        webhookUri = sub.resource?.uri ?? null
      } else if (subResponse.status === 409) {
        // Already subscribed for this user → fetch the existing one so we
        // store its URI for clean disconnect later.
        const listUrl = new URL('https://api.calendly.com/webhook_subscriptions')
        listUrl.searchParams.set('organization', orgUri)
        listUrl.searchParams.set('user', userUri)
        listUrl.searchParams.set('scope', 'user')
        const listResp = await fetch(listUrl.toString(), {
          headers: { 'Authorization': `Bearer ${params.accessToken}` },
        })
        if (listResp.ok) {
          const list = await listResp.json()
          const ours = (list.collection || []).find(
            (s: { callback_url?: string }) => s.callback_url === webhookUrl,
          )
          webhookUri = ours?.uri ?? null
        }
      } else {
        const error = await subResponse.json().catch(() => ({}))
        throw new Error(
          error.message || `Failed to register webhook (HTTP ${subResponse.status})`,
        )
      }

      // 3. Persist what we need. The public scheduling URL lives on profiles
      // (used by the {{deal_owner_calendly}} merge tag, readable by the team).
      // The secrets — access token, webhook subscription URI, signing key — and
      // the user URI (so the webhook can resolve the recruiter) go into the
      // owner-only calendly_credentials table.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ calendly_url: schedulingUrl })
        .eq('id', user.id)

      if (profileError) throw profileError

      const { error: credError } = await supabase
        .from('calendly_credentials')
        .upsert(
          {
            user_id: user.id,
            access_token: params.accessToken,
            webhook_secret: params.webhookSecret ?? null,
            webhook_uri: webhookUri,
            user_uri: userUri,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )

      if (credError) throw credError

      return {
        connected: true,
        user_name: calendlyUser.resource.name as string,
        webhook_registered: !!webhookUri,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendly-connection-status'] })
    },
  })
}

/**
 * Disconnect Calendly account. Best-effort: try to delete the webhook
 * subscription on Calendly's side, then clear the booking link and remove the
 * stored credentials regardless. If the API call fails we don't block
 * disconnect — the user can clean up the orphan subscription manually.
 */
export function useDisconnectCalendly() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: cred } = await supabase
        .from('calendly_credentials')
        .select('access_token, webhook_uri')
        .eq('user_id', user.id)
        .single()

      if (cred?.access_token && cred.webhook_uri) {
        try {
          await fetch(cred.webhook_uri, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${cred.access_token}` },
          })
        } catch (err) {
          console.warn('Failed to delete Calendly webhook subscription:', err)
        }
      }

      // Clear the public booking link and remove the stored secrets.
      const { error } = await supabase
        .from('profiles')
        .update({ calendly_url: null })
        .eq('id', user.id)

      if (error) throw error

      await supabase.from('calendly_credentials').delete().eq('user_id', user.id)
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
