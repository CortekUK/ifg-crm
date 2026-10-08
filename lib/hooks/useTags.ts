import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchRankedContactIds } from '@/lib/contacts/search'
import { fetchAll } from '@/lib/reports/csv'
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

      const query = supabase
        .from('contact_tags')
        .select(`
          contact_id,
          tag_id,
          added_at,
          contact:contacts!inner(*)
        `, { count: 'exact' })
        .eq('tag_id', tagId)

      // Searching goes through search_contacts_ranked, scoped to this tag.
      // The old predicate passed the whole typed string to each column, so
      // "Aila Head" asked whether a FIRST NAME contained "Aila Head" and
      // matched nobody — full-name search inside a tag never worked.
      if (search?.trim()) {
        const { ids, total } = await fetchRankedContactIds(supabase, {
          search: search.trim(),
          contactIds: null,
          tagId,
          limit: pageSize,
          offset,
        })

        if (ids.length === 0) return { contacts: [], total }

        const { data, error } = await supabase
          .from('contact_tags')
          .select('contact_id, tag_id, added_at, contact:contacts!inner(*)')
          .eq('tag_id', tagId)
          .in('contact_id', ids)

        if (error) throw error

        // Keep the relevance order the function returned.
        const position = new Map(ids.map((id, i) => [id, i]))
        const ordered = [...(data || [])].sort(
          (a, b) => (position.get(a.contact_id) ?? 0) - (position.get(b.contact_id) ?? 0)
        )

        return { contacts: ordered, total }
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
    // Merging moved only the first 1000 contacts and then deleted the tag,
    // whose cascade took the rest with it. PostgREST caps a response at 1000
    // rows and says so with a plain 200, so the unpaged read below looked like
    // the whole tag. On a tag the size of "2027" (65,136 contacts) a merge
    // silently dropped 64,136 tag assignments, with no error and no way back.
    //
    // So: page the read, write in batches, and only delete once the move has
    // actually succeeded.
    mutationFn: async ({ keepTagId, mergeTagIds }: { keepTagId: string; mergeTagIds: string[] }) => {
      const UPSERT_BATCH = 1000

      for (const mergeId of mergeTagIds) {
        const mergeContacts = await fetchAll<{ contact_id: string }>(() =>
          supabase.from('contact_tags').select('contact_id').eq('tag_id', mergeId),
        )

        if (mergeContacts.length > 0) {
          const records = mergeContacts.map((c) => ({
            contact_id: c.contact_id,
            tag_id: keepTagId,
          }))

          // One upsert of 65k rows is a request big enough to be refused.
          for (let i = 0; i < records.length; i += UPSERT_BATCH) {
            const { error: upsertError } = await supabase
              .from('contact_tags')
              .upsert(records.slice(i, i + UPSERT_BATCH), { onConflict: 'contact_id,tag_id' })

            // Stop before the delete — a half-moved tag that still exists can
            // be merged again, but one that has been deleted cannot.
            if (upsertError) {
              throw new Error(
                `Could not move contacts onto the tag you are keeping, so nothing was deleted: ${upsertError.message}`,
              )
            }
          }
        }

        // Safe now: every contact on the merged tag also carries the kept one.
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
