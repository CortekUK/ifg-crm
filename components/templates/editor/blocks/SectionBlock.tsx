'use client'

// The band: a full-width strip with its own background and its own text
// colour, holding other blocks.
//
// The editor mirrors the renderer's inheritance rule — set the band dark and
// the preview of everything inside it goes light, through the same theme
// context the real renderer uses. Without that the canvas would show black
// type on a black band while the sent email looked correct.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Plus, Type, Image as ImageIcon, MousePointer2, Minus, Square,
  LayoutGrid, Quote as QuoteIcon, Columns as ColumnsIcon, Trash2, Upload, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import { uploadEmailImage } from '@/lib/templates/upload-image'
import {
  SectionBlockContent, EditorBlock, BlockType, defaultBlockContent,
} from '@/lib/templates/editor-types'
import { EditorThemeProvider, useEditorTheme } from '../EditorThemeContext'

import { TextBlock } from './TextBlock'
import { ImageBlock } from './ImageBlock'
import { ButtonBlock } from './ButtonBlock'
import { DividerBlock } from './DividerBlock'
import { SpacerBlock } from './SpacerBlock'
import { CardsBlock } from './CardsBlock'
import { QuoteBlock } from './QuoteBlock'
import { ColumnsBlock } from './ColumnsBlock'

interface SectionBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

const CHILD_TYPES: { type: BlockType; icon: React.ElementType; label: string }[] = [
  { type: 'text', icon: Type, label: 'Text' },
  { type: 'image', icon: ImageIcon, label: 'Image' },
  { type: 'button', icon: MousePointer2, label: 'Button' },
  { type: 'cards', icon: LayoutGrid, label: 'Panels' },
  { type: 'quote', icon: QuoteIcon, label: 'Quote' },
  { type: 'columns', icon: ColumnsIcon, label: 'Columns' },
  { type: 'divider', icon: Minus, label: 'Divider' },
  { type: 'spacer', icon: Square, label: 'Spacer' },
]

/** Presets, because the useful band colours are a narrow band of the picker. */
const GROUNDS = ['#06070A', '#10161F', '#0f172a', '#1c1917', '#f3f0ea', '#ffffff']

