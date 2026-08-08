import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ContactTag } from '@/lib/types/contacts'

export interface TagWithCount extends ContactTag {
  contact_count: number
  created_at: string
}

export function useTags() {
  const supabase = createClient()

  return useQuery<ContactTag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
  })
}

export function useTagsWithCounts() {
  const supabase = createClient()

  return useQuery<TagWithCount[]>({
    queryKey: ['tags', 'with-counts'],
    queryFn: async () => {
      const { data: tags, error } = await supabase
        .from('tags')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!tags || tags.length === 0) return []

      // Count in the database, not here. Reading every contact_tags row to
      // count it client-side stopped being merely slow once there were 350k of
      // them: PostgREST caps a response at 1000 rows, so the counts silently
      // came from a fraction of the table.
      const { data: counts, error: countError } = await supabase
        .rpc('get_tag_contact_counts')

      if (countError) throw countError

      const countMap = new Map<string, number>()
      counts?.forEach((c: { tag_id: string; contact_count: number }) => {
        countMap.set(c.tag_id, Number(c.contact_count))
      })

      return tags.map((tag) => ({
        ...tag,
        contact_count: countMap.get(tag.id) || 0,
      }))
    },
  })
}

export function useTagContacts(tagId: string | null, page = 1, pageSize = 20, search?: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['tag-contacts', tagId, page, pageSize, search],
    queryFn: async () => {
      if (!tagId) return { contacts: [], total: 0 }

      const offset = (page - 1) * pageSize

      let query = supabase
        .from('contact_tags')
        .select(`
          contact_id,
          tag_id,
          added_at,
          contact:contacts!inner(*)
        `, { count: 'exact' })
        .eq('tag_id', tagId)

      if (search?.trim()) {
        const term = search.trim()
        query = query.or(
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`,
          { referencedTable: 'contacts' }
        )
      }

      const { data, count, error } = await query
        .order('added_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (error) throw error

      return {
        contacts: data || [],
        total: count || 0,
      }
    },
    enabled: !!tagId,
  })
}

export function useCreateTag() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { name: string; color: string; category?: string | null; description?: string | null }) => {
      const { data, error } = await supabase
        .from('tags')
        .insert({
          name: input.name,
          color: input.color,
          category: input.category || null,
          description: input.description || null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

export function useUpdateTag() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { id: string; name?: string; color?: string; category?: string | null; description?: string | null }) => {
      const updateData: Record<string, unknown> = {}
      if (input.name !== undefined) updateData.name = input.name
      if (input.color !== undefined) updateData.color = input.color
      if (input.category !== undefined) updateData.category = input.category
      if (input.description !== undefined) updateData.description = input.description

      const { data, error } = await supabase
        .from('tags')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

export function useDeleteTag() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] })
    },
  })
}

export function useBulkDeleteTags() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (tagIds: string[]) => {
      const { error } = await supabase
        .from('tags')
        .delete()
        .in('id', tagIds)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] })
    },
  })
}

export function useMergeTags() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ keepTagId, mergeTagIds }: { keepTagId: string; mergeTagIds: string[] }) => {
      // For each tag being merged, reassign its contacts to the keep tag
      for (const mergeId of mergeTagIds) {
        // Get contacts that have the merge tag
        const { data: mergeContacts } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .eq('tag_id', mergeId)

        if (mergeContacts && mergeContacts.length > 0) {
          const contactIds = mergeContacts.map((c) => c.contact_id)

          // Upsert contacts into the keep tag (ignore duplicates)
          const records = contactIds.map((contactId) => ({
            contact_id: contactId,
            tag_id: keepTagId,
          }))

          await supabase
            .from('contact_tags')
            .upsert(records, { onConflict: 'contact_id,tag_id' })
        }

        // Delete the merged tag (cascade deletes its contact_tags)
        const { error } = await supabase
          .from('tags')
          .delete()
          .eq('id', mergeId)

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-tags'] })
    },
  })
}
