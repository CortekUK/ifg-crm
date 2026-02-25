'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useSettings<T = Record<string, unknown>>(key: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['settings', key],
    queryFn: async (): Promise<T | null> => {
      const res = await fetch(`/api/settings?key=${encodeURIComponent(key)}`)
      if (!res.ok) return null
      const data = await res.json()
      return data.value as T
    },
  })

  const mutation = useMutation({
    mutationFn: async (value: T) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save settings')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', key] })
    },
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  }
}

export function useAllSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) return {}
      return res.json()
    },
  })
}
