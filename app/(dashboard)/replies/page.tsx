'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * The Replies page is now the Outlook page.
 *
 * Kept as a redirect rather than deleted, exactly as /email-replies already
 * redirects here: this path is linked from the automation detail sheet, the
 * Needs Attention widget, bookmarks and older emails. Removing it would turn
 * every one of those into a 404 for no gain.
 *
 * The query string is carried across so the ?contactId= deep link from a
 * stopped enrolment still lands on the right contact.
 */
export default function RepliesRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const query = searchParams.toString()
    router.replace(query ? `/outlook?${query}` : '/outlook')
  }, [router, searchParams])

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Outlook...</p>
      </div>
    </div>
  )
}
