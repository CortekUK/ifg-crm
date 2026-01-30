'use client'

import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, Pencil, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Template } from '@/lib/types/templates'

interface TemplateCardProps {
  template: Template
  onEdit: (template: Template) => void
  onDelete: (template: Template) => void
}

const categoryConfig: Record<Template['category'], { label: string; className: string }> = {
  automation: { label: 'Automation', className: 'bg-purple-100 text-purple-700' },
  campaign: { label: 'Campaign', className: 'bg-blue-100 text-blue-700' },
  transactional: { label: 'Transactional', className: 'bg-green-100 text-green-700' },
}

export function TemplateCard({ template, onEdit, onDelete }: TemplateCardProps) {
  const category = categoryConfig[template.category]

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Preview Thumbnail */}
      <div className="h-40 bg-gray-100 flex items-center justify-center border-b">
        <Mail className="h-12 w-12 text-gray-300" />
      </div>

      <CardContent className="p-4">
        {/* Template Name */}
        <h3 className="font-semibold text-gray-900 truncate mb-2">
          {template.name}
        </h3>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="outline" className="text-xs font-normal">
            Email
          </Badge>
          <Badge className={cn('text-xs font-normal', category.className)}>
            {category.label}
          </Badge>
        </div>

        {/* Last Updated */}
        <p className="text-xs text-muted-foreground">
          Last updated: {formatDate(template.updated_at)}
        </p>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onEdit(template)}
        >
          <Pencil className="h-4 w-4 mr-1" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => onDelete(template)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}
