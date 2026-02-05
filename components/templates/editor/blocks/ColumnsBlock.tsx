'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Columns, Plus, Type, Image, MousePointer2, Minus, Square, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ColumnsBlockContent, EditorBlock, BlockType, defaultBlockContent } from '@/lib/templates/editor-types'

// Mini block components for rendering inside columns
import { TextBlock } from './TextBlock'
import { ImageBlock } from './ImageBlock'
import { ButtonBlock } from './ButtonBlock'
import { DividerBlock } from './DividerBlock'
import { SpacerBlock } from './SpacerBlock'

interface ColumnsBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

function generateId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Available block types for columns (subset of main blocks)
const columnBlockTypes: { type: BlockType; icon: React.ElementType; label: string }[] = [
  { type: 'text', icon: Type, label: 'Text' },
  { type: 'image', icon: Image, label: 'Image' },
  { type: 'button', icon: MousePointer2, label: 'Button' },
  { type: 'divider', icon: Minus, label: 'Divider' },
  { type: 'spacer', icon: Square, label: 'Spacer' },
]

// Render a nested block inside a column
function NestedBlock({
  block,
  isParentSelected,
  onUpdate,
  onDelete,
}: {
  block: EditorBlock
  isParentSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const [isHovered, setIsHovered] = useState(false)

  const renderBlock = () => {
    switch (block.type) {
      case 'text':
        return <TextBlock content={block.content} isSelected={false} onUpdate={onUpdate} />
      case 'image':
        return <ImageBlock content={block.content} isSelected={false} onUpdate={onUpdate} />
      case 'button':
        return <ButtonBlock content={block.content} isSelected={false} onUpdate={onUpdate} />
      case 'divider':
        return <DividerBlock content={block.content} isSelected={false} onUpdate={onUpdate} />
      case 'spacer':
        return <SpacerBlock content={block.content} isSelected={false} onUpdate={onUpdate} />
      default:
        return <div className="text-xs text-gray-400">Unsupported block type</div>
    }
  }

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isParentSelected && isHovered && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
      <div className={cn(
        'rounded transition-all',
        isParentSelected && isHovered && 'ring-1 ring-purple-300 bg-purple-50/50'
      )}>
        {renderBlock()}
      </div>
    </div>
  )
}

