'use client'

// One request for the whole dashboard.
//
// The previous hook fired fourteen parallel queries and did the arithmetic in
// the browser, which is where its wrong numbers came from — anything summed
// client-side was summed over at most 1000 rows. Everything here is counted in
// Postgres by dashboard_overview() (migration 173).

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface DashboardOverview {
  generated_at: string
  contacts: { total: number; added_7d: number; added_prev_7d: number }
  deals: {
    open: number
    open_value: number
    won: number
    created_this_month: number
    created_last_month: number
    stalled: number
  }
  by_stage: {
    stage: string
    pipeline: string
    display_order: number
    colour: string | null
    count: number
    value: number
  }[]
  automation: { active: number; enrolled: number }
  email: { sent_7d: number; sent_today: number; opened_7d: number; failed_7d: number }
  attention: {
    unmatched_sms: number
    unmatched_email: number
    overdue_invoices: number
    overdue_value: number
    brochures_unrendered: number
    draft_templates: number
  }
  finance: {
    paid_this_month: number
    paid_last_month: number
    outstanding: number
    outstanding_count: number
  }
  meetings: { this_week: number; this_month: number }
  last_campaign: {
    id: string
    name: string
    sent_at: string | null
    recipients: number
    delivered: number
    opened: number
    clicked: number
  } | null
  brochures: {
    id: string
    title: string
    slug: string
    people: number
    opens: number
    downloads: number
  }[]
  lead_sources: { source: string; count: number }[]
  top_lists: { id: string; name: string; count: number }[]
  top_tags: { id: string; name: string; colour: string | null; count: number }[]
}

export function useDashboardOverview() {
  const supabase = createClient()

  return useQuery<DashboardOverview>({
    queryKey: ['dashboard-overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_overview')
      if (error) throw error
      return data as DashboardOverview
    },
    // The figures move slowly and the page is the first thing everyone opens;
    // a minute of staleness is cheaper than re-counting 105k contacts on every
    // navigation back to it.
    staleTime: 60_000,
  })
}

/** Percentage change, or null when there is no baseline to compare against. */
export function deltaPercent(current: number, previous: number): number | null {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 100)
}
