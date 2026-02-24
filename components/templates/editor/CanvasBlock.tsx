'use client'

import { useState } from 'react'
import { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { GripVertical, Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TextBlock } from './blocks/TextBlock'
import { ImageBlock } from './blocks/ImageBlock'
import { ButtonBlock } from './blocks/ButtonBlock'
import { DividerBlock } from './blocks/DividerBlock'
import { SpacerBlock } from './blocks/SpacerBlock'
import { VideoBlock } from './blocks/VideoBlock'
import { SocialBlock } from './blocks/SocialBlock'
import { HTMLBlock } from './blocks/HTMLBlock'
import { ColumnsBlock } from './blocks/ColumnsBlock'
import { ConditionalBlock } from './blocks/ConditionalBlock'
import { RecruiterSignatureBlock } from './blocks/RecruiterSignatureBlock'
import { FileBlock } from './blocks/FileBlock'
import type { EditorBlock } from '@/lib/templates/editor-types'

interface CanvasBlockProps {
  block: EditorBlock
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined
  isSelected: boolean
  isDragging: boolean
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
  onUpdate: (updates: Record<string, unknown>) => void
}

export function CanvasBlock({
  block,
  dragHandleProps,
  isSelected,
  isDragging,
  onSelect,
  onDelete,
  onDuplicate,
  onUpdate,
}: CanvasBlockProps) {
  const [isHovered, setIsHovered] = useState(false)

  const renderBlockContent = () => {
    const blockContent = block.content as unknown as Record<string, unknown>
    
    switch (block.type) {
      case 'text':
        return (
          <TextBlock
            content={blockContent}
            isSelected={isSelected}
            onUpdate={onUpdate}
          />
        )
      case 'image':
        return (
          <ImageBlock
            content={blockContent}
            isSelected={isSelected}
            onUpdate={onUpdate}
          />
        )
      case 'button':
        return (
          <ButtonBlock
            content={blockContent}
            isSelected={isSelected}
            onUpdate={onUpdate}
          />
        )
      case 'divider':
        return (
          <DividerBlock
            content={blockContent}
            isSelected={isSelected}
            onUpdate={onUpdate}
          />
        )
      case 'spacer':
        return (
          <SpacerBlock
            content={blockContent}
            isSelected={isSelected}
            onUpdate={onUpdate}
          />
        )
      case 'video':
        return (
          <VideoBlock
            content={blockContent}
            isSelected={isSelected}
            onUpdate={onUpdate}
          />
        )
      case 'social':
        return (
          <SocialBlock
            content={blockContent}
            isSelected={isSelected}
            onUpdate={onUpdate}
          />
        )
      case 'html':
        return (
          <HTMLBlock
            content={blockContent}
            isSelected={isSelected}
            onUpdate={onUpdate}
          />
        )
      case 'columns':
        return (
          <ColumnsBlock
            content={blockContent}
            isSelected={isSelected}
            onUpdate={onUpdate}
          />
        )
      case 'conditional':
        return (
          <ConditionalBlock
            content={blockContent}
            isSelected={isSelected}
            onUpdate={onUpdate}
          />
        )
      case 'recruiter_signature':
        return (
          <RecruiterSignatureBlock
            content={blockContent}
            isSelected={isSelected}
            onUpdate={onUpdate}
          />
        )
      case 'file':
        return (
          <FileBlock
            content={blockContent}
            isSelected={isSelected}
            onUpdate={onUpdate}
          />
        )
      default:
        return <div>Unknown block type</div>
    }
  }

  return (
    <div
      className={cn(
        'group relative mb-2 rounded-lg transition-all border-2',
        isSelected && 'border-blue-500 shadow-md bg-blue-50/30 dark:bg-blue-900/20',
        isDragging && 'shadow-lg opacity-90 border-blue-400',
        !isSelected && !isDragging && 'border-transparent hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
      )}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag Handle */}
      <div
        {...dragHandleProps}
        className={cn(
          'absolute left-0 top-0 bottom-0 w-7 flex items-center justify-center rounded-l-lg',
          'cursor-grab active:cursor-grabbing transition-all',
          isSelected ? 'bg-blue-100 dark:bg-blue-900/50 opacity-100' : 'opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800'
        )}
      >
        <GripVertical className={cn(
          'h-4 w-4',
          isSelected ? 'text-blue-600' : 'text-slate-400'
        )} />
      </div>

      {/* Action Buttons */}
      <div
        className={cn(
          'absolute -top-3 right-2 flex items-center gap-1 z-10 transition-opacity',
          (isSelected || isHovered) ? 'opacity-100' : 'opacity-0'
        )}
      >
        <Button
          variant="secondary"
          size="sm"
          className="h-6 w-6 p-0 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500"
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate()
          }}
        >
          <Copy className="h-3 w-3 text-slate-600 dark:text-slate-400" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-6 w-6 p-0 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-200 dark:hover:border-red-800 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Block Content */}
      <div className="pl-8 pr-2 py-1">
        {renderBlockContent()}
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-lg" />
      )}
    </div>
  )
}
