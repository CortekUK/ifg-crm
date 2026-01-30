'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EditorHeader } from './EditorHeader'
import { EditorSidebar } from './EditorSidebar'
import { EditorCanvas } from './EditorCanvas'
import { EditorPreview } from './EditorPreview'
import { PreviewModal } from './PreviewModal'
import { Skeleton } from '@/components/ui/skeleton'
import { useEmailEditor } from '@/lib/hooks/useEmailEditor'

interface EmailEditorPageProps {
  templateId?: string
}

export function EmailEditorPage({ templateId }: EmailEditorPageProps) {
  const router = useRouter()
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  const {
    blocks,
    settings,
    selectedBlockId,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    setSelectedBlockId,
    addBlock,
    updateBlock,
    deleteBlock,
    duplicateBlock,
    moveBlock,
    updateSettings,
    undo,
    redo,
    canUndo,
    canRedo,
    saveTemplate,
  } = useEmailEditor(templateId)

  const handleClose = () => {
    router.push('/templates')
  }

  // Get the currently selected block
  const selectedBlock = selectedBlockId ? blocks.find(b => b.id === selectedBlockId) || null : null

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-white">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="flex-1 flex">
          <div className="w-[300px] border-r p-4 space-y-4 bg-slate-50">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="flex-1 p-6 bg-slate-100">
            <div className="max-w-[600px] mx-auto">
              <Skeleton className="h-12 w-full mb-4" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
          <div className="w-[400px] border-l p-4 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <EditorHeader
        name={settings.name}
        onNameChange={(name) => updateSettings({ name })}
        onClose={handleClose}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onPreview={() => setShowPreviewModal(true)}
        onSaveDraft={() => saveTemplate(false)}
        onSaveAndExit={() => saveTemplate(true)}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <EditorSidebar
          settings={settings}
          onUpdateSettings={updateSettings}
          onAddBlock={addBlock}
          selectedBlock={selectedBlock}
          onUpdateBlock={updateBlock}
        />

        {/* Canvas */}
        <EditorCanvas
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
          onMoveBlock={moveBlock}
          onUpdateBlock={updateBlock}
          onDeleteBlock={deleteBlock}
          onDuplicateBlock={duplicateBlock}
        />

        {/* Right Preview */}
        <EditorPreview blocks={blocks} settings={settings} />
      </div>

      {/* Preview Modal */}
      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        blocks={blocks}
        settings={settings}
      />
    </div>
  )
}
