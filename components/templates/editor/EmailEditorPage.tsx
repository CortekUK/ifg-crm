'use client'

// Editor shell. Layout (desktop):
//
//   ┌──────────────────────────────────────────────────────────┐
//   │ Header (single row — title, mode toggle, save buttons)    │
//   ├──────────────┬──────────────────────────────────────┬────┤
//   │              │                                      │ ▶  │
//   │  LEFT PANEL  │           CANVAS                     │    │
//   │  (320px)     │                                      │ ←  │  right-edge
//   │              │                                      │    │  toggle tab
//   │  D&D side or │                                      │ pv │
//   │  AI chat     │                                      │    │
//   │              │                                      │    │
//   └──────────────┴──────────────────────────────────────┴────┘
//
// The preview is a slide-in drawer from the right edge of the canvas
// area, default-closed. When opened it covers the canvas (canvas hides,
// preview takes its space) so the user gets a roomy view without
// surrendering the AI/sidebar column. The right-edge tab toggles it; a
// fullscreen modal is still reachable from the preview's expand icon.
//
// Why a drawer instead of a third permanent pane:
//   * three-pane layouts cramp the canvas at typical laptop widths
//   * users only need preview during review, not while authoring
//   * a slide animation makes the show/hide intent obvious

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PanelLeft, Eye, X } from 'lucide-react'
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
  // Side preview is a slide-out drawer, default closed. The right-edge
  // tab toggles it. When open, it overlays the canvas with a slide-in.
  const [previewVisible, setPreviewVisible] = useState(false)
  const deleteTemplateMutation = useDeleteTemplate()
  const { data: currentUser } = useCurrentUser()
  const canUseAi = currentUser?.role === 'super_admin'

  const {
    blocks,
    settings,
    selectedBlockId,
    isLoading,
    isSaving,
    isAutoSaving,
    lastSavedAt,
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

  const handleClose = () => router.push('/templates')

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
  const selectedBlock = selectedBlockId
    ? blocks.find((b) => b.id === selectedBlockId) || null
    : null

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-white dark:bg-slate-900">
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
        <div className="flex-1 flex">
          <div className="w-[320px] border-r dark:border-slate-700 p-4 space-y-4 bg-slate-50 dark:bg-slate-900">
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
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <EditorHeader
        name={settings.name}
        onNameChange={(name) => updateSettings({ name })}
        onClose={handleClose}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        // Save Draft → mark as draft (is_draft=true) so the templates
        // list tags it. Save & Exit / Update → publish (is_draft=false).
        onSaveDraft={() => saveTemplate(false, false, true)}
        onSaveAndExit={() => saveTemplate(true, false, false)}
        onDelete={handleDeleteTemplate}
        isSaving={isSaving}
        isAutoSaving={isAutoSaving}
        lastSavedAt={lastSavedAt}
        hasUnsavedChanges={hasUnsavedChanges}
        isEditingExisting={!!templateId}
        // Mode toggle now lives in the header — preview lives in the
        // right-edge slide-out drawer, not in the header chrome.
        mode={editorMode}
        onModeChange={setEditorMode}
        canUseAi={canUseAi}
      />

      {/* Mobile panel toggle — kept simple, no mode toggle in mobile.
          The mobile flow is canvas-first; the AI panel and side preview
          aren't built for narrow widths anyway, so we hide them. */}
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

      {/* Workspace — left panel + canvas-with-preview-drawer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — fixed 400px on desktop. Hosts either the
            drag-and-drop sidebar or the AI chat depending on mode. */}
        <div
          className={cn(
            'md:flex md:h-full md:flex-col md:w-[400px] md:shrink-0',
            mobilePanel === 'sidebar' ? 'flex h-full w-full flex-col' : 'hidden md:flex',
          )}
        >
          {editorMode === 'ai' && canUseAi ? (
            <AiPromptPanel
              templateId={templateId}
              blocks={blocks}
              settings={settings}
              // The AI streams blocks in progressive ticks; we forward
              // the {commit} option through so only the final tick
              // pushes a single undo entry covering the whole
              // generation (intermediate ticks update the canvas
              // without polluting the undo stack).
              onApply={(newBlocks, partial, opts) =>
                replaceBlocks(newBlocks, partial, opts)
              }
              onGenerationStart={() => {
                /* reserved for future "AI is working" affordances */
              }}
              onGenerationEnd={() => {
                /* reserved for future "AI is working" affordances */
              }}
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

        {/* Canvas-area wrapper — relative so the preview drawer can
            absolute-position itself within it and slide in from the
            right without leaking outside the canvas region. */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {/* Canvas — always rendered. Hidden behind the drawer when
              the drawer is open (drawer overlays this region). */}
          <div
            className={cn(
              'md:flex md:flex-col absolute inset-0 min-h-0',
              mobilePanel === 'canvas' ? 'flex flex-col' : 'hidden md:flex',
            )}
          >
            <EditorCanvas
              blocks={blocks}
              selectedBlockId={selectedBlockId}
              theme={settings.theme}
              onSelectBlock={setSelectedBlockId}
              onMoveBlock={moveBlock}
              onUpdateBlock={updateBlock}
              onDeleteBlock={deleteBlock}
              onDuplicateBlock={duplicateBlock}
            />
          </div>

          {/* Preview drawer — slides in from the right. translate-x-full
              parks it off-screen to the right when closed, translate-x-0
              brings it flush with the canvas region when open. The
              border-l + shadow on the open state make it feel like a
              real drawer overlaying the canvas. Hidden on mobile (the
              mobile path uses the modal instead). */}
          <div
            aria-hidden={!previewVisible}
            className={cn(
              'absolute inset-0 hidden md:flex md:flex-col bg-white dark:bg-slate-900',
              'transition-transform duration-300 ease-out',
              'border-l border-slate-200 dark:border-slate-700',
              previewVisible
                ? 'translate-x-0 shadow-[-12px_0_24px_-12px_rgba(15,23,42,0.18)] dark:shadow-[-12px_0_24px_-12px_rgba(0,0,0,0.4)]'
                : 'pointer-events-none translate-x-full',
            )}
          >
            <EditorPreview
              blocks={blocks}
              settings={settings}
              onClose={() => setPreviewVisible(false)}
            />
          </div>

          {/* Right-edge toggle tab — prominent so the user can find it
              at a glance. Wider, branded gradient when closed (calls
              attention), neutral white when open. Vertical "Preview"
              label uses writing-mode so the text reads bottom-to-top
              like a real drawer pull-tab.

              Position: anchored to the right edge of the canvas-area
              wrapper. The drawer ends at the same right edge whether
              open or closed, so the tab's screen position is constant —
              we only flip the icon + colour to indicate the next
              action. z-20 keeps it above the drawer overlay. */}
          {/* Tab content is one horizontal flex group ("PREVIEW 👁") that
              we rotate -90° as a whole — that gives a single vertical
              run reading bottom-to-top with the icon RIGHT NEXT to the
              text rather than stacked above it. The wrapper stays fixed
              so the rotation doesn't bleed past the tab bounds. */}
          <button
            type="button"
            onClick={() => setPreviewVisible((v) => !v)}
            title={previewVisible ? 'Hide preview' : 'Show preview'}
            aria-label={previewVisible ? 'Hide preview' : 'Show preview'}
            className={cn(
              'group hidden md:flex absolute right-0 top-1/2 z-20 -translate-y-1/2',
              'h-36 w-9 items-center justify-center overflow-hidden',
              'rounded-l-xl border border-r-0 transition-all',
              previewVisible
                ? 'border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
                : 'border-indigo-400/40 bg-gradient-to-b from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-600 hover:to-violet-700 hover:shadow-indigo-500/40',
            )}
          >
            <span className="flex -rotate-90 items-center gap-1.5 whitespace-nowrap">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                Preview
              </span>
              {previewVisible ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </span>
          </button>
        </div>
      </div>

      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        blocks={blocks}
        settings={settings}
      />
    </div>
  )
}