function generateId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function ChildBlock({
  block,
  canEdit,
  onUpdate,
  onDelete,
}: {
  block: EditorBlock
  canEdit: boolean
  onUpdate: (updates: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  const render = () => {
    const props = { content: block.content, isSelected: false, onUpdate }
    switch (block.type) {
      case 'text': return <TextBlock {...props} />
      case 'image': return <ImageBlock {...props} />
      case 'button': return <ButtonBlock {...props} />
      case 'cards': return <CardsBlock {...props} />
      case 'quote': return <QuoteBlock {...props} />
      case 'columns': return <ColumnsBlock {...props} />
      case 'divider': return <DividerBlock {...props} />
      case 'spacer': return <SpacerBlock {...props} />
      default: return <div className="text-xs opacity-60">Unsupported inside a band</div>
    }
  }

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {canEdit && hovered && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute -right-2 -top-2 z-10 h-6 w-6"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
      <div className={cn('rounded transition-all', canEdit && hovered && 'ring-1 ring-indigo-400')}>
        {render()}
      </div>
    </div>
  )
}

export function SectionBlock({ content, isSelected, onUpdate }: SectionBlockProps) {
  const c = content as unknown as SectionBlockContent
  const theme = useEditorTheme()
  const [uploading, setUploading] = useState(false)

  const children = c.children ?? []

  const setChildren = (next: EditorBlock[]) => onUpdate({ children: next })

  const addChild = (type: BlockType) =>
    setChildren([
      ...children,
      { id: generateId(), type, content: { ...defaultBlockContent[type] } },
    ])

  const updateChild = (id: string, updates: Record<string, unknown>) =>
    setChildren(
      children.map((b) => (b.id === id ? { ...b, content: { ...b.content, ...updates } } : b)),
    )

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadEmailImage(file)
      onUpdate({ backgroundImageUrl: url })
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Could not upload that image',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  // Children inherit the band's colours, exactly as they do when sent.
  const innerTheme = {
    ...theme,
    inkColor: c.textColor || theme.inkColor,
    mutedColor: c.mutedColor || theme.mutedColor,
  }

  return (
    <div>
      {isSelected && (
        <div className="mb-3 space-y-3 rounded-lg bg-gray-50 p-3 dark:bg-slate-800">
          <div className="space-y-1.5">
            <Label className="text-xs">Band colour</Label>
            <div className="flex items-center gap-1.5">
              {GROUNDS.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  onClick={() => onUpdate({ backgroundColor: colour })}
                  className={cn(
                    'h-7 flex-1 rounded border transition-all',
                    (c.backgroundColor || '').toLowerCase() === colour
                      ? 'border-indigo-500 ring-2 ring-indigo-200'
                      : 'border-slate-300 hover:border-slate-400',
                  )}
                  style={{ backgroundColor: colour }}
                />
              ))}
              <input
                type="color"
                value={c.backgroundColor || '#0f172a'}
                onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                className="h-7 w-9 shrink-0 cursor-pointer rounded border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Text</Label>
              <input
                type="color"
                value={c.textColor || '#ffffff'}
                onChange={(e) => onUpdate({ textColor: e.target.value })}
                className="h-7 w-9 cursor-pointer rounded border border-slate-300"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Small print</Label>
              <input
                type="color"
                value={c.mutedColor || '#94a3b8'}
                onChange={(e) => onUpdate({ mutedColor: e.target.value })}
                className="h-7 w-9 cursor-pointer rounded border border-slate-300"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Background photo (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                value={c.backgroundImageUrl ?? ''}
                onChange={(e) => onUpdate({ backgroundImageUrl: e.target.value })}
                placeholder="Paste a URL, or upload"
                className="h-8 flex-1 text-xs"
              />
              <label className="shrink-0">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleUpload(file)
                  }}
                />
                <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 px-2.5 text-xs">
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Upload
                </span>
              </label>
            </div>
            {c.backgroundImageUrl && (
              <div className="flex items-center gap-2">
                <Label className="w-24 shrink-0 text-xs">Darken {c.overlayOpacity ?? 0}%</Label>
                <Slider
                  value={[c.overlayOpacity ?? 0]}
                  onValueChange={([v]) => onUpdate({ overlayOpacity: v })}
                  max={90}
                  step={5}
                  className="flex-1"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Label className="w-20 shrink-0 text-xs">Space ↕ {c.paddingY ?? 36}</Label>
              <Slider
                value={[c.paddingY ?? 36]}
                onValueChange={([v]) => onUpdate({ paddingY: v })}
                max={90} step={2} className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="w-20 shrink-0 text-xs">Space ↔ {c.paddingX ?? 24}</Label>
              <Slider
                value={[c.paddingX ?? 24]}
                onValueChange={([v]) => onUpdate({ paddingX: v })}
                max={60} step={2} className="flex-1"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            A band always spans the full width of the email — that is the point of it.
          </p>
        </div>
      )}

      {/* Preview: the real band, with the children inheriting its colours. */}
      <div
        style={{
          backgroundColor: c.backgroundColor || '#0f172a',
          backgroundImage: c.backgroundImageUrl ? `url(${c.backgroundImageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          style={{
            backgroundColor: c.backgroundImageUrl
              ? `rgba(0,0,0,${(c.overlayOpacity ?? 0) / 100})`
              : undefined,
            padding: `${c.paddingY ?? 36}px ${c.paddingX ?? 24}px`,
          }}
        >
          <EditorThemeProvider theme={innerTheme}>
            {children.length === 0 ? (
              <p className="py-4 text-center text-sm opacity-50" style={{ color: c.textColor || '#fff' }}>
                Empty band — add something to it
              </p>
            ) : (
              <div className="space-y-2">
                {children.map((child) => (
                  <ChildBlock
                    key={child.id}
                    block={child}
                    canEdit={isSelected}
                    onUpdate={(updates) => updateChild(child.id, updates)}
                    onDelete={() => setChildren(children.filter((b) => b.id !== child.id))}
                  />
                ))}
              </div>
            )}
          </EditorThemeProvider>
        </div>
      </div>

      {isSelected && (
        <div className="mt-2 flex justify-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-dashed text-xs">
                <Plus className="mr-1 h-3 w-3" />
                Add to band
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="center">
              <div className="space-y-1">
                {CHILD_TYPES.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => addChild(item.type)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  )
}
