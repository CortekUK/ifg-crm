'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type {
  WebsitePackage, WebsitePackageInput, PricingSettings, PricingSettingsInput,
} from '@/lib/types/website-content'

// ── Programme packages ───────────────────────────────────────────────────────
export function usePackages() {
  return useQuery<WebsitePackage[]>({
    queryKey: ['website-packages'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('website_packages')
        .select('*')
        .order('programme', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as WebsitePackage[]
    },
  })
}

export function useSavePackage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: WebsitePackageInput) => {
      const supabase = createClient()
      const { error } = input.id
        ? await supabase.from('website_packages').update(input).eq('id', input.id)
        : await supabase.from('website_packages').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-packages'] }),
  })
}

export function useDeletePackage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('website_packages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-packages'] }),
  })
}

// ── Per-programme pricing settings (default deposit + card fee) ───────────────
export function usePricingSettings() {
  return useQuery<PricingSettings[]>({
    queryKey: ['website-pricing-settings'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('website_pricing_settings')
        .select('*')
        .order('programme', { ascending: true })
      if (error) throw error
      return (data ?? []) as PricingSettings[]
    },
  })
}

export function useSavePricingSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PricingSettingsInput) => {
      const supabase = createClient()
      // programme is the primary key — upsert so a missing row is created.
      const { error } = await supabase
        .from('website_pricing_settings')
        .upsert(input, { onConflict: 'programme' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-pricing-settings'] }),
  })
}
