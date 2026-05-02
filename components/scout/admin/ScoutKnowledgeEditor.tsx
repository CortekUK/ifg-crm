'use client'

// Knowledge-base editor for Scout. Two-pane layout: list of articles on the
// left, edit form on the right. Uses the /api/scout/knowledge endpoints —
// no React Query here because the volume is tiny and a simple fetch + local
// state keeps the file readable.

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Save, BookOpenText, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { ScoutMarkdown } from '@/components/scout/ScoutMarkdown'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface KnowledgeArticle {
  id: string
  slug: string
  title: string
  body_md: string
  tags: string[]
  created_at: string
  updated_at: string
}

type DraftArticle = Omit<KnowledgeArticle, 'id' | 'created_at' | 'updated_at'> & {
  id: string | null
}

const EMPTY_DRAFT: DraftArticle = {
  id: null,
  slug: '',
  title: '',
  body_md: '',
  tags: [],
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function ScoutKnowledgeEditor() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<DraftArticle>(EMPTY_DRAFT)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [autoSlug, setAutoSlug] = useState(true)

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/scout/knowledge', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setArticles(json.articles ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load articles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  // Auto-derive slug from title until the user manually edits it.
  useEffect(() => {
    if (autoSlug && !draft.id) {
      setDraft((d) => ({ ...d, slug: slugify(d.title) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.title])

  const isEditing = draft.id !== null
  const isNew = !isEditing && (draft.title || draft.body_md)

  const startNew = () => {
    setDraft(EMPTY_DRAFT)
    setAutoSlug(true)
    setPreviewing(false)
  }

  const loadInto = (a: KnowledgeArticle) => {
    setDraft({
      id: a.id,
      slug: a.slug,
      title: a.title,
      body_md: a.body_md,
      tags: [...a.tags],
    })
    setAutoSlug(false)
    setPreviewing(false)
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (!t) return
    if (!draft.tags.includes(t)) {
      setDraft((d) => ({ ...d, tags: [...d.tags, t] }))
    }
    setTagInput('')
  }

  const removeTag = (t: string) => {
    setDraft((d) => ({ ...d, tags: d.tags.filter((x) => x !== t) }))
  }

  const save = async () => {
    if (!draft.title.trim() || !draft.slug.trim() || !draft.body_md.trim()) {
      toast.error('Title, slug and body are required')
      return
    }
    setSaving(true)
    try {
      const url = draft.id
        ? `/api/scout/knowledge/${draft.id}`
        : '/api/scout/knowledge'
      const method = draft.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: draft.slug.trim(),
          title: draft.title.trim(),
          body_md: draft.body_md,
          tags: draft.tags,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      toast.success(draft.id ? 'Article updated' : 'Article created')
      const saved: KnowledgeArticle = json.article
      setDraft({
        id: saved.id,
        slug: saved.slug,
        title: saved.title,
        body_md: saved.body_md,
        tags: [...saved.tags],
      })
      setAutoSlug(false)
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    try {
      const res = await fetch(`/api/scout/knowledge/${pendingDeleteId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Delete failed')
      toast.success('Article deleted')
      if (draft.id === pendingDeleteId) startNew()
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setPendingDeleteId(null)
    }
  }

  const filteredCount = useMemo(() => articles.length, [articles])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
            <BookOpenText className="h-6 w-6 text-indigo-500" />
            Scout Knowledge Base
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Long-form documentation Scout cites when the built-in glossary
            isn&apos;t enough. Edits are picked up on Scout&apos;s next response
            — no redeploy.
          </p>
        </div>
        <Button onClick={startNew} className="shrink-0">
          <Plus className="mr-1.5 h-4 w-4" />
          New article
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* List pane */}
        <Card className="flex flex-col overflow-hidden p-0">
          <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Articles
            <span className="ml-2 text-[10px] font-normal text-slate-400">
              {filteredCount}
            </span>
          </div>
          <ScrollArea className="h-[560px]">
            <div className="space-y-1 p-2">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : articles.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <FileText className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    No articles yet. Click <span className="font-medium">New article</span> to add one.
                  </p>
                </div>
              ) : (
                articles.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => loadInto(a)}
                    className={cn(
                      'group flex w-full flex-col items-start gap-1 rounded-lg border border-transparent px-2.5 py-2 text-left transition',
                      'hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/60',
                      draft.id === a.id &&
                        'border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/40 dark:bg-indigo-900/20',
                    )}
                  >
                    <span className="line-clamp-1 text-sm font-medium text-slate-900 dark:text-white">
                      {a.title}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{a.slug}</span>
                    {a.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {a.tags.slice(0, 3).map((t) => (
                          <Badge
                            key={t}
                            variant="secondary"
                            className="h-4 px-1.5 text-[9px] font-normal"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Editor pane */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isEditing ? 'Edit article' : isNew ? 'New article' : 'Pick or create'}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewing((v) => !v)}
                disabled={!draft.body_md}
              >
                {previewing ? 'Edit' : 'Preview'}
              </Button>
              {isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPendingDeleteId(draft.id!)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1 h-3.5 w-3.5" />
                )}
                Save
              </Button>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Title
                </label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="e.g. How Smart Deal works"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Slug
                  <span className="ml-2 font-normal text-slate-400">
                    (lowercase letters, numbers, hyphens)
                  </span>
                </label>
                <Input
                  value={draft.slug}
                  onChange={(e) => {
                    setAutoSlug(false)
                    setDraft((d) => ({ ...d, slug: e.target.value }))
                  }}
                  placeholder="smart-deal-flow"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Tags
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {draft.tags.map((t) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="cursor-pointer gap-1"
                    onClick={() => removeTag(t)}
                  >
                    {t}
                    <span className="text-slate-400 hover:text-red-500">×</span>
                  </Badge>
                ))}
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  onBlur={addTag}
                  placeholder="Add tag and press Enter…"
                  className="h-7 w-40 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Body (Markdown)
              </label>
              {previewing ? (
                <div className="min-h-[300px] rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  {draft.body_md ? (
                    <ScoutMarkdown text={draft.body_md} />
                  ) : (
                    <p className="text-xs text-slate-400">Nothing to preview yet.</p>
                  )}
                </div>
              ) : (
                <Textarea
                  value={draft.body_md}
                  onChange={(e) => setDraft((d) => ({ ...d, body_md: e.target.value }))}
                  rows={18}
                  placeholder="# How Smart Deal works&#10;&#10;Smart Deal is the bulk-conversion action on the Replies page…"
                  className="font-mono text-xs"
                />
              )}
            </div>
          </div>
        </Card>
      </div>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this article?</AlertDialogTitle>
            <AlertDialogDescription>
              Scout will lose access to this content immediately. This action
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
