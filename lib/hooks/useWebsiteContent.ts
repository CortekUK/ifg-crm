'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type {
  SuccessStory,
  SuccessStoryInput,
  GalleryCategory,
  GalleryCategoryInput,
  SiteContentItem,
  SiteContentInput,
} from '@/lib/types/website-content'

// ── Success Stories ────────────────────────────────────────────────────────
export function useSuccessStories() {
  return useQuery<SuccessStory[]>({
    queryKey: ['website-stories'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('website_success_stories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SuccessStory[]
    },
  })
}

export function useSaveStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SuccessStoryInput) => {
      const supabase = createClient()
      const { error } = input.id
        ? await supabase.from('website_success_stories').update(input).eq('id', input.id)
        : await supabase.from('website_success_stories').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-stories'] }),
  })
}

// ── Gallery ────────────────────────────────────────────────────────────────
export function useGalleryCategories() {
  return useQuery<GalleryCategory[]>({
    queryKey: ['website-gallery'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('website_gallery_categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as GalleryCategory[]
    },
  })
}

export function useSaveGallery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: GalleryCategoryInput) => {
      const supabase = createClient()
      const { error } = input.id
        ? await supabase.from('website_gallery_categories').update(input).eq('id', input.id)
        : await supabase.from('website_gallery_categories').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-gallery'] }),
  })
}

// ── Site Content (ID Clinics etc.) ──────────────────────────────────────────
export function useSiteContent() {
  return useQuery<SiteContentItem[]>({
    queryKey: ['website-site-content'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('website_site_content')
        .select('*')
        .order('type', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SiteContentItem[]
    },
  })
}

export function useSaveSiteContent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SiteContentInput) => {
      const supabase = createClient()
      const { error } = input.id
        ? await supabase.from('website_site_content').update(input).eq('id', input.id)
        : await supabase.from('website_site_content').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['website-site-content'] }),
  })
}

// ── Shared delete ───────────────────────────────────────────────────────────
type ContentTable =
  | 'website_success_stories'
  | 'website_gallery_categories'
  | 'website_site_content'

const TABLE_TO_KEY: Record<ContentTable, string> = {
  website_success_stories: 'website-stories',
  website_gallery_categories: 'website-gallery',
  website_site_content: 'website-site-content',
}

export function useDeleteContent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ table, id }: { table: ContentTable; id: string }) => {
      const supabase = createClient()
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, { table }) => qc.invalidateQueries({ queryKey: [TABLE_TO_KEY[table]] }),
  })
}
