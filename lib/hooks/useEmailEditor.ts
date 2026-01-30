'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'
import { renderBlocksToHTML } from '@/lib/templates/render-html'
import {
  EditorBlock,
  BlockType,
  TemplateSettings,
  EditorState,
  defaultTemplateSettings,
  defaultBlockContent,
} from '@/lib/templates/editor-types'

function generateId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function useEmailEditor(templateId?: string) {
  const router = useRouter()
  const supabase = createClient()

  // State
  const [blocks, setBlocks] = useState<EditorBlock[]>([])
  const [settings, setSettings] = useState<TemplateSettings>(defaultTemplateSettings)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!!templateId)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // History for undo/redo
  const [history, setHistory] = useState<EditorState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Track changes
  const markChanged = useCallback(() => {
    setHasUnsavedChanges(true)
  }, [])

  // Save state to history
  const saveToHistory = useCallback(
    (newBlocks: EditorBlock[], newSettings: TemplateSettings) => {
      const newState: EditorState = { blocks: newBlocks, settings: newSettings }
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1)
        return [...newHistory, newState]
      })
      setHistoryIndex((prev) => prev + 1)
    },
    [historyIndex]
  )

  // Load template if editing
  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId)
    } else {
      // Initialise with default state
      const initialState: EditorState = { blocks: [], settings: defaultTemplateSettings }
      setHistory([initialState])
      setHistoryIndex(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  const loadTemplate = async (id: string) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      if (data) {
        // Parse blocks from body_json or create empty array
        let loadedBlocks: EditorBlock[] = []
        if (data.body_json) {
          try {
            loadedBlocks = JSON.parse(data.body_json)
          } catch {
            loadedBlocks = []
          }
        }

        const loadedSettings: TemplateSettings = {
          name: data.name || 'Untitled Template',
          subject: data.subject || '',
          preheader: data.preheader || '',
          fromNameType: data.from_name_type || 'deal_owner',
          fixedFromName: data.fixed_from_name || '',
          fixedFromEmail: data.fixed_from_email || '',
          category: data.category || 'campaign',
        }

        setBlocks(loadedBlocks)
        setSettings(loadedSettings)

        // Initialise history with loaded state
        const initialState: EditorState = { blocks: loadedBlocks, settings: loadedSettings }
        setHistory([initialState])
        setHistoryIndex(0)
      }
    } catch (error) {
      console.error('Failed to load template:', error)
      toast({
        title: 'Failed to load template',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setBlocks(prevState.blocks)
      setSettings(prevState.settings)
      setHistoryIndex((prev) => prev - 1)
      markChanged()
    }
  }, [history, historyIndex, markChanged])

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      setBlocks(nextState.blocks)
      setSettings(nextState.settings)
      setHistoryIndex((prev) => prev + 1)
      markChanged()
    }
  }, [history, historyIndex, markChanged])

  // Add block
  const addBlock = useCallback(
    (type: BlockType, index?: number) => {
      const newBlock: EditorBlock = {
        id: generateId(),
        type,
        content: { ...defaultBlockContent[type] },
      }

      setBlocks((prev) => {
        const newBlocks =
          index !== undefined
            ? [...prev.slice(0, index), newBlock, ...prev.slice(index)]
            : [...prev, newBlock]
        saveToHistory(newBlocks, settings)
        return newBlocks
      })
      setSelectedBlockId(newBlock.id)
      markChanged()
    },
    [settings, saveToHistory, markChanged]
  )

  // Update block
  const updateBlock = useCallback(
    (id: string, updates: Partial<EditorBlock['content']>) => {
      setBlocks((prev) => {
        const newBlocks = prev.map((block) =>
          block.id === id ? { ...block, content: { ...block.content, ...updates } } : block
        )
        saveToHistory(newBlocks, settings)
        return newBlocks
      })
      markChanged()
    },
    [settings, saveToHistory, markChanged]
  )

  // Delete block
  const deleteBlock = useCallback(
    (id: string) => {
      setBlocks((prev) => {
        const newBlocks = prev.filter((block) => block.id !== id)
        saveToHistory(newBlocks, settings)
        return newBlocks
      })
      if (selectedBlockId === id) {
        setSelectedBlockId(null)
      }
      markChanged()
    },
    [selectedBlockId, settings, saveToHistory, markChanged]
  )

  // Duplicate block
  const duplicateBlock = useCallback(
    (id: string) => {
      const blockIndex = blocks.findIndex((block) => block.id === id)
      if (blockIndex === -1) return

      const blockToDuplicate = blocks[blockIndex]
      const newBlock: EditorBlock = {
        id: generateId(),
        type: blockToDuplicate.type,
        content: { ...blockToDuplicate.content },
      }

      setBlocks((prev) => {
        const newBlocks = [...prev.slice(0, blockIndex + 1), newBlock, ...prev.slice(blockIndex + 1)]
        saveToHistory(newBlocks, settings)
        return newBlocks
      })
      setSelectedBlockId(newBlock.id)
      markChanged()
    },
    [blocks, settings, saveToHistory, markChanged]
  )

  // Move block (reorder)
  const moveBlock = useCallback(
    (fromIndex: number, toIndex: number) => {
      setBlocks((prev) => {
        const newBlocks = [...prev]
        const [removed] = newBlocks.splice(fromIndex, 1)
        newBlocks.splice(toIndex, 0, removed)
        saveToHistory(newBlocks, settings)
        return newBlocks
      })
      markChanged()
    },
    [settings, saveToHistory, markChanged]
  )

  // Update settings
  const updateSettings = useCallback(
    (updates: Partial<TemplateSettings>) => {
      setSettings((prev) => {
        const newSettings = { ...prev, ...updates }
        saveToHistory(blocks, newSettings)
        return newSettings
      })
      markChanged()
    },
    [blocks, saveToHistory, markChanged]
  )

  // Save template
  const saveTemplate = useCallback(
    async (exit: boolean = false) => {
      setIsSaving(true)

      try {
        const bodyHtml = renderBlocksToHTML(blocks)
        const bodyJson = JSON.stringify(blocks)

        const templateData = {
          name: settings.name,
          subject: settings.subject,
          preheader: settings.preheader,
          from_name_type: settings.fromNameType,
          fixed_from_name: settings.fromNameType === 'fixed' ? settings.fixedFromName : null,
          fixed_from_email: settings.fromNameType === 'fixed' ? settings.fixedFromEmail : null,
          category: settings.category,
          body_html: bodyHtml,
          body_json: bodyJson,
          updated_at: new Date().toISOString(),
        }

        if (templateId) {
          // Update existing template
          const { error } = await supabase
            .from('email_templates')
            .update(templateData)
            .eq('id', templateId)

          if (error) throw error

          toast({
            title: 'Template saved',
            description: `"${settings.name}" has been updated.`,
          })
        } else {
          // Create new template
          const { data: { user } } = await supabase.auth.getUser()

          const { error } = await supabase.from('email_templates').insert({
            ...templateData,
            created_by_id: user?.id,
          })

          if (error) throw error

          toast({
            title: 'Template created',
            description: `"${settings.name}" has been saved.`,
          })
        }

        setHasUnsavedChanges(false)

        if (exit) {
          router.push('/templates')
        }
      } catch (error) {
        console.error('Failed to save template:', error)
        toast({
          title: 'Failed to save template',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        })
      } finally {
        setIsSaving(false)
      }
    },
    [templateId, blocks, settings, supabase, router]
  )

  // Close editor
  const closeEditor = useCallback(() => {
    if (hasUnsavedChanges) {
      // The parent component should handle the confirmation dialog
      return false
    }
    router.push('/templates')
    return true
  }, [hasUnsavedChanges, router])

  return {
    // State
    blocks,
    settings,
    selectedBlockId,
    isLoading,
    isSaving,
    hasUnsavedChanges,

    // Setters
    setSelectedBlockId,

    // Block operations
    addBlock,
    updateBlock,
    deleteBlock,
    duplicateBlock,
    moveBlock,

    // Settings operations
    updateSettings,

    // History
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,

    // Save/Close
    saveTemplate,
    closeEditor,
  }
}
