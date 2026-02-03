'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Mail } from 'lucide-react'
import { TemplateCard } from './TemplateCard'
import type { Template } from '@/lib/types/templates'

interface TemplatesGridProps {
  templates: Template[]
  isLoading: boolean
  onEdit: (template: Template) => void
  onDelete: (template: Template) => void
  onDuplicate: (template: Template) => void
  onPreview: (template: Template) => void
}

export function TemplatesGrid({
  templates,
  isLoading,
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
}: TemplatesGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg overflow-hidden">
            <Skeleton className="h-40 w-full" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="p-4 pt-0 flex gap-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No templates yet</h3>
        <p className="text-muted-foreground">
          Create your first template to streamline your communications.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onPreview={onPreview}
        />
      ))}
    </div>
  )
}
