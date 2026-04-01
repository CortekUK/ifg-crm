'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PanelLeft, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { EditorHeader } from './EditorHeader'
import { EditorSidebar } from './EditorSidebar'
import { EditorCanvas } from './EditorCanvas'
import { EditorPreview } from './EditorPreview'
import { PreviewModal } from './PreviewModal'
import { Skeleton } from '@/components/ui/skeleton'
import { useEmailEditor } from '@/lib/hooks/useEmailEditor'
import { useDeleteTemplate } from '@/lib/hooks/useTemplates'
import { toast } from '@/lib/hooks/use-toast'

interface EmailEditorPageProps {
  templateId?: string
}

export function EmailEditorPage({ templateId }: EmailEditorPageProps) {
  const router = useRouter()
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'canvas' | 'sidebar'>('canvas')
  const deleteTemplateMutation = useDeleteTemplate()

  const {
    blocks,
    settings,
    selectedBlockId,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    setSelectedBlockId,
    addBlock,
    addBlockFromModule,
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

  const handleDeleteTemplate = async () => {
    if (!templateId) return

    try {
      await deleteTemplateMutation.mutateAsync(templateId)
      toast({
        title: 'Template deleted',
        description: `"${settings.name}" has been removed.`,
      })
      router.push('/templates')
    } catch (error) {
      toast({
        title: 'Failed to delete template',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  // Get the currently selected block
  const selectedBlock = selectedBlockId ? blocks.find(b => b.id === selectedBlockId) || null : null

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-white dark:bg-slate-900">
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
          <div className="w-[300px] border-r dark:border-slate-700 p-4 space-y-4 bg-slate-50 dark:bg-slate-900">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="flex-1 p-6 bg-slate-100 dark:bg-slate-900">
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
    <div className="h-screen flex flex-col bg-white dark:bg-slate-900">
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
        onDelete={handleDeleteTemplate}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        isEditingExisting={!!templateId}
      />

      {/* Mobile Panel Toggle */}
      <div className="md:hidden flex items-center gap-1 px-2 py-1.5 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <Button
          variant={mobilePanel === 'sidebar' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setMobilePanel('sidebar')}
        >
          <PanelLeft className="h-3.5 w-3.5 mr-1" />
          Settings
        </Button>
        <Button
          variant={mobilePanel === 'canvas' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setMobilePanel('canvas')}
        >
          Canvas
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs ml-auto"
          onClick={() => setShowPreviewModal(true)}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          Preview
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - hidden on mobile unless toggled */}
        <div className={cn('md:block', mobilePanel === 'sidebar' ? 'block w-full' : 'hidden')}>
          <EditorSidebar
            settings={settings}
            onUpdateSettings={updateSettings}
            onAddBlock={addBlock}
            onAddBlockFromModule={addBlockFromModule}
            selectedBlock={selectedBlock}
            onUpdateBlock={updateBlock}
          />
        </div>

        {/* Canvas - hidden on mobile when sidebar is shown */}
        <div className={cn('md:block flex-1', mobilePanel === 'canvas' ? 'block' : 'hidden')}>
          <EditorCanvas
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onMoveBlock={moveBlock}
            onUpdateBlock={updateBlock}
            onDeleteBlock={deleteBlock}
            onDuplicateBlock={duplicateBlock}
          />
        </div>

        {/* Right Preview - hidden on mobile */}
        <div className="hidden md:block">
          <EditorPreview blocks={blocks} settings={settings} />
        </div>
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
