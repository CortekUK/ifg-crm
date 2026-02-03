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
import { ScrollArea } from '@/components/ui/scroll-area'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TemplateSettings, BlockType, templateVariables, EditorBlock } from '@/lib/templates/editor-types'

interface EditorSidebarProps {
  settings: TemplateSettings
  onUpdateSettings: (updates: Partial<TemplateSettings>) => void
  onAddBlock: (type: BlockType) => void
  selectedBlock: EditorBlock | null
  onUpdateBlock: (id: string, updates: Partial<EditorBlock['content']>) => void
}

const blockItems: { type: BlockType; icon: React.ElementType; label: string }[] = [
  { type: 'text', icon: Type, label: 'Text' },
  { type: 'image', icon: Image, label: 'Image' },
  { type: 'button', icon: MousePointer2, label: 'Button' },
  { type: 'divider', icon: Minus, label: 'Divider' },
  { type: 'spacer', icon: Square, label: 'Spacer' },
  { type: 'video', icon: Play, label: 'Video' },
  { type: 'social', icon: Share2, label: 'Social' },
  { type: 'html', icon: Code, label: 'HTML' },
]

export function EditorSidebar({
  settings,
  onUpdateSettings,
  onAddBlock,
  selectedBlock,
  onUpdateBlock,
}: EditorSidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [blocksOpen, setBlocksOpen] = useState(true)
  const [modulesOpen, setModulesOpen] = useState(false)

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
    <div className="w-[300px] border-r border-slate-200 dark:border-slate-700 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Block Editing Panel - Shows when a block is selected */}
          {selectedBlock && (
            <div className="pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <Edit3 className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase">
                  Edit {selectedBlock.type} Block
                </h3>
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
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
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
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
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
            <CollapsibleContent className="pt-3">
              <div className="grid grid-cols-2 gap-2">
                {blockItems.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => onAddBlock(item.type)}
                    className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all cursor-pointer group"
                  >
                    <item.icon className="h-5 w-5 text-slate-500 dark:text-slate-400 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                    <span className="text-xs text-slate-600 dark:text-slate-400 mt-2 group-hover:text-blue-700 dark:group-hover:text-blue-300 font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
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
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform',
                  modulesOpen && 'rotate-180'
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="text-center py-6 text-sm text-slate-500">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Bookmark className="h-6 w-6 text-slate-400" />
                </div>
                <p className="font-medium text-slate-600 dark:text-slate-400">Save frequently used blocks</p>
                <p className="text-xs mt-1">Coming soon</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  )
}