// Add Block Button with Popover
function AddBlockButton({
  onAddBlock,
  columnName,
}: {
  onAddBlock: (type: BlockType) => void
  columnName: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-400"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add to {columnName}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="center">
        <div className="space-y-1">
          {columnBlockTypes.map((item) => (
            <button
              key={item.type}
              onClick={() => {
                onAddBlock(item.type)
                setOpen(false)
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-purple-50 transition-colors text-left"
            >
              <item.icon className="h-4 w-4 text-purple-500" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ColumnsBlock({ content, isSelected, onUpdate }: ColumnsBlockProps) {
  const columnsContent = content as unknown as ColumnsBlockContent

  const handleColumnCountChange = (count: '2' | '3') => {
    const numCols = parseInt(count) as 2 | 3
    if (numCols === 2) {
      onUpdate({
        columns: 2,
        columnWidths: [50, 50],
        centerBlocks: undefined,
      })
    } else {
      onUpdate({
        columns: 3,
        columnWidths: [33, 34, 33],
        centerBlocks: columnsContent.centerBlocks || [],
      })
    }
  }

  const addBlockToColumn = (column: 'left' | 'center' | 'right', type: BlockType) => {
    const newBlock: EditorBlock = {
      id: generateId(),
      type,
      content: { ...defaultBlockContent[type] },
    }

    if (column === 'left') {
      onUpdate({
        leftBlocks: [...(columnsContent.leftBlocks || []), newBlock],
      })
    } else if (column === 'center') {
      onUpdate({
        centerBlocks: [...(columnsContent.centerBlocks || []), newBlock],
      })
    } else {
      onUpdate({
        rightBlocks: [...(columnsContent.rightBlocks || []), newBlock],
      })
    }
  }

  const updateNestedBlock = (column: 'left' | 'center' | 'right', blockId: string, updates: Record<string, unknown>) => {
    const blocksKey = column === 'left' ? 'leftBlocks' : column === 'center' ? 'centerBlocks' : 'rightBlocks'
    const blocks = columnsContent[blocksKey] || []

    onUpdate({
      [blocksKey]: blocks.map((block: EditorBlock) =>
        block.id === blockId ? { ...block, content: { ...block.content, ...updates } } : block
      ),
    })
  }

  const deleteNestedBlock = (column: 'left' | 'center' | 'right', blockId: string) => {
    const blocksKey = column === 'left' ? 'leftBlocks' : column === 'center' ? 'centerBlocks' : 'rightBlocks'
    const blocks = columnsContent[blocksKey] || []

    onUpdate({
      [blocksKey]: blocks.filter((block: EditorBlock) => block.id !== blockId),
    })
  }

  const renderColumn = (
    blocks: EditorBlock[] | undefined,
    column: 'left' | 'center' | 'right',
    label: string,
    widthPercent: number
  ) => (
    <div
      className={cn(
        'min-h-[80px] rounded-lg border-2 border-dashed flex flex-col p-3',
        isSelected
          ? 'border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10'
          : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50'
      )}
      style={{ width: `${widthPercent}%` }}
    >
      {blocks && blocks.length > 0 ? (
        <div className="space-y-2 flex-1">
          {blocks.map((block) => (
            <NestedBlock
              key={block.id}
              block={block}
              isParentSelected={isSelected}
              onUpdate={(updates) => updateNestedBlock(column, block.id, updates)}
              onDelete={() => deleteNestedBlock(column, block.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Columns className="h-5 w-5 text-slate-400 dark:text-slate-500 mb-1" />
          <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
        </div>
      )}

      {isSelected && (
        <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800 flex justify-center">
          <AddBlockButton
            onAddBlock={(type) => addBlockToColumn(column, type)}
            columnName={label}
          />
        </div>
      )}
    </div>
  )

  return (
    <div
      style={{
        paddingTop: `${columnsContent.paddingTop || 10}px`,
        paddingBottom: `${columnsContent.paddingBottom || 10}px`,
      }}
    >
      {/* Settings panel when selected */}
      {isSelected && (
        <div className="flex items-center gap-4 mb-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-purple-700 dark:text-purple-300">Columns:</Label>
            <Select
              value={String(columnsContent.columns || 2)}
              onValueChange={handleColumnCountChange}
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-purple-700 dark:text-purple-300">Gap:</Label>
            <Input
              type="number"
              value={columnsContent.gap || 20}
              onChange={(e) => onUpdate({ gap: parseInt(e.target.value) || 20 })}
              className="h-7 w-16 text-xs"
              min={0}
              max={60}
            />
            <span className="text-xs text-purple-600 dark:text-purple-400">px</span>
          </div>
        </div>
      )}

      {/* Column Preview */}
      <div
        className="flex"
        style={{ gap: `${columnsContent.gap || 20}px` }}
      >
        {/* Left Column */}
        {renderColumn(
          columnsContent.leftBlocks,
          'left',
          'Left',
          columnsContent.columnWidths?.[0] || 50
        )}

        {/* Center Column (for 3-column layout) */}
        {columnsContent.columns === 3 &&
          renderColumn(
            columnsContent.centerBlocks,
            'center',
            'Center',
            columnsContent.columnWidths?.[1] || 34
          )}

        {/* Right Column */}
        {renderColumn(
          columnsContent.rightBlocks,
          'right',
          'Right',
          columnsContent.columnWidths?.[columnsContent.columns === 3 ? 2 : 1] || 50
        )}
      </div>
    </div>
  )
}
