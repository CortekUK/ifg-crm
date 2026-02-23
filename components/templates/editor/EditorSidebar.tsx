'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronDown,
  Settings,
  LayoutGrid,
  Bookmark,
  Type,
  Image,
  MousePointer2,
  Minus,
  Square,
  Play,
  Share2,
  Code,
  Plus,
  Edit3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Columns,
  GitBranch,
  UserCircle,
  Paperclip,
  Save,
  Trash2,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TemplateSettings, BlockType, templateVariables, EditorBlock } from '@/lib/templates/editor-types'
import { useSavedModules, useSaveModule, useDeleteModule, moduleToBlock, type SavedModule } from '@/lib/hooks/useSavedModules'

interface EditorSidebarProps {
  settings: TemplateSettings
  onUpdateSettings: (updates: Partial<TemplateSettings>) => void
  onAddBlock: (type: BlockType) => void
  onAddBlockFromModule?: (block: EditorBlock) => void
  selectedBlock: EditorBlock | null
  onUpdateBlock: (id: string, updates: Partial<EditorBlock['content']>) => void
}

const blockItems: { type: BlockType; icon: React.ElementType; label: string; section?: 'basic' | 'layout' | 'advanced' }[] = [
  // Basic blocks
  { type: 'text', icon: Type, label: 'Text', section: 'basic' },
  { type: 'image', icon: Image, label: 'Image', section: 'basic' },
  { type: 'button', icon: MousePointer2, label: 'Button', section: 'basic' },
  { type: 'divider', icon: Minus, label: 'Divider', section: 'basic' },
  { type: 'spacer', icon: Square, label: 'Spacer', section: 'basic' },
  { type: 'video', icon: Play, label: 'Video', section: 'basic' },
  { type: 'social', icon: Share2, label: 'Social', section: 'basic' },
  { type: 'html', icon: Code, label: 'HTML', section: 'basic' },
  { type: 'file', icon: Paperclip, label: 'File', section: 'basic' },
  // Layout blocks
  { type: 'columns', icon: Columns, label: 'Columns', section: 'layout' },
  // Advanced blocks
  { type: 'conditional', icon: GitBranch, label: 'Conditional', section: 'advanced' },
  { type: 'recruiter_signature', icon: UserCircle, label: 'Signature', section: 'advanced' },
]

const basicBlocks = blockItems.filter(b => b.section === 'basic')
const layoutBlocks = blockItems.filter(b => b.section === 'layout')
const advancedBlocks = blockItems.filter(b => b.section === 'advanced')

