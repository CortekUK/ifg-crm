'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface AuditEntry {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
  user?: {
    full_name: string | null
    email: string
  }
}

export function useAuditLog(entityType: string, entityId: string | undefined) {
  const supabase = createClient()

  return useQuery<AuditEntry[]>({
    queryKey: ['audit-log', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*, user:profiles!audit_log_user_id_fkey(full_name, email)')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId!)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data as AuditEntry[]
    },
    enabled: !!entityId,
  })
}
