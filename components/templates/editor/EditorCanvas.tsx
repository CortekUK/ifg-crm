'use client'

import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { CanvasBlock } from './CanvasBlock'
import { LayoutGrid } from 'lucide-react'
import type { EditorBlock, TemplateTheme } from '@/lib/templates/editor-types'
import { resolveTheme } from '@/lib/templates/render-html'

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
          {/* Email Header — colour comes from the theme. */}
          <div style={{ backgroundColor: t.headerBgColor }} className="px-5 py-5 text-center">
            <table cellPadding={0} cellSpacing={0} border={0} className="mx-auto">
              <tbody>
                <tr>
                  <td style={{ verticalAlign: 'middle' }}>
                    <span style={{ color: t.headerTextColor, fontSize: 24, fontWeight: 700 }}>IFG</span>
                  </td>
                  <td style={{ verticalAlign: 'middle', paddingLeft: 10 }}>
                    <span style={{ color: t.headerTextColor, fontSize: 16 }}>International Football Group</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

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
          </div>

          {/* Email Footer — colours come from the theme. */}
          <div
            style={{ backgroundColor: t.footerBgColor, color: t.footerTextColor, fontSize: 12 }}
            className="px-5 py-5 text-center"
          >
            <p style={{ margin: '0 0 10px 0' }}>International Football Group</p>
            <p style={{ margin: '0 0 10px 0' }}>Macclesfield FC, United Kingdom</p>
            <a href="#" style={{ color: t.footerLinkColor, textDecoration: 'underline' }}>
              Unsubscribe
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