export function EditorSidebar({
  settings,
  onUpdateSettings,
  onAddBlock,
  onAddBlockFromModule,
  selectedBlock,
  onUpdateBlock,
}: EditorSidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [blocksOpen, setBlocksOpen] = useState(true)
  const [modulesOpen, setModulesOpen] = useState(false)

  // Save module dialog state
  const [saveModuleOpen, setSaveModuleOpen] = useState(false)
  const [moduleName, setModuleName] = useState('')
  const [moduleDescription, setModuleDescription] = useState('')

  // Saved modules hooks
  const { data: savedModules, isLoading: modulesLoading } = useSavedModules()
  const saveModuleMutation = useSaveModule()
  const deleteModuleMutation = useDeleteModule()

  const handleSaveModule = async () => {
    if (!selectedBlock || !moduleName.trim()) return

    await saveModuleMutation.mutateAsync({
      name: moduleName.trim(),
      description: moduleDescription.trim() || undefined,
      block_type: selectedBlock.type,
      block_content: selectedBlock.content,
    })

    setSaveModuleOpen(false)
    setModuleName('')
    setModuleDescription('')
  }

  const handleAddModule = (module: SavedModule) => {
    if (onAddBlockFromModule) {
      onAddBlockFromModule(moduleToBlock(module))
    }
  }

  const insertVariable = (field: 'subject' | 'preheader', variable: string) => {
    const currentValue = settings[field]
    onUpdateSettings({ [field]: currentValue + variable })
  }

  const insertBlockVariable = (variable: string) => {
    if (selectedBlock && selectedBlock.type === 'text') {
      const content = selectedBlock.content as { html?: string }
      const currentHtml = content.html || ''
      onUpdateBlock(selectedBlock.id, { html: currentHtml + variable })
    }
  }

  return (
    <div className="w-[300px] h-full border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden">
      <ScrollArea className="flex-1 h-full">
        <div className="p-4 space-y-4">
          {/* Block Editing Panel - Shows when a block is selected */}
          {selectedBlock && (
            <div className="pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase">
                    Edit {selectedBlock.type} Block
                  </h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSaveModuleOpen(true)}
                >
                  <Bookmark className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </div>

              {selectedBlock.type === 'text' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Content</Label>
                    <Textarea
                      value={(selectedBlock.content as { html?: string }).html || ''}
                      onChange={(e) => onUpdateBlock(selectedBlock.id, { html: e.target.value })}
                      rows={4}
                      className="text-sm"
                      placeholder="Enter text content..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Font Size</Label>
                    <Select
                      value={(selectedBlock.content as { fontSize?: string }).fontSize || 'normal'}
                      onValueChange={(v) => onUpdateBlock(selectedBlock.id, { fontSize: v })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small (14px)</SelectItem>
                        <SelectItem value="normal">Normal (16px)</SelectItem>
                        <SelectItem value="large">Large (18px)</SelectItem>
                        <SelectItem value="xlarge">Extra Large (24px)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Alignment</Label>
                    <div className="flex gap-1">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <Button
                          key={align}
                          size="sm"
                          variant={(selectedBlock.content as { alignment?: string }).alignment === align ? 'default' : 'outline'}
                          className={cn(
                            'flex-1',
                            (selectedBlock.content as { alignment?: string }).alignment === align && 'bg-blue-600'
                          )}
                          onClick={() => onUpdateBlock(selectedBlock.id, { alignment: align })}
                        >
                          {align === 'left' && <AlignLeft className="h-4 w-4" />}
                          {align === 'center' && <AlignCenter className="h-4 w-4" />}
                          {align === 'right' && <AlignRight className="h-4 w-4" />}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Padding (px)</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500">Top</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={(selectedBlock.content as { paddingTop?: number }).paddingTop || 10}
                          onChange={(e) => onUpdateBlock(selectedBlock.id, { paddingTop: parseInt(e.target.value) || 0 })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500">Bottom</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={(selectedBlock.content as { paddingBottom?: number }).paddingBottom || 10}
                          onChange={(e) => onUpdateBlock(selectedBlock.id, { paddingBottom: parseInt(e.target.value) || 0 })}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Insert Variable</Label>
                    <div className="flex flex-wrap gap-1">
                      {templateVariables.slice(0, 4).map((v) => (
                        <Button
                          key={v.value}
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => insertBlockVariable(v.value)}
                        >
                          {v.value}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedBlock.type === 'button' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Button Text</Label>
                    <Input
                      value={(selectedBlock.content as { text?: string }).text || ''}
                      onChange={(e) => onUpdateBlock(selectedBlock.id, { text: e.target.value })}
                      className="h-9 text-sm"
                      placeholder="Click here"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Button URL</Label>
                    <Input
                      value={(selectedBlock.content as { url?: string }).url || ''}
                      onChange={(e) => onUpdateBlock(selectedBlock.id, { url: e.target.value })}
                      className="h-9 text-sm"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Width</Label>
                    <Select
                      value={(selectedBlock.content as { width?: string }).width || 'auto'}
                      onValueChange={(v) => onUpdateBlock(selectedBlock.id, { width: v })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (fit content)</SelectItem>
                        <SelectItem value="full">Full Width</SelectItem>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="75">75%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Alignment</Label>
                    <div className="flex gap-1">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <Button
                          key={align}
                          size="sm"
                          variant={(selectedBlock.content as { alignment?: string }).alignment === align ? 'default' : 'outline'}
                          className={cn(
                            'flex-1',
                            (selectedBlock.content as { alignment?: string }).alignment === align && 'bg-blue-600'
                          )}
                          onClick={() => onUpdateBlock(selectedBlock.id, { alignment: align })}
                        >
                          {align === 'left' && <AlignLeft className="h-4 w-4" />}
                          {align === 'center' && <AlignCenter className="h-4 w-4" />}
                          {align === 'right' && <AlignRight className="h-4 w-4" />}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Background Colour</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={(selectedBlock.content as { backgroundColor?: string }).backgroundColor || '#3b82f6'}
                        onChange={(e) => onUpdateBlock(selectedBlock.id, { backgroundColor: e.target.value })}
                        className="w-12 h-9 p-1 cursor-pointer"
                      />
                      <Input
                        value={(selectedBlock.content as { backgroundColor?: string }).backgroundColor || '#3b82f6'}
                        onChange={(e) => onUpdateBlock(selectedBlock.id, { backgroundColor: e.target.value })}
                        className="flex-1 h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Text Colour</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={(selectedBlock.content as { textColor?: string }).textColor || '#ffffff'}
                        onChange={(e) => onUpdateBlock(selectedBlock.id, { textColor: e.target.value })}
                        className="w-12 h-9 p-1 cursor-pointer"
                      />
                      <Input
                        value={(selectedBlock.content as { textColor?: string }).textColor || '#ffffff'}
                        onChange={(e) => onUpdateBlock(selectedBlock.id, { textColor: e.target.value })}
                        className="flex-1 h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Border Radius (px)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      value={(selectedBlock.content as { borderRadius?: number }).borderRadius || 6}
                      onChange={(e) => onUpdateBlock(selectedBlock.id, { borderRadius: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Padding (px)</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500">Horizontal</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={(selectedBlock.content as { paddingX?: number }).paddingX || 24}
                          onChange={(e) => onUpdateBlock(selectedBlock.id, { paddingX: parseInt(e.target.value) || 0 })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500">Vertical</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={(selectedBlock.content as { paddingY?: number }).paddingY || 12}
                          onChange={(e) => onUpdateBlock(selectedBlock.id, { paddingY: parseInt(e.target.value) || 0 })}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedBlock.type === 'image' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Image URL</Label>
                    <Input
                      value={(selectedBlock.content as { src?: string }).src || ''}
                      onChange={(e) => onUpdateBlock(selectedBlock.id, { src: e.target.value })}
                      className="h-9 text-sm"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Alt Text</Label>
                    <Input
                      value={(selectedBlock.content as { alt?: string }).alt || ''}
                      onChange={(e) => onUpdateBlock(selectedBlock.id, { alt: e.target.value })}
                      className="h-9 text-sm"
                      placeholder="Image description"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Link URL (optional)</Label>
                    <Input
                      value={(selectedBlock.content as { linkUrl?: string }).linkUrl || ''}
                      onChange={(e) => onUpdateBlock(selectedBlock.id, { linkUrl: e.target.value })}
                      className="h-9 text-sm"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Width</Label>
                    <Select
                      value={(selectedBlock.content as { width?: string }).width || '100'}
                      onValueChange={(v) => onUpdateBlock(selectedBlock.id, { width: v })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">Full Width (100%)</SelectItem>
                        <SelectItem value="75">75%</SelectItem>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="25">25%</SelectItem>
                        <SelectItem value="auto">Auto (original size)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Alignment</Label>
                    <div className="flex gap-1">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <Button
                          key={align}
                          size="sm"
                          variant={(selectedBlock.content as { alignment?: string }).alignment === align ? 'default' : 'outline'}
                          className={cn(
                            'flex-1',
                            (selectedBlock.content as { alignment?: string }).alignment === align && 'bg-blue-600'
                          )}
                          onClick={() => onUpdateBlock(selectedBlock.id, { alignment: align })}
                        >
                          {align === 'left' && <AlignLeft className="h-4 w-4" />}
                          {align === 'center' && <AlignCenter className="h-4 w-4" />}
                          {align === 'right' && <AlignRight className="h-4 w-4" />}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Padding (px)</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500">Top</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={(selectedBlock.content as { paddingTop?: number }).paddingTop || 10}
                          onChange={(e) => onUpdateBlock(selectedBlock.id, { paddingTop: parseInt(e.target.value) || 0 })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500">Bottom</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={(selectedBlock.content as { paddingBottom?: number }).paddingBottom || 10}
                          onChange={(e) => onUpdateBlock(selectedBlock.id, { paddingBottom: parseInt(e.target.value) || 0 })}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedBlock.type === 'spacer' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Height (px)</Label>
                    <Input
                      type="number"
                      min="10"
                      max="200"
                      value={(selectedBlock.content as { height?: number }).height || 40}
                      onChange={(e) => onUpdateBlock(selectedBlock.id, { height: parseInt(e.target.value) })}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              )}

              {selectedBlock.type === 'file' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">File</Label>
                    {(selectedBlock.content as { fileUrl?: string }).fileUrl ? (
                      <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <Paperclip className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">
                          {(selectedBlock.content as { fileName?: string }).fileName || 'File'}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No file uploaded. Click the block to upload.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Alignment</Label>
                    <div className="flex gap-1">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <Button
                          key={align}
                          size="sm"
                          variant={(selectedBlock.content as { alignment?: string }).alignment === align ? 'default' : 'outline'}
                          className={cn(
                            'flex-1',
                            (selectedBlock.content as { alignment?: string }).alignment === align && 'bg-blue-600'
                          )}
                          onClick={() => onUpdateBlock(selectedBlock.id, { alignment: align })}
                        >
                          {align === 'left' && <AlignLeft className="h-4 w-4" />}
                          {align === 'center' && <AlignCenter className="h-4 w-4" />}
                          {align === 'right' && <AlignRight className="h-4 w-4" />}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Padding (px)</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500">Top</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={(selectedBlock.content as { paddingTop?: number }).paddingTop || 10}
                          onChange={(e) => onUpdateBlock(selectedBlock.id, { paddingTop: parseInt(e.target.value) || 0 })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500">Bottom</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={(selectedBlock.content as { paddingBottom?: number }).paddingBottom || 10}
                          onChange={(e) => onUpdateBlock(selectedBlock.id, { paddingBottom: parseInt(e.target.value) || 0 })}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedBlock.type === 'divider' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Style</Label>
                    <Select
                      value={(selectedBlock.content as { style?: string }).style || 'solid'}
                      onValueChange={(v) => onUpdateBlock(selectedBlock.id, { style: v })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">Solid</SelectItem>
                        <SelectItem value="dashed">Dashed</SelectItem>
                        <SelectItem value="dotted">Dotted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Thickness (px)</Label>
                    <Select
                      value={String((selectedBlock.content as { thickness?: number }).thickness || 1)}
                      onValueChange={(v) => onUpdateBlock(selectedBlock.id, { thickness: parseInt(v) })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Thin (1px)</SelectItem>
                        <SelectItem value="2">Medium (2px)</SelectItem>
                        <SelectItem value="3">Thick (3px)</SelectItem>
                        <SelectItem value="4">Extra Thick (4px)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Width</Label>
                    <Select
                      value={(selectedBlock.content as { width?: string }).width || '100'}
                      onValueChange={(v) => onUpdateBlock(selectedBlock.id, { width: v })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">Full Width (100%)</SelectItem>
                        <SelectItem value="75">75%</SelectItem>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="25">25%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Colour</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={(selectedBlock.content as { color?: string }).color || '#e5e7eb'}
                        onChange={(e) => onUpdateBlock(selectedBlock.id, { color: e.target.value })}
                        className="w-12 h-9 p-1 cursor-pointer"
                      />
                      <Input
                        value={(selectedBlock.content as { color?: string }).color || '#e5e7eb'}
                        onChange={(e) => onUpdateBlock(selectedBlock.id, { color: e.target.value })}
                        className="flex-1 h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Padding (px)</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500">Top</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={(selectedBlock.content as { paddingTop?: number }).paddingTop || 15}
                          onChange={(e) => onUpdateBlock(selectedBlock.id, { paddingTop: parseInt(e.target.value) || 0 })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500">Bottom</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={(selectedBlock.content as { paddingBottom?: number }).paddingBottom || 15}
                          onChange={(e) => onUpdateBlock(selectedBlock.id, { paddingBottom: parseInt(e.target.value) || 0 })}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings Section */}
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase">Settings</span>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform',
                  settingsOpen && 'rotate-180'
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4">
              {/* Template Name */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Template Name</Label>
                <Input
                  value={settings.name}
                  onChange={(e) => onUpdateSettings({ name: e.target.value })}
                  placeholder="Enter template name"
                  className="h-9 text-sm"
                />
              </div>

              {/* Subject Line */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600 dark:text-slate-400">Subject Line</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                        <Plus className="h-3 w-3 mr-1" />
                        Variable
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="end">
                      <div className="space-y-1">
                        {templateVariables.map((v) => (
                          <button
                            key={v.value}
                            onClick={() => insertVariable('subject', v.value)}
                            className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            <div className="font-medium text-slate-700 dark:text-slate-300">{v.label}</div>
                            <div className="text-xs text-slate-500">{v.value}</div>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Input
                  value={settings.subject}
                  onChange={(e) => onUpdateSettings({ subject: e.target.value })}
                  placeholder="Enter subject line"
                  className="h-9 text-sm"
                />
              </div>

              {/* Preheader */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600 dark:text-slate-400">Preheader</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                        <Plus className="h-3 w-3 mr-1" />
                        Variable
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="end">
                      <div className="space-y-1">
                        {templateVariables.map((v) => (
                          <button
                            key={v.value}
                            onClick={() => insertVariable('preheader', v.value)}
                            className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            <div className="font-medium text-slate-700 dark:text-slate-300">{v.label}</div>
                            <div className="text-xs text-slate-500">{v.value}</div>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Input
                  value={settings.preheader}
                  onChange={(e) => onUpdateSettings({ preheader: e.target.value })}
                  placeholder="Preview text shown in inbox"
                  className="h-9 text-sm"
                />
              </div>

              {/* From Name Type */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600 dark:text-slate-400">From Name</Label>
                <Select
                  value={settings.fromNameType}
                  onValueChange={(v) => onUpdateSettings({ fromNameType: v as 'deal_owner' | 'fixed' })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deal_owner">Deal Owner (dynamic)</SelectItem>
                    <SelectItem value="fixed">Fixed Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fixed From Fields */}
              {settings.fromNameType === 'fixed' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Fixed From Name</Label>
                    <Input
                      value={settings.fixedFromName}
                      onChange={(e) => onUpdateSettings({ fixedFromName: e.target.value })}
                      placeholder="e.g., IFG Team"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">Fixed From Email</Label>
                    <Input
                      value={settings.fixedFromEmail}
                      onChange={(e) => onUpdateSettings({ fixedFromEmail: e.target.value })}
                      placeholder="e.g., hello@ifg.com"
                      className="h-9 text-sm"
                    />
                  </div>
                </>
              )}

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Category</Label>
                <Select
                  value={settings.category}
                  onValueChange={(v) =>
                    onUpdateSettings({ category: v as 'automation' | 'campaign' | 'transactional' })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automation">Automation</SelectItem>
                    <SelectItem value="campaign">Campaign</SelectItem>
                    <SelectItem value="transactional">Transactional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Blocks Section */}
          <Collapsible open={blocksOpen} onOpenChange={setBlocksOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase">Blocks</span>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform',
                  blocksOpen && 'rotate-180'
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4">
              {/* Basic Blocks */}
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Content</p>
                <div className="grid grid-cols-2 gap-2">
                  {basicBlocks.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => onAddBlock(item.type)}
                      className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all cursor-pointer group"
                    >
                      <item.icon className="h-4 w-4 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                      <span className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 group-hover:text-blue-700 dark:group-hover:text-blue-300 font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout Blocks */}
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Layout</p>
                <div className="grid grid-cols-2 gap-2">
                  {layoutBlocks.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => onAddBlock(item.type)}
                      className="flex flex-col items-center justify-center p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all cursor-pointer group"
                    >
                      <item.icon className="h-4 w-4 text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors" />
                      <span className="text-xs text-purple-600 dark:text-purple-400 mt-1.5 group-hover:text-purple-700 dark:group-hover:text-purple-300 font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Blocks */}
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Advanced</p>
                <div className="grid grid-cols-2 gap-2">
                  {advancedBlocks.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => onAddBlock(item.type)}
                      className="flex flex-col items-center justify-center p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all cursor-pointer group"
                    >
                      <item.icon className="h-4 w-4 text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors" />
                      <span className="text-xs text-amber-700 dark:text-amber-400 mt-1.5 group-hover:text-amber-800 dark:group-hover:text-amber-300 font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Click to add to canvas
              </p>
            </CollapsibleContent>
          </Collapsible>

          {/* Saved Modules Section */}
          <Collapsible open={modulesOpen} onOpenChange={setModulesOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase">Saved Modules</span>
                {savedModules && savedModules.length > 0 && (
                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs px-1.5 py-0.5 rounded-full">
                    {savedModules.length}
                  </span>
                )}
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform',
                  modulesOpen && 'rotate-180'
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              {modulesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : savedModules && savedModules.length > 0 ? (
                <div className="space-y-2">
                  {savedModules.map((module) => {
                    const blockItem = blockItems.find((b) => b.type === module.block_type)
                    const Icon = blockItem?.icon || Bookmark

                    return (
                      <div
                        key={module.id}
                        className="group flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                      >
                        <button
                          onClick={() => handleAddModule(module)}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-900/30">
                            <Icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                              {module.name}
                            </p>
                            {module.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {module.description}
                              </p>
                            )}
                          </div>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => deleteModuleMutation.mutate(module.id)}
                          disabled={deleteModuleMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-slate-500">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <Bookmark className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="font-medium text-slate-600 dark:text-slate-400">No saved modules yet</p>
                  <p className="text-xs mt-1 text-slate-500 dark:text-slate-500">
                    Select a block and click "Save as Module"
                  </p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Save Module Dialog */}
      <Dialog open={saveModuleOpen} onOpenChange={setSaveModuleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Module</DialogTitle>
            <DialogDescription>
              Save this {selectedBlock?.type} block as a reusable module.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="module-name">Name</Label>
              <Input
                id="module-name"
                placeholder="e.g., CTA Button Blue"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-description">Description (optional)</Label>
              <Textarea
                id="module-description"
                placeholder="A brief description of this module..."
                value={moduleDescription}
                onChange={(e) => setModuleDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveModuleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveModule}
              disabled={!moduleName.trim() || saveModuleMutation.isPending}
            >
              {saveModuleMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Module
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
