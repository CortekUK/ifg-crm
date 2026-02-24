'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Settings2 } from 'lucide-react'

export interface ColumnDef {
  key: string
  label: string
  alwaysVisible?: boolean
}

export const ALL_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name', alwaysVisible: true },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'graduation_year', label: 'Grad Year' },
  { key: 'position', label: 'Position' },
  { key: 'club_name', label: 'Club' },
  { key: 'country', label: 'Country' },
  { key: 'gpa', label: 'GPA' },
  { key: 'tags', label: 'Tags' },
  { key: 'source', label: 'Source' },
  { key: 'created_at', label: 'Date Created' },
  { key: 'status', label: 'Status' },
  { key: 'football_background', label: 'Football BG' },
  { key: 'academic_background', label: 'Academic BG' },
  { key: 'degree_choice', label: 'Degree' },
  { key: 'football_highlights', label: 'Highlights' },
  { key: 'preferred_programme', label: 'Programme' },
  { key: 'job_title', label: 'Job Title' },
]

export const DEFAULT_VISIBLE_COLUMNS = [
  'name', 'email', 'phone', 'graduation_year', 'country', 'tags', 'source', 'created_at', 'status',
]

const STORAGE_KEY = 'contacts-table-columns'

export function getStoredColumns(): string[] {
  if (typeof window === 'undefined') return DEFAULT_VISIBLE_COLUMNS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return DEFAULT_VISIBLE_COLUMNS
}

export function storeColumns(columns: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns))
  } catch {}
}

interface ColumnToggleProps {
  visibleColumns: string[]
  onToggle: (columns: string[]) => void
  customColumns?: ColumnDef[]
}

export function ColumnToggle({ visibleColumns, onToggle, customColumns = [] }: ColumnToggleProps) {
  const handleToggle = (key: string, checked: boolean) => {
    const next = checked
      ? [...visibleColumns, key]
      : visibleColumns.filter((k) => k !== key)
    onToggle(next)
    storeColumns(next)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 max-h-[70vh] overflow-y-auto">
        <div className="space-y-2">
          <p className="text-sm font-medium mb-2">Toggle Columns</p>
          {ALL_COLUMNS.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <Checkbox
                checked={col.alwaysVisible || visibleColumns.includes(col.key)}
                disabled={col.alwaysVisible}
                onCheckedChange={(checked) => handleToggle(col.key, checked as boolean)}
              />
              {col.label}
            </label>
          ))}
          {customColumns.length > 0 && (
            <>
              <div className="border-t my-2" />
              <p className="text-xs font-medium text-muted-foreground mb-1">Custom Fields</p>
              {customColumns.map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={visibleColumns.includes(col.key)}
                    onCheckedChange={(checked) => handleToggle(col.key, checked as boolean)}
                  />
                  {col.label}
                </label>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
