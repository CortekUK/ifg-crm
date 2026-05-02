'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PanelLeft, Eye, Sparkles, MousePointer2, Columns2, LayoutGrid, Monitor } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { EditorHeader } from './EditorHeader'
import { EditorSidebar } from './EditorSidebar'
import { EditorCanvas } from './EditorCanvas'
import { EditorPreview } from './EditorPreview'
import { PreviewModal } from './PreviewModal'
import { AiPromptPanel } from './AiPromptPanel'
import { Skeleton } from '@/components/ui/skeleton'
import { useEmailEditor } from '@/lib/hooks/useEmailEditor'
import { useDeleteTemplate } from '@/lib/hooks/useTemplates'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { toast } from '@/lib/hooks/use-toast'

interface EmailEditorPageProps {
  templateId?: string
}

export function EmailEditorPage({ templateId }: EmailEditorPageProps) {
  const router = useRouter()
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'canvas' | 'sidebar'>('canvas')
  // Editor mode — manual (drag-and-drop) is the existing UX; ai swaps the
  // left sidebar for the AI prompt panel. Only super_admins see the toggle.
  const [editorMode, setEditorMode] = useState<'manual' | 'ai'>('manual')
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  // Three explicit view modes — replaces the previous twin-toggle approach.
  //   both    — canvas + preview side-by-side (preview at a sensible 420px)
  //   canvas  — canvas spans the remaining width, preview hidden
  //   preview — preview spans the remaining width, canvas hidden
  // Eliminates the "everything hidden" edge case for free.
  const [viewMode, setViewMode] = useState<'both' | 'canvas' | 'preview'>('both')
  const showCanvas = viewMode !== 'preview'
  const showPreview = viewMode !== 'canvas'
  const deleteTemplateMutation = useDeleteTemplate()
  const { data: currentUser } = useCurrentUser()
  const canUseAi = currentUser?.role === 'super_admin'

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
    replaceBlocks,
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

      {/* View controls bar — sits between the header and the panes.
          Left side (super_admin only): AI / drag-and-drop mode toggle.
          Right side (everyone): show/hide canvas + preview. Hiding the
          counterpart force-shows the other so the user never ends up
          staring at an empty editor. */}
      <div className="hidden md:flex items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50/30 via-violet-50/20 to-fuchsia-50/30 px-3 py-1.5 dark:border-slate-700 dark:from-indigo-900/10 dark:via-violet-900/10 dark:to-fuchsia-900/10">
        {canUseAi && (
          <>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Mode
            </span>
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setEditorMode('manual')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition',
                  editorMode === 'manual'
                    ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                <MousePointer2 className="h-3.5 w-3.5" />
                Drag & Drop
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('ai')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition',
                  editorMode === 'ai'
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Create with AI
              </button>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {editorMode === 'ai'
                ? 'AI generates blocks — preview updates live.'
                : 'Drag blocks onto the canvas.'}
            </span>
          </>
        )}

        {/* View segmented control — three explicit states. Pushed to the
            right of the bar. Whichever state is active gets the gradient
            pill; inactive states are quiet text-only buttons. */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            View
          </span>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            {(
              [
                { key: 'both', label: 'Both', icon: Columns2 },
                { key: 'canvas', label: 'Canvas', icon: LayoutGrid },
                { key: 'preview', label: 'Preview', icon: Monitor },
              ] as const
            ).map(({ key, label, icon: Icon }) => {
              const active = viewMode === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setViewMode(key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition',
                    active
                      ? 'bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-sm dark:from-slate-100 dark:to-slate-200 dark:text-slate-900'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

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
        {/* Left Sidebar - hidden on mobile unless toggled. In AI mode the
            EditorSidebar is replaced by the AI prompt panel; canvas +
            preview stay identical so the user keeps their live preview.
            `md:flex md:h-full` is needed for the AI panel: its inner scroll
            container relies on the wrapper being a flex column with a
            bounded height, otherwise the lower content overflows the
            viewport and is unreachable. */}
        <div
          className={cn(
            'md:flex md:h-full md:flex-col',
            mobilePanel === 'sidebar' ? 'flex h-full w-full flex-col' : 'hidden md:flex',
          )}
        >
          {editorMode === 'ai' && canUseAi ? (
            <AiPromptPanel
              blocks={blocks}
              settings={settings}
              onApply={(newBlocks, partial) => replaceBlocks(newBlocks, partial)}
              onGenerationStart={() => setIsAiGenerating(true)}
              onGenerationEnd={() => setIsAiGenerating(false)}
            />
          ) : (
            <EditorSidebar
              settings={settings}
              onUpdateSettings={updateSettings}
              onAddBlock={addBlock}
              onAddBlockFromModule={addBlockFromModule}
              selectedBlock={selectedBlock}
              onUpdateBlock={updateBlock}
            />
          )}
        </div>

        {/* Canvas - hidden when the user picked "Preview only". Always
            grabs flex-1 of the remaining width so it spans naturally
            whether or not the preview is alongside it. */}
        {showCanvas && (
          <div
            className={cn(
              'md:flex md:flex-col flex-1 min-h-0',
              mobilePanel === 'canvas' ? 'flex flex-col' : 'hidden md:flex',
            )}
          >
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
        )}

        {/* Right Preview - hidden when the user picked "Canvas only".
            Width depends on view mode:
              both    → fixed 420px, the standard email preview width
              preview → flex-1, takes the entire remaining viewport so the
                        user gets a giant preview to inspect. */}
        {showPreview && (
          <div
            className={cn(
              'hidden md:flex md:flex-col min-h-0',
              viewMode === 'preview' ? 'flex-1' : 'w-[420px]',
            )}
          >
            <EditorPreview blocks={blocks} settings={settings} />
          </div>
        )}
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
