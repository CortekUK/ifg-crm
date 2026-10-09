import { useQuery } from '@tanstack/react-query'

export type PortalState = 'none' | 'invited' | 'active'

export interface GuardianStatus {
  state: PortalState
  email: string | null
  invited_at: string | null
  last_sign_in_at: string | null
}

export interface PortalStatus {
  state: PortalState
  invited_at: string | null
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  guardian: GuardianStatus
}

const empty: PortalStatus = {
  state: 'none',
  invited_at: null,
  last_sign_in_at: null,
  email_confirmed_at: null,
  guardian: {
    state: 'none',
    email: null,
    invited_at: null,
    last_sign_in_at: null,
  },
}

export function usePortalStatus(contactId: string | null) {
  return useQuery<PortalStatus>({
    queryKey: ['portal-status', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      // no-store matters here. The URL never changes for a given contact, so
      // after inviting a guardian the browser was free to answer the refetch
      // from its own HTTP cache — React Query invalidated correctly and still
      // got the previous answer back, so the panel kept showing the old state
      // until a reload (QA-57 Issue 4).
      const res = await fetch(`/api/portal/status?contact_id=${contactId}`, {
        cache: 'no-store',
      })
      if (!res.ok) return empty
      return res.json()
    },
  })
}
