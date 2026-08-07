'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type {
  WebsiteBrochure,
  WebsiteBrochureInput,
  BrochureStats,
  BrochureLead,
} from '@/lib/types/website-content'

export function slugifyBrochure(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

export function useBrochures() {
  return useQuery<WebsiteBrochure[]>({
    queryKey: ['website-brochures'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('website_brochures')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as WebsiteBrochure[]
    },
  })
}

export function useSaveBrochure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: WebsiteBrochureInput) => {
      const supabase = createClient()
      // Ensure a slug on create.
      const payload = { ...input }
      if (!payload.id && !payload.slug && payload.title) {
        payload.slug = slugifyBrochure(payload.title)
      }
      const { data, error } = payload.id
        ? await supabase.from('website_brochures').update(payload).eq('id', payload.id).select('id').single()
        : await supabase.from('website_brochures').insert(payload).select('id').single()
      if (error) throw error
      return data as { id: string }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-brochures'] }),
  })
}

export function useToggleBrochurePublished() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      const supabase = createClient()
      const { error } = await supabase.from('website_brochures').update({ published }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-brochures'] }),
  })
}

export function useDeleteBrochure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('website_brochures').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-brochures'] }),
  })
}

// ── Stats + associations (bulk, for the management list) ──────────────────────
// Returns a map keyed by brochure_id. Views/downloads live on the brochure row;
// leads + association ids come from the link tables.
export function useBrochureStats() {
  return useQuery<Record<string, BrochureStats>>({
    queryKey: ['brochure-stats'],
    queryFn: async () => {
      const supabase = createClient()
      const [brochures, leads, lists, campaigns, pipelines] = await Promise.all([
        supabase.from('website_brochures').select('id, views_count, download_count'),
        supabase.from('brochure_leads').select('brochure_id'),
        supabase.from('brochure_lists').select('brochure_id, list_id'),
        supabase.from('brochure_campaigns').select('brochure_id, campaign_id'),
        supabase.from('brochure_pipelines').select('brochure_id, pipeline_id, stage_id'),
      ])
      const err = brochures.error || leads.error || lists.error || campaigns.error || pipelines.error
      if (err) throw err

      const map: Record<string, BrochureStats> = {}
      const ensure = (id: string): BrochureStats =>
        (map[id] ??= { brochure_id: id, views: 0, downloads: 0, leads: 0, list_ids: [], campaign_ids: [], pipelines: [] })

      for (const b of brochures.data ?? []) {
        const s = ensure(b.id)
        s.views = b.views_count ?? 0
        s.downloads = b.download_count ?? 0
      }
      for (const r of leads.data ?? []) ensure(r.brochure_id).leads += 1
      for (const r of lists.data ?? []) ensure(r.brochure_id).list_ids.push(r.list_id)
      for (const r of campaigns.data ?? []) ensure(r.brochure_id).campaign_ids.push(r.campaign_id)
      for (const r of pipelines.data ?? [])
        ensure(r.brochure_id).pipelines.push({ pipeline_id: r.pipeline_id, stage_id: r.stage_id })
      return map
    },
  })
}

// The list of contacts a brochure has captured (Publu-style "Collected leads").
export function useBrochureLeads(brochureId: string | null) {
  return useQuery<BrochureLead[]>({
    queryKey: ['brochure-leads', brochureId],
    enabled: !!brochureId,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('brochure_leads')
        .select('created_at, contact:contacts(id, first_name, last_name, email)')
        .eq('brochure_id', brochureId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      type Row = { created_at: string; contact: { id: string; first_name: string; last_name: string; email: string } | null }
      return (data as unknown as Row[] ?? [])
        .filter((r) => r.contact)
        .map((r) => ({
          contact_id: r.contact!.id,
          first_name: r.contact!.first_name,
          last_name: r.contact!.last_name,
          email: r.contact!.email,
          created_at: r.created_at,
        }))
    },
  })
}

// ── Set associations (replace-all semantics for a brochure) ──────────────────
export function useSetBrochureLists() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ brochureId, listIds }: { brochureId: string; listIds: string[] }) => {
      const supabase = createClient()
      await supabase.from('brochure_lists').delete().eq('brochure_id', brochureId)
      if (listIds.length) {
        const { error } = await supabase
          .from('brochure_lists')
          .insert(listIds.map((list_id) => ({ brochure_id: brochureId, list_id })))
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brochure-stats'] }),
  })
}

export function useSetBrochureCampaigns() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ brochureId, campaignIds }: { brochureId: string; campaignIds: string[] }) => {
      const supabase = createClient()
      await supabase.from('brochure_campaigns').delete().eq('brochure_id', brochureId)
      if (campaignIds.length) {
        const { error } = await supabase
          .from('brochure_campaigns')
          .insert(campaignIds.map((campaign_id) => ({ brochure_id: brochureId, campaign_id })))
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brochure-stats'] }),
  })
}

export function useSetBrochurePipelines() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      brochureId,
      rows,
    }: {
      brochureId: string
      rows: { pipeline_id: string; stage_id: string | null }[]
    }) => {
      const supabase = createClient()
      await supabase.from('brochure_pipelines').delete().eq('brochure_id', brochureId)
      if (rows.length) {
        const { error } = await supabase
          .from('brochure_pipelines')
          .insert(rows.map((r) => ({ brochure_id: brochureId, pipeline_id: r.pipeline_id, stage_id: r.stage_id })))
        if (error) throw error
      }
      // Reconcile the "send brochure when a deal enters this stage" automations
      // to match the new attachments (server-side, service role).
      try {
        await fetch('/api/brochures/sync-automations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brochureId }),
        })
      } catch {
        /* non-fatal — attachments are saved; sending sync can be retried */
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brochure-stats'] }),
  })
}
