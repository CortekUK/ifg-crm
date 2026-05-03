'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'
import { renderBlocksToHTML } from '@/lib/templates/render-html'
import {
  EditorBlock,
  BlockType,
  TemplateSettings,
  defaultTemplateSettings,
  defaultBlockContent,
} from '@/lib/templates/editor-types'

// Auto-save debounce — wait this long after the user's last edit before
// silently writing to the DB. Long enough that we're not hammering the
// API on every keystroke; short enough that a casual close-of-tab leaves
// at most a few seconds of work behind.
const AUTOSAVE_DEBOUNCE_MS = 2500

// Undo coalesce window. Two pushes that land within this window get
// merged into a single history entry — that's how rapid keystroke runs
// in a text block end up as ONE undo step instead of one per character.
// Past this window, the next push starts a fresh entry.
const HISTORY_COALESCE_MS = 600

// History tracks ONLY blocks. Template settings (name, subject,
// preheader, from-name, category) are deliberately NOT undoable — the
// previous design made every keystroke in the name field its own undo
// step, so Ctrl+Z spent 15 strokes scrubbing the name before getting
// near the actual canvas edits the user wanted to revert.
interface HistoryState {
  stack: EditorBlock[][]
  index: number
  // Wall-clock timestamp of the last commit, used to coalesce rapid
  // edits (typing) into a single undo step.
  lastCommitAt: number
}

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
  // Last successful save timestamp — drives the "Saved · 2s ago" status
  // pill in the header. null until the first save lands.
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [isAutoSaving, setIsAutoSaving] = useState(false)

  // The "live" template id. Starts as the prop (when editing existing)
  // or null (when creating new). After a successful first INSERT we
  // capture the new row's id here so subsequent saves UPDATE the same
  // row instead of inserting again — the previous design just kept
  // INSERT-ing on every Save Draft because it never captured the
  // returned id.
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(
    templateId ?? null,
  )
  // Keep activeTemplateId synced with the prop when the route changes
  // (e.g. user navigates from one template to another without unmount).
  useEffect(() => {
    setActiveTemplateId(templateId ?? null)
  }, [templateId])

  // Single-flight guard for save operations. Auto-save and manual save
  // can otherwise race — particularly bad for a brand-new template
  // where two concurrent INSERTs would create two duplicate rows.
  const savingRef = useRef(false)

  // History for undo/redo. Combined into a single state object so the
  // stack and the index can never desync across batched setState calls
  // (the previous shape used two separate useState pieces and `index`
  // closures could go stale during rapid edits).
  const [history, setHistory] = useState<HistoryState>({
    stack: [[]],
    index: 0,
    lastCommitAt: 0,
  })

  const markChanged = useCallback(() => {
    setHasUnsavedChanges(true)
  }, [])

  // Push a new blocks snapshot onto the undo stack.
  //
  // Behaviour:
  //   • Trims any "future" entries — if the user undid then started
  //     editing, the redo branch is dropped (standard undo semantics).
  //   • If the new snapshot is identical to the head, no-op (skips
  //     redundant entries from updates that don't actually change
  //     anything).
  //   • If the previous push happened within HISTORY_COALESCE_MS,
  //     replace the head entry instead of appending. That groups a run
  //     of fast keystrokes / batched updates into one undo step.
  const commitHistory = useCallback((newBlocks: EditorBlock[]) => {
    setHistory((prev) => {
      const trimmed = prev.stack.slice(0, prev.index + 1)
      const head = trimmed[trimmed.length - 1]
      // No-op when the head is identical — guards against churn on
      // re-renders that happen to call commitHistory without a real
      // change. JSON.stringify is fine here; blocks are simple objects
      // and the comparison runs only on commit, not on every render.
      if (head && JSON.stringify(head) === JSON.stringify(newBlocks)) {
        return prev
      }
      const now = Date.now()
      const shouldCoalesce =
        trimmed.length > 0 && now - prev.lastCommitAt < HISTORY_COALESCE_MS
      if (shouldCoalesce) {
        const merged = [...trimmed.slice(0, -1), newBlocks]
        return { stack: merged, index: merged.length - 1, lastCommitAt: now }
      }
      const appended = [...trimmed, newBlocks]
      return { stack: appended, index: appended.length - 1, lastCommitAt: now }
    })
  }, [])

  // Load template if editing
  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId)
    } else {
      // New template — empty canvas, single empty history entry.
      setHistory({ stack: [[]], index: 0, lastCommitAt: 0 })
      setIsLoading(false)
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
            // body_json might already be an object (JSONB) or a string
            if (typeof data.body_json === 'string') {
              loadedBlocks = JSON.parse(data.body_json)
            } else {
              loadedBlocks = data.body_json as EditorBlock[]
            }
          } catch (parseError) {
            console.error('Failed to parse body_json:', parseError)
            loadedBlocks = []
          }
        }

        // Theme blob — JSONB column added in migration 121. May be
        // null on older rows or freshly-created drafts; treat as
        // undefined so the renderer falls back to defaults.
        let loadedTheme: TemplateSettings['theme'] = undefined
        if (data.theme && typeof data.theme === 'object') {
          loadedTheme = data.theme as TemplateSettings['theme']
        }

        const loadedSettings: TemplateSettings = {
          name: data.name || 'Untitled Template',
          subject: data.subject || '',
          preheader: data.preheader || '',
          fromNameType: data.from_name_type || 'deal_owner',
          fixedFromName: data.fixed_from_name || '',
          fixedFromEmail: data.fixed_from_email || '',
          category: data.category || 'campaign',
          theme: loadedTheme,
        }

        setBlocks(loadedBlocks)
        setSettings(loadedSettings)

        // Seed history with the loaded blocks as the single starting
        // entry. Settings aren't tracked.
        setHistory({ stack: [loadedBlocks], index: 0, lastCommitAt: 0 })
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

  // Undo / redo — pure block-level. Settings (name, subject, etc.) do
  // not move when stepping through history; the user's most recent
  // typed-in name stays put even after undoing a block change. That's
  // the explicit UX call: dragging the name field around with each
  // undo step was disorienting.
  const undo = useCallback(() => {
    if (history.index <= 0) return
    const newIndex = history.index - 1
    setBlocks(history.stack[newIndex])
    // Reset the coalesce timer so the next edit starts a fresh entry
    // instead of overwriting the one we just stepped back to.
    setHistory({ ...history, index: newIndex, lastCommitAt: 0 })
    markChanged()
  }, [history, markChanged])

  const redo = useCallback(() => {
    if (history.index >= history.stack.length - 1) return
    const newIndex = history.index + 1
    setBlocks(history.stack[newIndex])
    setHistory({ ...history, index: newIndex, lastCommitAt: 0 })
    markChanged()
  }, [history, markChanged])

  // Add block — committed as its own history entry (clicks rarely
  // happen within the coalesce window so each will get its own).
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
        commitHistory(newBlocks)
        return newBlocks
      })
      setSelectedBlockId(newBlock.id)
      markChanged()
    },
    [commitHistory, markChanged],
  )

  // Replace the entire block list. Used by the AI generator.
  //
  // The AI streams blocks in 6 progressive ticks (an animation flourish)
  // — each call would normally push its own undo entry, but logically
  // it's ONE user action ("AI generated this template"). The `commit`
  // option lets the AI flow update blocks without committing on the
  // intermediate ticks, then commit once at the end so a single undo
  // reverts the whole generation.
  const replaceBlocks = useCallback(
    (
      newBlocks: EditorBlock[],
      partialSettings?: Partial<TemplateSettings>,
      opts: { commit?: boolean } = {},
    ) => {
      const merged = newBlocks.map((b) => ({ ...b, id: generateId() }))
      setBlocks(merged)
      if (partialSettings) {
        setSettings((prev) => ({ ...prev, ...partialSettings }))
      }
      if (opts.commit !== false) commitHistory(merged)
      setSelectedBlockId(null)
      markChanged()
    },
    [commitHistory, markChanged],
  )

  // Add block from module (with predefined content)
  const addBlockFromModule = useCallback(
    (block: EditorBlock, index?: number) => {
      const newBlock: EditorBlock = { ...block, id: generateId() }
      setBlocks((prev) => {
        const newBlocks =
          index !== undefined
            ? [...prev.slice(0, index), newBlock, ...prev.slice(index)]
            : [...prev, newBlock]
        commitHistory(newBlocks)
        return newBlocks
      })
      setSelectedBlockId(newBlock.id)
      markChanged()
    },
    [commitHistory, markChanged],
  )

  // Update block — fast keystroke runs collapse into one entry via
  // the HISTORY_COALESCE_MS window inside commitHistory.
  const updateBlock = useCallback(
    (id: string, updates: Partial<EditorBlock['content']>) => {
      setBlocks((prev) => {
        const newBlocks = prev.map((block) =>
          block.id === id
            ? { ...block, content: { ...block.content, ...updates } }
            : block,
        )
        commitHistory(newBlocks)
        return newBlocks
      })
      markChanged()
    },
    [commitHistory, markChanged],
  )

  const deleteBlock = useCallback(
    (id: string) => {
      setBlocks((prev) => {
        const newBlocks = prev.filter((block) => block.id !== id)
        commitHistory(newBlocks)
        return newBlocks
      })
      if (selectedBlockId === id) {
        setSelectedBlockId(null)
      }
      markChanged()
    },
    [selectedBlockId, commitHistory, markChanged],
  )

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
        const newBlocks = [
          ...prev.slice(0, blockIndex + 1),
          newBlock,
          ...prev.slice(blockIndex + 1),
        ]
        commitHistory(newBlocks)
        return newBlocks
      })
      setSelectedBlockId(newBlock.id)
      markChanged()
    },
    [blocks, commitHistory, markChanged],
  )

  const moveBlock = useCallback(
    (fromIndex: number, toIndex: number) => {
      setBlocks((prev) => {
        const newBlocks = [...prev]
        const [removed] = newBlocks.splice(fromIndex, 1)
        newBlocks.splice(toIndex, 0, removed)
        commitHistory(newBlocks)
        return newBlocks
      })
      markChanged()
    },
    [commitHistory, markChanged],
  )

  // Update settings — deliberately does NOT touch history. Name,
  // subject, preheader, etc. are not undoable by design (see the
  // HistoryState comment for the rationale).
  const updateSettings = useCallback(
    (updates: Partial<TemplateSettings>) => {
      setSettings((prev) => ({ ...prev, ...updates }))
      markChanged()
    },
    [markChanged],
  )

  // Save template
  //   exit    — navigate back to /templates after a successful save
  //   silent  — skip the toast and the spinner; used by auto-save so
  //             the user isn't bombarded with "Template saved" every
  //             two seconds while typing.
  //   isDraft — explicitly set the row's `is_draft` flag:
  //               true     → mark as draft (Save Draft button)
  //               false    → publish (Save & Exit / Update buttons)
  //               undefined → leave unchanged (auto-save shouldn't
  //                            transition the draft flag silently).
  //             For new INSERTs the DB column defaults to true, so
  //             skipping it on first auto-save still yields a draft.
  const saveTemplate = useCallback(
    async (
      exit: boolean = false,
      silent: boolean = false,
      isDraft?: boolean,
    ) => {
      // Single-flight guard. Auto-save can fire while the user is mid
      // manual save (or vice versa); without this, two concurrent
      // INSERTs on a new template create two duplicate rows.
      if (savingRef.current) {
        if (exit && !silent) {
          // User asked to save & exit while a save was in flight —
          // wait briefly then navigate. Don't kick off a second save.
          return
        }
        return
      }

      // Guard: nothing changed since the last save. The user clicking
      // "Save Draft" with no edits used to fire a network round-trip
      // that surfaced confusing race-condition errors when concurrent
      // saves landed; now we just no-op with a friendly toast.
      if (!hasUnsavedChanges && !silent) {
        toast({
          title: 'Already saved',
          description: 'No changes to save.',
        })
        if (exit) router.push('/templates')
        return
      }
      if (!hasUnsavedChanges && silent) return

      savingRef.current = true
      if (silent) {
        setIsAutoSaving(true)
      } else {
        setIsSaving(true)
      }

      try {
        const bodyHtml = renderBlocksToHTML(blocks, settings.theme)
        // body_json is a JSONB column. supabase-js will serialise the
        // request body itself — we pass the array directly so Postgres
        // stores it as a real JSON array instead of a JSON-encoded
        // string-of-an-array (the previous JSON.stringify(blocks)
        // version stored a string that the load path then JSON.parse'd
        // back, which works but is a mismatch with how new rows from
        // other paths are stored).
        const bodyJson = blocks

        // Auto-derive a name when the user hasn't entered one. Priority:
        //   1. user-typed name (anything other than the factory default)
        //   2. the email subject — almost always the most useful summary
        //   3. plain "Untitled Template" if there's nothing else
        const trimmedName = (settings.name ?? '').trim()
        const isDefaultName = !trimmedName || trimmedName === 'Untitled Template'
        const derivedName = (() => {
          if (!isDefaultName) return trimmedName
          const subject = (settings.subject ?? '').trim()
          if (subject) return subject.slice(0, 80)
          return 'Untitled Template'
        })()

        const templateData = {
          name: derivedName,
          // Subject is NOT NULL in the schema; coerce nullish to empty
          // string so a brand-new template with no subject yet still
          // saves cleanly as a draft.
          subject: settings.subject ?? '',
          preheader: settings.preheader ?? '',
          from_name_type: settings.fromNameType,
          fixed_from_name:
            settings.fromNameType === 'fixed' ? settings.fixedFromName : null,
          fixed_from_email:
            settings.fromNameType === 'fixed' ? settings.fixedFromEmail : null,
          category: settings.category,
          // Theme is optional. When the user hasn't tweaked anything we
          // store null and the renderer applies defaults; when set we
          // persist the JSON object verbatim. supabase-js serialises it
          // into the JSONB column.
          theme: settings.theme ?? null,
          body_html: bodyHtml,
          body_json: bodyJson,
          updated_at: new Date().toISOString(),
          // Only set is_draft when the caller explicitly passed a
          // value. Auto-save (no value) leaves the existing flag
          // untouched so background saves don't silently flip a
          // user's published template back to draft.
          ...(isDraft !== undefined ? { is_draft: isDraft } : {}),
        }

        if (activeTemplateId) {
          // Update existing template
          const { error } = await supabase
            .from('email_templates')
            .update(templateData)
            .eq('id', activeTemplateId)

          if (error) throw error

          if (!silent) {
            toast({
              title: 'Template saved',
              description: `"${derivedName}" has been updated.`,
            })
          }
        } else {
          // Create new template — capture the inserted row's id so
          // subsequent saves UPDATE the same row instead of INSERTing
          // again. Also reflect it in the URL so the editor is
          // refresh-resilient.
          const {
            data: { user },
          } = await supabase.auth.getUser()

          const { data, error } = await supabase
            .from('email_templates')
            .insert({
              ...templateData,
              created_by_id: user?.id,
            })
            .select('id')
            .single()

          if (error) throw error
          const newId: string | undefined = data?.id
          if (newId) {
            setActiveTemplateId(newId)
            // Sync the URL without reloading the page. router.replace
            // keeps the back button sane; the user lands on the
            // template-list with a single Back press, not after
            // navigating through every auto-save.
            router.replace(`/templates/editor?id=${newId}`)
          }

          if (!silent) {
            toast({
              title: 'Template created',
              description: `"${derivedName}" has been saved.`,
            })
          }
        }

        // Reflect the derived name in editor state so the header updates
        // and a subsequent save doesn't re-derive (the user has now seen
        // it as the official name).
        if (derivedName !== settings.name) {
          setSettings((prev) => ({ ...prev, name: derivedName }))
        }

        setHasUnsavedChanges(false)
        setLastSavedAt(new Date())

        if (exit) {
          router.push('/templates')
        }
      } catch (error) {
        // Verbose console log so we can capture the actual Postgres /
        // PostgREST error shape for debugging — these come back with
        // .message, .details, .hint, .code on the supabase error
        // object, and stringifying as JSON surfaces all of them.
        console.error('[useEmailEditor.saveTemplate] failed:', error)
        try {
          console.error(
            '[useEmailEditor.saveTemplate] error JSON:',
            JSON.stringify(error, Object.getOwnPropertyNames(error as object)),
          )
        } catch {
          /* ignore stringify failures */
        }

        if (!silent) {
          // Pull the most informative description we can from the
          // supabase error shape (PostgREST returns { message, details,
          // hint, code }). Falls back to the generic Error.message.
          const e = error as {
            message?: string
            details?: string
            hint?: string
            code?: string
          }
          const description =
            e.details || e.hint || e.message || 'An error occurred'
          toast({
            title: 'Failed to save template',
            description: e.code ? `${description} (${e.code})` : description,
            variant: 'destructive',
          })
        }
      } finally {
        savingRef.current = false
        setIsSaving(false)
        setIsAutoSaving(false)
      }
    },
    [activeTemplateId, blocks, settings, supabase, router, hasUnsavedChanges],
  )

  // Auto-save: fires AUTOSAVE_DEBOUNCE_MS after the last edit. Only
  // runs for templates that already have a row in the DB
  // (activeTemplateId is set). For brand-new templates the user must
  // hit Save Draft once first; after that, activeTemplateId is set and
  // auto-save takes over. The save uses silent=true so it never
  // toasts; the header status pill is the user's confirmation that the
  // write landed.
  useEffect(() => {
    if (!activeTemplateId) return
    if (!hasUnsavedChanges) return
    const handle = window.setTimeout(() => {
      saveTemplate(false, true)
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [hasUnsavedChanges, blocks, settings, activeTemplateId, saveTemplate])

  // Browser-level navigation guard. The in-app close button has its own
  // confirmation dialog, but a tab close / address-bar navigation needs
  // the native beforeunload prompt to back-stop the work.
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // Modern browsers ignore the custom message but still show their
      // built-in "Leave site?" prompt. Setting returnValue is the spec
      // way to opt in.
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedChanges])

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
    isAutoSaving,
    hasUnsavedChanges,
    lastSavedAt,

    // Setters
    setSelectedBlockId,

    // Block operations
    addBlock,
    addBlockFromModule,
    replaceBlocks,
    updateBlock,
    deleteBlock,
    duplicateBlock,
    moveBlock,

    // Settings operations
    updateSettings,

    // History
    undo,
    redo,
    canUndo: history.index > 0,
    canRedo: history.index < history.stack.length - 1,

    // Save/Close
    saveTemplate,
    closeEditor,
  }
}
