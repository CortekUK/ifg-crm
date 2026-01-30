'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { EmailEditorPage } from '@/components/templates/editor/EmailEditorPage'

function EditorPageContent() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get('id') || undefined

  return <EmailEditorPage templateId={templateId} />
}

export default function EditorPage() {
  return (
    <Suspense fallback={<EditorLoadingSkeleton />}>
      <EditorPageContent />
    </Suspense>
  )
}

function EditorLoadingSkeleton() {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-500">Loading editor...</p>
      </div>
    </div>
  )
}
