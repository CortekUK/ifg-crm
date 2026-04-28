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
      const res = await fetch(`/api/portal/status?contact_id=${contactId}`)
      if (!res.ok) return empty
      return res.json()
    },
  })
}
