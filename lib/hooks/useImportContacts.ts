import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { buildContactFromRow, extractTagsFromRow } from '@/lib/utils/csv'

export type DuplicateStrategy = 'skip' | 'update'

export interface ImportOptions {
  rows: string[][]
  mapping: Record<number, string>
  listId: string | null
  duplicateStrategy: DuplicateStrategy
  onProgress?: (processed: number, total: number) => void
}

export interface ImportResult {
  total: number
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
}

const BATCH_SIZE = 50

export function useImportContacts() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (options: ImportOptions): Promise<ImportResult> => {
      const { rows, mapping, listId, duplicateStrategy, onProgress } = options
      const result: ImportResult = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [] }
      let processed = 0

      // Find the "All Contacts Everyone" list (case-insensitive to handle naming variations)
      const { data: allContactsList } = await supabase
        .from('lists')
        .select('id')
        .ilike('name', '%all contacts%everyone%')
        .limit(1)
        .single()

      const allContactIds: string[] = []
      // Track which contact ID corresponds to which row (for tag assignment)
      const contactRowMap: { contactId: string; rowIndex: number }[] = []

      // Check if tags column is mapped
      const hasTagsMapping = Object.values(mapping).includes('__tags__')

      // Process in batches
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)

        if (duplicateStrategy === 'update') {
          // Upsert individually to track which row produced which contact ID
          for (let j = 0; j < batch.length; j++) {
            const rowIdx = i + j
            const record = {
              ...buildContactFromRow(batch[j], mapping),
              source: 'csv_import' as const,
              sport: 'football' as const,
            }

            const { data: single, error: singleErr } = await supabase
              .from('contacts')
              .upsert(record, { onConflict: 'email' })
              .select('id')
              .single()

            if (singleErr) {
              result.errors.push({ row: rowIdx + 1, message: singleErr.message })
            } else if (single) {
              result.updated++
              allContactIds.push(single.id)
              if (hasTagsMapping) {
                contactRowMap.push({ contactId: single.id, rowIndex: rowIdx })
              }
            }

            processed++
            onProgress?.(processed, rows.length)
          }
        } else {
          // Skip strategy: insert individually, catch duplicate errors
          for (let j = 0; j < batch.length; j++) {
            const rowIdx = i + j
            const contactFields = buildContactFromRow(batch[j], mapping)
            const record = {
              ...contactFields,
              source: 'csv_import' as const,
              sport: 'football' as const,
            }

            const { data, error } = await supabase
              .from('contacts')
              .insert(record)
              .select('id')
              .single()

            if (error) {
              if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate')) {
                result.skipped++
                // Look up the existing contact so it still gets added to lists
                const email = contactFields.email as string | undefined
                if (email) {
                  const { data: existing } = await supabase
                    .from('contacts')
                    .select('id')
                    .eq('email', email)
                    .single()
                  if (existing) {
                    allContactIds.push(existing.id)
                    if (hasTagsMapping) {
                      contactRowMap.push({ contactId: existing.id, rowIndex: rowIdx })
                    }
                  }
                }
              } else {
                result.errors.push({ row: rowIdx + 1, message: error.message })
              }
            } else if (data) {
              result.created++
              allContactIds.push(data.id)
              if (hasTagsMapping) {
                contactRowMap.push({ contactId: data.id, rowIndex: rowIdx })
              }
            }

            processed++
            onProgress?.(processed, rows.length)
          }
        }
      }

      // Process tags if mapped
      if (hasTagsMapping && contactRowMap.length > 0) {
        // Collect all unique tag names from the imported rows
        const allTagNames = new Set<string>()
        for (const { rowIndex } of contactRowMap) {
          const tagNames = extractTagsFromRow(rows[rowIndex], mapping)
          tagNames.forEach((t) => allTagNames.add(t))
        }

        if (allTagNames.size > 0) {
          // Find existing tags
          const { data: existingTags } = await supabase
            .from('tags')
            .select('id, name')
            .in('name', [...allTagNames])

          const tagNameToId = new Map<string, string>()
          existingTags?.forEach((t) => tagNameToId.set(t.name.toLowerCase(), t.id))

          // Create missing tags
          const missingNames = [...allTagNames].filter((n) => !tagNameToId.has(n.toLowerCase()))
          if (missingNames.length > 0) {
            const { data: newTags } = await supabase
              .from('tags')
              .insert(missingNames.map((name) => ({ name, color: '#6B7280', category: 'other' as const })))
              .select('id, name')

            newTags?.forEach((t) => tagNameToId.set(t.name.toLowerCase(), t.id))
          }

          // Insert contact_tags associations
          const contactTagRecords: { contact_id: string; tag_id: string }[] = []
          for (const { contactId, rowIndex } of contactRowMap) {
            const tagNames = extractTagsFromRow(rows[rowIndex], mapping)
            for (const tagName of tagNames) {
              const tagId = tagNameToId.get(tagName.toLowerCase())
              if (tagId) {
                contactTagRecords.push({ contact_id: contactId, tag_id: tagId })
              }
            }
          }

          // Insert in batches, ignoring duplicates
          for (let i = 0; i < contactTagRecords.length; i += BATCH_SIZE) {
            const batch = contactTagRecords.slice(i, i + BATCH_SIZE)
            await supabase
              .from('contact_tags')
              .upsert(batch, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true })
          }
        }
      }

      // Add to selected list
      if (listId && allContactIds.length > 0) {
        for (let i = 0; i < allContactIds.length; i += BATCH_SIZE) {
          const batch = allContactIds.slice(i, i + BATCH_SIZE)
          await supabase
            .from('contact_lists')
            .upsert(
              batch.map((contactId) => ({ list_id: listId, contact_id: contactId })),
              { onConflict: 'contact_id,list_id' }
            )
        }
      }

      // Add to "All Contacts Everyone" list
      if (allContactsList && allContactIds.length > 0) {
        for (let i = 0; i < allContactIds.length; i += BATCH_SIZE) {
          const batch = allContactIds.slice(i, i + BATCH_SIZE)
          await supabase
            .from('contact_lists')
            .upsert(
              batch.map((contactId) => ({ list_id: allContactsList.id, contact_id: contactId })),
              { onConflict: 'contact_id,list_id' }
            )
        }
      }

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-stats'] })
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['list-stats'] })
      queryClient.invalidateQueries({ queryKey: ['contacts-positions'] })
      queryClient.invalidateQueries({ queryKey: ['contacts-countries'] })
    },
  })
}
