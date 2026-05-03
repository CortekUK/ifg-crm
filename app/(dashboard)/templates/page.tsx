'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { TemplatesPageHeader } from '@/components/templates/TemplatesPageHeader'
import { TemplateStats } from '@/components/templates/TemplateStats'
import { TemplateFilters } from '@/components/templates/TemplateFilters'
import { TemplatesGrid } from '@/components/templates/TemplatesGrid'
import { TemplatesTable } from '@/components/templates/TemplatesTable'
import { DeleteTemplateDialog } from '@/components/templates/DeleteTemplateDialog'
import { TemplatePreviewModal } from '@/components/templates/TemplatePreviewModal'
import { useTemplates, useDeleteTemplate, useDuplicateTemplate } from '@/lib/hooks/useTemplates'
import { useTemplateStats } from '@/lib/hooks/useTemplateStats'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { toast } from '@/lib/hooks/use-toast'
import type { TemplateFilters as TemplateFiltersType, Template } from '@/lib/types/templates'
import { ErrorState } from '@/components/ui/error-state'

export default function TemplatesPage() {
  const router = useRouter()
  // All hooks declared before any early-return so React sees a stable order.
  const { data: currentUser, isLoading: userLoading } = useCurrentUser()
  const isAdmin =
    currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const [filters, setFilters] = useState<TemplateFiltersType>({})
  // Default to list view — cards were too sparse and the user
  // explicitly asked the list to be the landing view.
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  // Debounce search
  const debouncedFilters = {
    ...filters,
    search: useDebouncedValue(filters.search || '', 300),
  }

  // Fetch templates
  const { data: templates = [], isLoading, error, refetch, isFetching } = useTemplates(debouncedFilters)
  const visibleTemplates = templates

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useTemplateStats()

  // Mutations
  const deleteTemplate = useDeleteTemplate()
  const duplicateTemplate = useDuplicateTemplate()

  // Templates are admin-managed. Recruiters get bounced back to dashboard.
  // Hooks above stay in stable order; the early-return is below.
  useEffect(() => {
    if (!userLoading && currentUser && !isAdmin) {
      router.replace('/dashboard')
    }
  }, [userLoading, currentUser, isAdmin, router])

  const handleCreate = () => {
    router.push('/templates/editor')
  }

  const handleEdit = (template: Template) => {
    router.push(`/templates/editor?id=${template.id}`)
  }

  const handleDeleteClick = (template: Template) => {
    setSelectedTemplate(template)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedTemplate) return

    try {
      await deleteTemplate.mutateAsync(selectedTemplate.id)
      toast({
        title: 'Template deleted',
        description: `"${selectedTemplate.name}" has been removed.`,
      })
      setDeleteDialogOpen(false)
      setSelectedTemplate(null)
    } catch (error) {
      toast({
        title: 'Failed to delete template',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleDuplicate = async (template: Template) => {
    try {
      const newTemplate = await duplicateTemplate.mutateAsync(template)
      toast({
        title: 'Template duplicated',
        description: `Created "Copy of ${template.name}".`,
      })
      // Optionally navigate to the new template
      router.push(`/templates/editor?id=${newTemplate.id}`)
    } catch (error) {
      toast({
        title: 'Failed to duplicate template',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handlePreview = (template: Template) => {
    setSelectedTemplate(template)
    setPreviewModalOpen(true)
  }

  // While role is being checked or non-admin is being redirected, show spinner.
  if (userLoading || (currentUser && !isAdmin)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <TemplatesPageHeader onCreateClick={handleCreate} />

      {/* Stats - hidden on mobile */}
      <div className="hidden sm:block">
      <TemplateStats
        totalTemplates={stats?.totalTemplates || 0}
        automationTemplates={stats?.automationTemplates || 0}
        campaignTemplates={stats?.campaignTemplates || 0}
        activeAutomations={stats?.activeAutomations || 0}
        isLoading={statsLoading}
      />
      </div>

      {/* Filters + View Toggle */}
      <TemplateFilters
        filters={filters}
        onFiltersChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Error State */}
      {error && (
        <ErrorState
          title="Failed to load templates"
          message="We couldn't load your templates. Please check your connection and try again."
          onRetry={() => refetch()}
          isRetrying={isFetching}
          compact
        />
      )}

      {/* Templates Grid (desktop only when grid mode) or Table */}
      {viewMode === 'grid' && (
        <div className="hidden sm:block">
          <TemplatesGrid
            templates={visibleTemplates}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onDuplicate={handleDuplicate}
            onPreview={handlePreview}
          />
        </div>
      )}
      {/* Always show table on mobile, or when list mode on desktop */}
      <div className={viewMode === 'grid' ? 'sm:hidden' : ''}>
        <TemplatesTable
          templates={visibleTemplates}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onDuplicate={handleDuplicate}
          onPreview={handlePreview}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteTemplateDialog
        template={selectedTemplate}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteTemplate.isPending}
      />

      {/* Preview Modal */}
      <TemplatePreviewModal
        template={selectedTemplate}
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
      />
    </div>
  )
}
