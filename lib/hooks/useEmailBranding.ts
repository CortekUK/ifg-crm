'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { EmailBranding } from '@/lib/templates/branding-types'
import type { BrandingSlots } from '@/lib/templates/render-html'

interface BrandingResponse {
  config: EmailBranding
  rendered: BrandingSlots
  rendered_at: string | null
  /** Saved HTML predates the current renderer — republish to refresh it. */
  stale: boolean
}

/**
 * Read/write the single global email-branding record.
 *
 * Note this deliberately does NOT go through `useSettings`: branding needs
 * server-side rendering on save (so logo URLs resolve against the public
 * origin rather than the browser's), which the generic settings endpoint
 * doesn't do.
 */
export function useEmailBranding() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['email-branding'],
    queryFn: async (): Promise<BrandingResponse> => {
      const res = await fetch('/api/settings/email-branding')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to load email branding')
      }
      return res.json()
    },
  })

  const mutation = useMutation({
    mutationFn: async (config: EmailBranding) => {
      const res = await fetch('/api/settings/email-branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to save email branding')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-branding'] })
      // Template previews embed the branding, so they must re-render too.
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  }
}

/**
 * Branding for read-only consumers (template previews, the editor canvas).
 * Falls back to `null` on failure so a preview still renders unbranded
 * rather than throwing.
 */
export function useEmailBrandingConfig() {
  return useQuery({
    queryKey: ['email-branding'],
    queryFn: async (): Promise<BrandingResponse | null> => {
      const res = await fetch('/api/settings/email-branding')
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}
