import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Subscribes to Supabase Realtime changes on the campaigns table.
 * Automatically invalidates React Query caches when campaign stats
 * are updated by webhooks (delivered, opened, clicked, bounced).
 */
export function useCampaignRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('campaigns-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaigns',
        },
        (payload) => {
          const campaignId = payload.new?.id
          // Invalidate the campaigns list and the specific campaign
          queryClient.invalidateQueries({ queryKey: ['campaigns'] })
          if (campaignId) {
            queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

/**
 * Subscribes to Realtime changes on email_sends for a specific campaign.
 * Used in the campaign detail view to live-update stats and recipient list.
 */
export function useCampaignDetailRealtime(campaignId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!campaignId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`campaign-detail-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_sends',
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['campaign-stats', campaignId] })
          queryClient.invalidateQueries({ queryKey: ['campaign-recipients', campaignId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [campaignId, queryClient])
}
