'use client'

import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { CanvasBlock } from './CanvasBlock'
import { LayoutGrid, Lock, Settings2 } from 'lucide-react'
import type { EditorBlock, TemplateTheme } from '@/lib/templates/editor-types'
import { resolveTheme } from '@/lib/templates/render-html'
import { useEmailBrandingConfig } from '@/lib/hooks/useEmailBranding'
import { previewMergeTags } from '@/lib/utils/mergeTags'

// The header and footer are global, not part of this template. Rendering
// the real branding HTML here (rather than a hand-maintained mock-up) means
// the canvas can't drift from what actually gets sent — it IS the same
// markup. It's shown read-only with a route through to the one place it can
// be changed.
function LockedGlobalRegion({
  html,
  label,
}: {
  html: string
  label: string
}) {
  if (!html) return null
  return (
    <div className="group relative">
      <div
        className="pointer-events-none select-none"
        dangerouslySetInnerHTML={{ __html: previewMergeTags(html, {}) }}
      />
      <div className="pointer-events-none absolute inset-0 bg-slate-900/0 transition-colors group-hover:bg-slate-900/5" />
      <Link
        href="/settings?section=email-branding"
        className="absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-md bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
        title="This section is shared by every template"
      >
        <Lock className="h-3 w-3" />
        {label}
        <Settings2 className="h-3 w-3" />
      </Link>
    </div>
  )
}

interface EditorCanvasProps {
  blocks: EditorBlock[]
  selectedBlockId: string | null
  // The active template theme — undefined means use defaults. Drives
  // the chrome colours so what the user sees here matches what gets
  // sent.
  theme?: TemplateTheme | null
  onSelectBlock: (id: string | null) => void
  onMoveBlock: (fromIndex: number, toIndex: number) => void
  onUpdateBlock: (id: string, updates: Partial<EditorBlock['content']>) => void
  onDeleteBlock: (id: string) => void
  onDuplicateBlock: (id: string) => void
}

export function EditorCanvas({
  blocks,
  selectedBlockId,
  theme,
  onSelectBlock,
  onMoveBlock,
  onUpdateBlock,
  onDeleteBlock,
  onDuplicateBlock,
}: EditorCanvasProps) {
  const t = resolveTheme(theme)
  const { data: branding } = useEmailBrandingConfig()
  const slots = branding?.rendered ?? { header: '', footer: '', legal: '' }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    if (result.destination.index === result.source.index) return

    onMoveBlock(result.source.index, result.destination.index)
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Deselect if clicking on canvas background
    if (e.target === e.currentTarget) {
      onSelectBlock(null)
    }
  }

  return (
    // The canvas chrome (outer bg, email card width, header, body
    // padding, footer) MUST mirror what `lib/templates/render-html.ts`
    // emits so what the user sees here is what the recipient gets.
    // Specific values to keep aligned:
    //   * outer bg            #f9fafb   (renderer's <body> bg)
    //   * card max-width      600px     (renderer's <table width="600">)
    //   * header bg / sizes   #0f172a / IFG 24px / subtitle 16px
    //   * body padding        20px      (renderer's <td style="padding:20px">)
    //   * footer bg / fg      #f3f4f6 / #6b7280 / link #3b82f6
    <div
      className="flex-1 overflow-auto px-3 py-4 dark:bg-slate-900 md:px-4 md:py-5"
      style={{ backgroundColor: t.pageBgColor }}
      onClick={handleCanvasClick}
    >
      <div className="mx-auto max-w-[600px]">
        <div
          className="overflow-hidden rounded-lg shadow-sm"
          style={{ backgroundColor: t.bodyBgColor }}
        >
          {/* Global header — shared by every template, edited in Settings. */}
          <LockedGlobalRegion html={slots.header} label="Global header" />

          {/* Canvas Content — 20px padding to match renderer */}
          <div className="p-5">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="canvas">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`
                      min-h-[400px] transition-colors rounded-lg
                      ${snapshot.isDraggingOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''}
                    `}
                  >
                    {blocks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                        <div className="p-4 rounded-full bg-blue-100 mb-4">
                          <LayoutGrid className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">
                          Drag blocks here to build your email
                        </h3>
                        <p className="text-sm text-slate-500">
                          Or click a block in the sidebar to add it
                        </p>
                      </div>
                    ) : (
                      blocks.map((block, index) => (
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={snapshot.isDragging ? 'z-50' : ''}
                            >
                              <CanvasBlock
                                block={block}
                                dragHandleProps={provided.dragHandleProps}
                                isSelected={selectedBlockId === block.id}
                                isDragging={snapshot.isDragging}
                                onSelect={() => onSelectBlock(block.id)}
                                onDelete={() => onDeleteBlock(block.id)}
                                onDuplicate={() => onDuplicateBlock(block.id)}
                                onUpdate={(updates) => onUpdateBlock(block.id, updates)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {/* Global signature / social / partner logos. Sits inside the
                content cell, exactly where the renderer puts it. */}
            <LockedGlobalRegion html={slots.footer} label="Global signature & footer" />
          </div>

          {/* Global footer — shared by every template, edited in Settings. */}
          <LockedGlobalRegion html={slots.legal} label="Global footer" />
        </div>
      </div>
    </div>
  )
}
