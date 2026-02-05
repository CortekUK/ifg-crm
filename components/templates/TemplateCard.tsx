'use client'

import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Mail, Pencil, Trash2, Copy, Eye, MoreVertical } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Template } from '@/lib/types/templates'

interface TemplateCardProps {
  template: Template
  onEdit: (template: Template) => void
  onDelete: (template: Template) => void
  onDuplicate: (template: Template) => void
  onPreview: (template: Template) => void
}

const categoryConfig: Record<Template['category'], { label: string; className: string }> = {
  automation: { label: 'Automation', className: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' },
  campaign: { label: 'Campaign', className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  transactional: { label: 'Transactional', className: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
}

export function TemplateCard({ 
  template, 
  onEdit, 
  onDelete, 
  onDuplicate, 
  onPreview 
}: TemplateCardProps) {
  const category = categoryConfig[template.category]

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow group">
      {/* Preview Thumbnail */}
      <div
        className="h-40 bg-gray-100 dark:bg-slate-800 flex items-center justify-center border-b dark:border-slate-700 relative cursor-pointer"
        onClick={() => onPreview(template)}
      >
        <Mail className="h-12 w-12 text-gray-300 dark:text-slate-600" />
        {/* Hover overlay with preview button */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button variant="secondary" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
        </div>
      </div>

      <CardContent className="p-4">
        {/* Template Name */}
        <h3 className="font-semibold text-gray-900 dark:text-white truncate mb-1">
          {template.name}
        </h3>

        {/* Subject Line */}
        <p className="text-sm text-muted-foreground truncate mb-3">
          {template.subject || 'No subject'}
        </p>

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
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPreview(template)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(template)}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(template)}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  )
}
