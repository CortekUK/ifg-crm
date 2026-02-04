'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EmailRepliesRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/replies')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Replies...</p>
      </div>
    </div>
  )
}
