// Scout memory settings — Claude-style memory tab.
//
// The /scout layout already gates by super_admin (redirects everyone else),
// so this page inherits that protection. The client component does all the
// CRUD against /api/scout/memory.

import { ScoutMemoryPage } from '@/components/scout/ScoutMemoryPage'

export default function MemoryPage() {
  return <ScoutMemoryPage />
}
