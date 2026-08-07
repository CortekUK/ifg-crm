'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Eye,
  Download,
  Users,
  ListChecks,
  Megaphone,
  GitBranch,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
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
import { EmptyState } from '@/components/website-content/_shared'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { toast } from '@/lib/hooks/use-toast'
import {
  useBrochures,
  useBrochureStats,
  useToggleBrochurePublished,
  useDeleteBrochure,
} from '@/lib/hooks/useWebsiteBrochures'
import type { WebsiteBrochure } from '@/lib/types/website-content'
import { BrochureModal } from '@/components/brochures/BrochureModal'
import { BrochureDetail, CountChip } from '@/components/brochures/BrochureDetail'
import { brochurePublicUrl, copyToClipboard } from '@/components/brochures/shared'

export default function BrochuresPage() {
  const router = useRouter()
  const { data: currentUser, isLoading: userLoading } = useCurrentUser()
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const { data: brochures = [], isLoading, isError } = useBrochures()
  const { data: statsMap } = useBrochureStats()
  const togglePublished = useToggleBrochurePublished()
  const deleteBrochure = useDeleteBrochure()

  const [modalOpen, setModalOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<WebsiteBrochure | null>(null)
  const [detail, setDetail] = React.useState<WebsiteBrochure | null>(null)
  const [toDelete, setToDelete] = React.useState<WebsiteBrochure | null>(null)
  const [togglingId, setTogglingId] = React.useState<string | null>(null)

  // Brochure management is admin-only (mirrors the sidebar link + Lists page).
  React.useEffect(() => {
    if (!userLoading && currentUser && !isAdmin) router.replace('/contacts')
  }, [userLoading, currentUser, isAdmin, router])

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (b: WebsiteBrochure) => {
    setEditing(b)
    setModalOpen(true)
  }

  const handleToggle = async (b: WebsiteBrochure, published: boolean) => {
    if (published && !b.pdf_url) {
      toast({
        title: 'A PDF is required to publish',
        description: 'Edit the brochure and upload a PDF first.',
        variant: 'destructive',
      })
      return
    }
    setTogglingId(b.id)
    try {
      await togglePublished.mutateAsync({ id: b.id, published })
      toast({ title: published ? 'Brochure activated' : 'Brochure deactivated' })
    } catch (err) {
      toast({ title: 'Could not update status', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      await deleteBrochure.mutateAsync(toDelete.id)
      toast({ title: 'Brochure deleted', description: `"${toDelete.title}" has been removed.` })
    } catch (err) {
      toast({ title: 'Could not delete', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    }
    setToDelete(null)
  }

  if (userLoading || (currentUser && !isAdmin)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="banner-gradient rounded-xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-oswald text-2xl font-semibold text-white">Brochures</h1>
            <p className="mt-1 max-w-2xl text-base text-white/90">
              Self-hosted flipbooks with gated lead capture. Publish a programme brochure, then
              route the leads it captures into your lists, campaigns and pipelines.
            </p>
          </div>
          <Button onClick={openCreate} className="bg-white text-blue-600 hover:bg-blue-50">
            <Plus className="mr-2 h-4 w-4" />
            Add brochure
          </Button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-dashed border-red-300 bg-red-50/60 px-6 py-14 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <p className="font-medium text-red-600 dark:text-red-400">Could not load brochures.</p>
          <p className="mt-1 text-sm text-muted-foreground">Please refresh the page and try again.</p>
        </div>
      ) : brochures.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          tint="violet"
          title="No brochures yet"
          description="Create your first brochure to replace the external flipbooks and start capturing leads straight into the CRM."
          addLabel="Add brochure"
          onAdd={openCreate}
        />
      ) : (
        <div className="space-y-3">
          {brochures.map((b) => {
            const stats = statsMap?.[b.id]
            return (
              <div
                key={b.id}
                className="group flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center"
              >
                {/* Cover + title (opens detail) */}
                <button
                  type="button"
                  onClick={() => setDetail(b)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                >
                  <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {b.cover_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.cover_image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <BookOpen className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{b.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {b.page_count ? `${b.page_count} page${b.page_count === 1 ? '' : 's'} · ` : ''}
                      /b/{b.slug}
                    </p>
                    {/* Stats */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {(stats?.views ?? b.views_count ?? 0).toLocaleString()} views
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {(stats?.leads ?? 0).toLocaleString()} leads
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-3.5 w-3.5" />
                        {(stats?.downloads ?? b.download_count ?? 0).toLocaleString()} downloads
                      </span>
                    </div>
                    {/* Association chips */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <CountChip icon={ListChecks} count={stats?.list_ids.length ?? 0} label="lists" />
                      <CountChip icon={Megaphone} count={stats?.campaign_ids.length ?? 0} label="campaigns" />
                      <CountChip icon={GitBranch} count={stats?.pipelines.length ?? 0} label="pipelines" />
                    </div>
                  </div>
                </button>

                {/* Controls */}
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                  <label className="flex cursor-pointer items-center gap-2">
                    {togglingId === b.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Switch
                        checked={b.published}
                        onCheckedChange={(v) => handleToggle(b, v)}
                        aria-label="Toggle active"
                      />
                    )}
                    <span className={b.published ? 'text-xs font-medium text-emerald-600 dark:text-emerald-400' : 'text-xs text-muted-foreground'}>
                      {b.published ? 'Active' : 'Inactive'}
                    </span>
                  </label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(brochurePublicUrl(b.slug))}
                      aria-label="Copy public link"
                      title="Copy public link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(b)}
                      aria-label="Edit"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => setToDelete(b)}
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      <BrochureModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />

      {/* Detail drawer */}
      <BrochureDetail
        brochure={detail}
        stats={detail ? statsMap?.[detail.id] : undefined}
        open={!!detail}
        onClose={() => setDetail(null)}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete brochure?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{' '}
              <span className="font-medium">&ldquo;{toDelete?.title}&rdquo;</span> and removes it from the
              live website. Captured leads remain in the CRM. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteBrochure.isPending}
            >
              {deleteBrochure.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
