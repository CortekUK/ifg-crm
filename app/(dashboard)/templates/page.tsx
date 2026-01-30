'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TemplatesPageHeader } from '@/components/templates/TemplatesPageHeader'
import { TemplateStats } from '@/components/templates/TemplateStats'
import { TemplateFilters } from '@/components/templates/TemplateFilters'
import { TemplatesGrid } from '@/components/templates/TemplatesGrid'
import { useTemplates, useDeleteTemplate } from '@/lib/hooks/useTemplates'
import { useTemplateStats } from '@/lib/hooks/useTemplateStats'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { toast } from '@/lib/hooks/use-toast'
import type { TemplateFilters as TemplateFiltersType, Template } from '@/lib/types/templates'

export default function TemplatesPage() {
  const router = useRouter()
  const [filters, setFilters] = useState<TemplateFiltersType>({})

  // Debounce search
  const debouncedFilters = {
    ...filters,
    search: useDebouncedValue(filters.search || '', 300),
  }

  // Fetch templates
  const { data: templates = [], isLoading } = useTemplates(debouncedFilters)

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useTemplateStats()

  // Delete mutation
  const deleteTemplate = useDeleteTemplate()

  const handleCreate = () => {
    // Navigate to the editor for creating a new template
    router.push('/templates/editor')
  }

  const handleEdit = (template: Template) => {
    // Navigate to the editor with the template ID
    router.push(`/templates/editor?id=${template.id}`)
  }

  const handleDelete = async (template: Template) => {
    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
      try {
        await deleteTemplate.mutateAsync(template.id)
        toast({
          title: 'Template deleted',
          description: `"${template.name}" has been removed.`,
        })
      } catch (error) {
        toast({
          title: 'Failed to delete template',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        })
      }
    }
  }

  const handleImport = () => {
    // For now, show a toast - will implement import modal later
    toast({
      title: 'Coming soon',
      description: 'HTML import functionality will be available in a future update.',
    })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <TemplatesPageHeader
        onImportClick={handleImport}
        onCreateClick={handleCreate}
      />

      {/* Stats */}
      <TemplateStats
        totalTemplates={stats?.totalTemplates || 0}
        emailTemplates={stats?.emailTemplates || 0}
        smsTemplates={stats?.smsTemplates || 0}
        activeAutomations={stats?.activeAutomations || 0}
        isLoading={statsLoading}
      />

      {/* Filters */}
      <TemplateFilters filters={filters} onFiltersChange={setFilters} />

      {/* Templates Grid */}
      <TemplatesGrid
        templates={templates}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  )
}
