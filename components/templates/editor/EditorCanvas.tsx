'use client'

import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { CanvasBlock } from './CanvasBlock'
import { LayoutGrid } from 'lucide-react'
import type { EditorBlock } from '@/lib/templates/editor-types'

interface EditorCanvasProps {
  blocks: EditorBlock[]
  selectedBlockId: string | null
  onSelectBlock: (id: string | null) => void
  onMoveBlock: (fromIndex: number, toIndex: number) => void
  onUpdateBlock: (id: string, updates: Partial<EditorBlock['content']>) => void
  onDeleteBlock: (id: string) => void
  onDuplicateBlock: (id: string) => void
}

export function EditorCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onMoveBlock,
  onUpdateBlock,
  onDeleteBlock,
  onDuplicateBlock,
}: EditorCanvasProps) {
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
    <div
      className="flex-1 bg-slate-100 overflow-auto p-6"
      onClick={handleCanvasClick}
    >
      <div className="max-w-[600px] mx-auto">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden min-h-[calc(100vh-200px)]">
          {/* Email Header Preview */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-900 p-4">
            <div className="flex items-center justify-center gap-3">
              <span className="text-white font-bold text-xl">IFG</span>
              <span className="text-white/90 text-sm">International Football Group</span>
            </div>
          </div>

          {/* Canvas Content */}
          <div className="p-4">
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

          {/* Email Footer Preview */}
          <div className="bg-slate-100 p-4 text-center text-xs text-slate-500">
            <p className="mb-1">International Football Group</p>
            <p className="mb-1">Macclesfield FC, United Kingdom</p>
            <a href="#" className="text-blue-600 hover:underline">Unsubscribe</a>
          </div>
        </div>
      </div>
    </div>
  )
}
