'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'
import type { EditorBlock, BlockType } from '@/lib/templates/editor-types'

export interface SavedModule {
  id: string
  name: string
  description: string | null
  block_type: BlockType
  block_content: Record<string, unknown>
  thumbnail_url: string | null
  created_by_id: string | null
  created_at: string
  updated_at: string
}

export interface CreateModuleInput {
  name: string
  description?: string
  block_type: BlockType
  block_content: Record<string, unknown>
}

// Fetch all saved modules
export function useSavedModules() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['saved-modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_template_modules')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as SavedModule[]
    },
  })
}

// Save a block as a module
export function useSaveModule() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateModuleInput) => {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('email_template_modules')
        .insert({
          name: input.name,
          description: input.description || null,
          block_type: input.block_type,
          block_content: input.block_content,
          created_by_id: user?.id,
        })
        .select()
        .single()

      if (error) throw error
      return data as SavedModule
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-modules'] })
      toast({
        title: 'Module saved',
        description: 'Your block has been saved as a reusable module.',
      })
    },
    onError: (error) => {
      toast({
        title: 'Failed to save module',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    },
  })
}

// Delete a saved module
export function useDeleteModule() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (moduleId: string) => {
      const { error } = await supabase
        .from('email_template_modules')
        .delete()
        .eq('id', moduleId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-modules'] })
      toast({
        title: 'Module deleted',
        description: 'The module has been removed.',
      })
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete module',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    },
  })
}

// Convert a saved module back to an EditorBlock
export function moduleToBlock(module: SavedModule): EditorBlock {
  return {
    id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: module.block_type,
    content: { ...module.block_content },
  }
}
