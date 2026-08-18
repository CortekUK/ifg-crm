'use client'

import { useMemo, useState } from 'react'
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

/**
 * Draft editing for the global branding, used by the template editor.
 *
 * Pending edits are held as a shallow patch over the server config rather
 * than copied into state, so there is no effect syncing a local copy — the
 * draft simply falls out of `{...serverConfig, ...patch}`. That keeps the
 * server as the source of truth (a save by someone else shows up on the
 * next refetch) and makes "dirty" a plain key count.
 *
 * Saving is explicit on purpose. Every other edit in the template editor
 * auto-saves, but this one rewrites the header and footer of EVERY
 * template, so it should never happen as a side effect of clicking around.
 */
export function useBrandingDraft() {
  const { data, isLoading, save, isSaving } = useEmailBranding()
  const [patch, setPatch] = useState<Partial<EmailBranding>>({})

  const config = data?.config
  const branding = useMemo(
    () => (config ? { ...config, ...patch } : null),
    [config, patch],
  )

  const updateSection = <K extends keyof EmailBranding>(
    key: K,
    value: EmailBranding[K],
  ) => setPatch((prev) => ({ ...prev, [key]: value }))

  const discard = () => setPatch({})

  const publish = async () => {
    if (!branding) return
    await save(branding)
    setPatch({})
  }

  return {
    branding,
    isLoading,
    isDirty: Object.keys(patch).length > 0,
    isSaving,
    updateSection,
    discard,
    publish,
  }
}
