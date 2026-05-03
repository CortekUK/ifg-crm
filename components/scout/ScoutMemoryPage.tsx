'use client'

// Memory settings panel. Mirrors Claude's memory tab — list of saved entries,
// inline edit, delete, manual add. Lives at /scout/memory.
//
// Source field on each row tells the user where the entry came from
// ('auto' = Scout decided to save it; 'manual' = user typed it). Edits flip
// the source to 'manual' so the audit reads truthfully.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Sparkles, Bot, User, Trash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

interface Memory {
  id: string
  content: string
  source: 'manual' | 'auto'
  created_at: string
  updated_at: string
}

export function ScoutMemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [busy, setBusy] = useState(false)
  // The id we're prompting to delete (null = no delete-one dialog open).
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  // Whether the "clear all" confirmation dialog is open.
  const [clearAllOpen, setClearAllOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/scout/memory', { cache: 'no-store' })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load')
      const data = (await res.json()) as { memories: Memory[] }
      setMemories(data.memories)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleAdd = async () => {
    const content = newContent.trim()
    if (!content) return
    setBusy(true)
    try {
      const res = await fetch('/api/scout/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save')
      const data = (await res.json()) as { memory: Memory }
      setMemories((prev) => [data.memory, ...prev])
      setNewContent('')
      setAdding(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveEdit = async (id: string) => {
    const content = draft.trim()
    if (!content) return
    setBusy(true)
    try {
      const res = await fetch(`/api/scout/memory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save')
      const data = (await res.json()) as { memory: Memory }
      setMemories((prev) => prev.map((m) => (m.id === id ? data.memory : m)))
      setEditingId(null)
      setDraft('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    setBusy(true)
    try {
      const res = await fetch(`/api/scout/memory/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete')
      setMemories((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setBusy(false)
      setPendingDeleteId(null)
    }
  }

  const confirmClearAll = async () => {
    if (memories.length === 0) {
      setClearAllOpen(false)
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/scout/memory', { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to clear')
      setMemories([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear')
    } finally {
      setBusy(false)
      setClearAllOpen(false)
    }
  }

  return (
    <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-3">
        <div>
          <Link
            href="/scout"
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Scout
          </Link>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900 dark:text-slate-100">
            Memory
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Things Scout remembers about you across conversations. Add, edit, or remove anytime.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {memories.length > 0 && (
            <Button
              onClick={() => setClearAllOpen(true)}
              disabled={busy}
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
              title="Delete every memory"
            >
              <Trash className="mr-1.5 h-4 w-4" />
              Clear all
            </Button>
          )}
          <Button
            onClick={() => {
              setAdding(true)
              setNewContent('')
            }}
            disabled={adding}
            className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add memory
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="mb-4 rounded-2xl border border-fuchsia-200 bg-fuchsia-50/40 p-4 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/20">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={2}
            placeholder="A short fact Scout should remember…"
            autoFocus
            className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-fuchsia-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false)
                setNewContent('')
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={busy || !newContent.trim()}
              className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading memories…
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-fuchsia-400" strokeWidth={1.5} />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            No memories yet.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Tell Scout to &quot;remember&quot; something during a chat, or add one manually here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {memories.map((m) => {
            const editing = editingId === m.id
            return (
              <li
                key={m.id}
                className={cn(
                  'group rounded-2xl border bg-white p-4 transition dark:bg-slate-900',
                  editing
                    ? 'border-fuchsia-300 dark:border-fuchsia-500/60'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700',
                )}
              >
                {editing ? (
                  <>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={2}
                      autoFocus
                      className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-fuchsia-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(null)
                          setDraft('')
                        }}
                        disabled={busy}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(m.id)}
                        disabled={busy || !draft.trim()}
                        className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full',
                        m.source === 'auto'
                          ? 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/40 dark:text-fuchsia-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                      )}
                      title={m.source === 'auto' ? 'Saved by Scout' : 'Added by you'}
                    >
                      {m.source === 'auto' ? (
                        <Bot className="h-3.5 w-3.5" />
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="flex-1 text-sm text-slate-800 dark:text-slate-100">
                      <p className="leading-relaxed">{m.content}</p>
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                        {m.source === 'auto' ? 'Saved by Scout' : 'Added manually'} ·{' '}
                        {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingId(m.id)
                          setDraft(m.content)
                        }}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                        onClick={() => setPendingDeleteId(m.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Single-row delete confirmation. */}
      <AlertDialog
        open={!!pendingDeleteId}
        onOpenChange={(o) => !o && !busy && setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              Scout will forget this fact and won&apos;t apply it in future
              conversations. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
              disabled={busy}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk-clear confirmation. */}
      <AlertDialog
        open={clearAllOpen}
        onOpenChange={(o) => !o && !busy && setClearAllOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Clear all {memories.length} memories?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Scout will start fresh with no saved facts about you. This
              wipes everything in your memory pool and can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmClearAll()
              }}
              disabled={busy}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Trash className="mr-1.5 h-4 w-4" />
              )}
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
