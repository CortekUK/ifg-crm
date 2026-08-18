'use client'

import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { CanvasBlock } from './CanvasBlock'
import { GlobalRegion } from './GlobalRegion'
import {
  HeaderSectionEditor,
  HeaderPreview,
  LegalSectionEditor,
  LegalPreview,
} from './GlobalSectionEditors'
import { SocialBlock } from './blocks/SocialBlock'
import { CompanySignatureBlock } from './blocks/CompanySignatureBlock'
import { RecruiterSignatureBlock } from './blocks/RecruiterSignatureBlock'
import { LayoutGrid } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import type { EditorBlock, TemplateTheme } from '@/lib/templates/editor-types'
import type { EmailBranding } from '@/lib/templates/branding-types'
import { resolveTheme } from '@/lib/templates/render-html'
import { useBrandingDraft } from '@/lib/hooks/useEmailBranding'

/** Which globally-branded region is open for editing, if any. */
export type GlobalSection = 'header' | 'signature' | 'social' | 'company' | 'legal'

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
  /** The open global region. Kept alongside selectedBlockId so selecting
      one always clears the other — only ever one settings panel is open. */
  selectedGlobalSection: GlobalSection | null
  onSelectGlobalSection: (section: GlobalSection | null) => void
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
  selectedGlobalSection,
  onSelectGlobalSection,
}: EditorCanvasProps) {
  const t = resolveTheme(theme)
  const { branding, isDirty, isSaving, updateSection, discard, publish } =
    useBrandingDraft()

  // Shared plumbing for every global region: selecting one, and the
  // publish / discard controls that appear once it's open.
  const regionProps = (section: GlobalSection, label: string, hint?: string) => ({
    label,
    hint,
    isSelected: selectedGlobalSection === section,
    onSelect: () => onSelectGlobalSection(section),
    isDirty,
    isSaving,
    onPublish: () => {
      void publish()
    },
    onDiscard: discard,
  })

  // The block-typed regions hand back loose patches; merge into the section.
  const patchSection =
    <K extends 'signature' | 'social' | 'company'>(key: K) =>
    (updates: Record<string, unknown>) => {
      if (!branding) return
      updateSection(key, { ...branding[key], ...updates } as EmailBranding[K])
    }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    if (result.destination.index === result.source.index) return

    onMoveBlock(result.source.index, result.destination.index)
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Deselect if clicking on canvas background
    if (e.target === e.currentTarget) {
      onSelectBlock(null)
      onSelectGlobalSection(null)
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
          {/* Global header — click to edit; applies to every template. */}
          {branding && branding.showHeader && (
            <GlobalRegion
              {...regionProps('header', 'Header', 'The band at the top of every email. Editing it changes all templates.')}
              preview={<HeaderPreview header={branding.header} />}
            >
              <>
                <HeaderSectionEditor
                  header={branding.header}
                  onUpdate={(patch) =>
                    updateSection('header', { ...branding.header, ...patch })
                  }
                />
                <div className="mt-3 overflow-hidden rounded">
                  <HeaderPreview header={branding.header} />
                </div>
              </>
            </GlobalRegion>
          )}

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

            {/* Global signature / social / partner logos. These sit inside
                the content cell, exactly where the renderer places them. */}
            {branding && (
              <div className="mt-2 space-y-2">
                {branding.showSignature && (
                  <GlobalRegion
                    {...regionProps('signature', 'Sender signature', 'Filled in per deal owner when the email is sent. Editing it changes all templates.')}
                    preview={
                      <RecruiterSignatureBlock
                        content={branding.signature as unknown as Record<string, unknown>}
                        isSelected={false}
                        onUpdate={() => {}}
                      />
                    }
                  >
                    <RecruiterSignatureBlock
                      content={branding.signature as unknown as Record<string, unknown>}
                      isSelected
                      onUpdate={patchSection('signature')}
                    />
                  </GlobalRegion>
                )}

                {branding.showSocial && (
                  <GlobalRegion
                    {...regionProps('social', 'Social channels')}
                    preview={
                      <SocialBlock
                        content={branding.social as unknown as Record<string, unknown>}
                        isSelected={false}
                        onUpdate={() => {}}
                      />
                    }
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Switch
                        checked={branding.showDivider}
                        onCheckedChange={(v) => updateSection('showDivider', v)}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        Divider line above the social row
                      </span>
                    </div>
                    <SocialBlock
                      content={branding.social as unknown as Record<string, unknown>}
                      isSelected
                      onUpdate={patchSection('social')}
                    />
                  </GlobalRegion>
                )}

                {branding.showCompany && (
                  <GlobalRegion
                    {...regionProps('company', 'Partner logos & disclaimer')}
                    preview={
                      <CompanySignatureBlock
                        content={branding.company as unknown as Record<string, unknown>}
                        isSelected={false}
                        onUpdate={() => {}}
                      />
                    }
                  >
                    <CompanySignatureBlock
                      content={branding.company as unknown as Record<string, unknown>}
                      isSelected
                      onUpdate={patchSection('company')}
                    />
                  </GlobalRegion>
                )}
              </div>
            )}
          </div>

          {/* Global unsubscribe / legal strip. */}
          {branding && branding.showLegal && (
            <GlobalRegion
              {...regionProps('legal', 'Unsubscribe strip', 'The grey band at the very bottom of every email.')}
              preview={<LegalPreview legal={branding.legal} />}
            >
              <>
                <LegalSectionEditor
                  legal={branding.legal}
                  onUpdate={(patch) =>
                    updateSection('legal', { ...branding.legal, ...patch })
                  }
                />
                <div className="mt-3 overflow-hidden rounded">
                  <LegalPreview legal={branding.legal} />
                </div>
              </>
            </GlobalRegion>
          )}
        </div>
      </div>
    </div>
  )
}
