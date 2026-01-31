import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface EmailSend {
  id: string
  tracking_id: string
  recipient_email: string
  recipient_contact_id: string | null
  campaign_id: string | null
  automation_log_id: string | null
  subject: string
  from_name: string | null
  from_email: string | null
  sent_at: string
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
  bounced_at: string | null
  complained_at: string | null
  open_count: number
  click_count: number
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed'
  resend_message_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
  // Joined data
  contact?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  campaign?: {
    id: string
    name: string
  }
}

export interface EmailSendFilters {
  contact_id?: string
  campaign_id?: string
  status?: EmailSend['status'] | 'all'
  start_date?: string
  end_date?: string
}

export interface EmailSendStats {
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalFailed: number
  openRate: number
  clickRate: number
}

export function useEmailSends(filters?: EmailSendFilters) {
  const supabase = createClient()

  return useQuery<EmailSend[]>({
    queryKey: ['email-sends', filters],
    queryFn: async () => {
      let query = supabase
        .from('email_sends')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email),
          campaign:campaigns(id, name)
        `)
        .order('sent_at', { ascending: false })

      // Apply filters
      if (filters?.contact_id) {
        query = query.eq('recipient_contact_id', filters.contact_id)
      }

      if (filters?.campaign_id) {
        query = query.eq('campaign_id', filters.campaign_id)
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      if (filters?.start_date) {
        query = query.gte('sent_at', filters.start_date)
      }

      if (filters?.end_date) {
        query = query.lte('sent_at', filters.end_date)
      }

      const { data, error } = await query.limit(500)

      if (error) throw error
      return data || []
    },
  })
}

export function useEmailSend(emailSendId: string | null) {
  const supabase = createClient()

  return useQuery<EmailSend | null>({
    queryKey: ['email-send', emailSendId],
    queryFn: async () => {
      if (!emailSendId) return null

      const { data, error } = await supabase
        .from('email_sends')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email),
          campaign:campaigns(id, name)
        `)
        .eq('id', emailSendId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!emailSendId,
  })
}

export function useEmailSendStats(filters?: EmailSendFilters) {
  const supabase = createClient()

  return useQuery<EmailSendStats>({
    queryKey: ['email-send-stats', filters],
    queryFn: async () => {
      let query = supabase.from('email_sends').select('status, opened_at, clicked_at')

      // Apply filters
      if (filters?.contact_id) {
        query = query.eq('recipient_contact_id', filters.contact_id)
      }

      if (filters?.campaign_id) {
        query = query.eq('campaign_id', filters.campaign_id)
      }

      if (filters?.start_date) {
        query = query.gte('sent_at', filters.start_date)
      }

      if (filters?.end_date) {
        query = query.lte('sent_at', filters.end_date)
      }

      const { data, error } = await query

      if (error) throw error

      const sends = data || []

      const totalSent = sends.filter((s) => s.status !== 'failed').length
      const totalDelivered = sends.filter((s) => ['delivered', 'opened', 'clicked'].includes(s.status)).length
      const totalOpened = sends.filter((s) => s.opened_at !== null).length
      const totalClicked = sends.filter((s) => s.clicked_at !== null).length
      const totalBounced = sends.filter((s) => s.status === 'bounced').length
      const totalFailed = sends.filter((s) => s.status === 'failed').length

      return {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        totalFailed,
        openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
      }
    },
  })
}

export function useContactEmailHistory(contactId: string | null) {
  const supabase = createClient()

  return useQuery<EmailSend[]>({
    queryKey: ['contact-email-history', contactId],
    queryFn: async () => {
      if (!contactId) return []

      const { data, error } = await supabase
        .from('email_sends')
        .select(`
          *,
          campaign:campaigns(id, name)
        `)
        .eq('recipient_contact_id', contactId)
        .order('sent_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data || []
    },
    enabled: !!contactId,
  })
}

export function useCampaignEmailStats(campaignId: string | null) {
  const supabase = createClient()

  return useQuery<EmailSendStats & { recipients: number; clickToOpenRate: number }>({
    queryKey: ['campaign-email-stats', campaignId],
    queryFn: async () => {
      if (!campaignId) {
        return {
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          totalFailed: 0,
          openRate: 0,
          clickRate: 0,
          clickToOpenRate: 0,
          recipients: 0,
        }
      }

      // Try to use the view for optimized stats
      const { data: statsData, error: statsError } = await supabase
        .from('campaign_email_stats')
        .select('*')
        .eq('campaign_id', campaignId)
        .single()

      if (!statsError && statsData) {
        return {
          totalSent: Number(statsData.total_sent) || 0,
          totalDelivered: Number(statsData.total_delivered) || 0,
          totalOpened: Number(statsData.total_opened) || 0,
          totalClicked: Number(statsData.total_clicked) || 0,
          totalBounced: Number(statsData.total_bounced) || 0,
          totalFailed: Number(statsData.total_failed) || 0,
          openRate: Number(statsData.open_rate) || 0,
          clickRate: Number(statsData.click_rate) || 0,
          clickToOpenRate: Number(statsData.click_to_open_rate) || 0,
          recipients: Number(statsData.total_sent) || 0,
        }
      }

      // Fallback to manual calculation
      const { data, error } = await supabase
        .from('email_sends')
        .select('status, opened_at, clicked_at')
        .eq('campaign_id', campaignId)

      if (error) throw error

      const sends = data || []

      const totalSent = sends.filter((s) => s.status !== 'failed').length
      const totalDelivered = sends.filter((s) => ['delivered', 'opened', 'clicked'].includes(s.status)).length
      const totalOpened = sends.filter((s) => s.opened_at !== null).length
      const totalClicked = sends.filter((s) => s.clicked_at !== null).length
      const totalBounced = sends.filter((s) => s.status === 'bounced').length
      const totalFailed = sends.filter((s) => s.status === 'failed').length

      return {
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        totalFailed,
        openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
        clickToOpenRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
        recipients: sends.length,
      }
    },
    enabled: !!campaignId,
  })
}

// ============================================
// Email Stats Utility Functions
// ============================================

/**
 * Calculate email stats from an array of email sends
 */
export function calculateEmailStats(sends: { status: string; opened_at: string | null; clicked_at: string | null }[]): EmailSendStats & { clickToOpenRate: number } {
  const totalSent = sends.filter((s) => s.status !== 'failed').length
  const totalDelivered = sends.filter((s) => ['delivered', 'opened', 'clicked'].includes(s.status)).length
  const totalOpened = sends.filter((s) => s.opened_at !== null).length
  const totalClicked = sends.filter((s) => s.clicked_at !== null).length
  const totalBounced = sends.filter((s) => s.status === 'bounced').length
  const totalFailed = sends.filter((s) => s.status === 'failed').length

  return {
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    totalBounced,
    totalFailed,
    openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
    clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
    clickToOpenRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
  }
}

/**
 * Format email stat as percentage string
 */
export function formatEmailStatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Get email status badge color
 */
export function getEmailStatusColor(status: EmailSend['status']): string {
  switch (status) {
    case 'sent':
      return 'bg-blue-100 text-blue-700'
    case 'delivered':
      return 'bg-green-100 text-green-700'
    case 'opened':
      return 'bg-emerald-100 text-emerald-700'
    case 'clicked':
      return 'bg-purple-100 text-purple-700'
    case 'bounced':
      return 'bg-orange-100 text-orange-700'
    case 'complained':
      return 'bg-red-100 text-red-700'
    case 'failed':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}
