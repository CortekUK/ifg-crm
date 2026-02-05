'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GitBranch, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConditionalBlockContent } from '@/lib/templates/editor-types'

interface ConditionalBlockProps {
  content: Record<string, unknown>
  isSelected: boolean
  onUpdate: (updates: Record<string, unknown>) => void
}

const conditionFields = [
  { value: 'deal_owner_email', label: 'Deal Owner Email' },
  { value: 'deal_owner_name', label: 'Deal Owner Name' },
  { value: 'deal_pipeline', label: 'Pipeline Name' },
]

const conditionOperators = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
]

export function ConditionalBlock({ content, isSelected, onUpdate }: ConditionalBlockProps) {
  const conditionalContent = content as unknown as ConditionalBlockContent

  const hasCondition = conditionalContent.conditionValue && conditionalContent.conditionValue.trim() !== ''
  const hasChildren = (conditionalContent.children?.length || 0) > 0

  return (
    <div
      style={{
        paddingTop: `${conditionalContent.paddingTop || 0}px`,
        paddingBottom: `${conditionalContent.paddingBottom || 0}px`,
      }}
    >
      {/* Condition Configuration - always visible when selected */}
      {isSelected && (
        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Show this content IF:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={conditionalContent.conditionField || 'deal_owner_email'}
              onValueChange={(v) => onUpdate({ conditionField: v })}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs bg-white dark:bg-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {conditionFields.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={conditionalContent.conditionOperator || 'equals'}
              onValueChange={(v) => onUpdate({ conditionOperator: v })}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs bg-white dark:bg-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {conditionOperators.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={conditionalContent.conditionValue || ''}
              onChange={(e) => onUpdate({ conditionValue: e.target.value })}
              placeholder={
                conditionalContent.conditionField === 'deal_owner_email'
                  ? 'nathan@macclesfieldfc.com'
                  : conditionalContent.conditionField === 'deal_owner_name'
                  ? 'Nathan Bibby'
                  : 'UK Gap Year 2026'
              }
              className="h-8 flex-1 min-w-[200px] text-xs bg-white dark:bg-slate-800"
            />
          </div>

          {!hasCondition && (
            <div className="flex items-center gap-2 mt-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Enter a condition value to activate this block</span>
            </div>
          )}
        </div>
      )}

      {/* Content Area */}
      <div
        className={cn(
          'min-h-[60px] rounded-lg border-2 border-dashed p-4',
          isSelected
            ? 'border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/10'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30'
        )}
      >
        {hasChildren ? (
          <div className="text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {conditionalContent.children?.length} conditional block(s)
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <GitBranch className="h-6 w-6 text-amber-400 dark:text-amber-500 mb-2" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Conditional Content
            </p>
            {hasCondition ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 max-w-xs">
                Shows when {conditionFields.find(f => f.value === conditionalContent.conditionField)?.label || 'field'}{' '}
                {conditionOperators.find(o => o.value === conditionalContent.conditionOperator)?.label || 'equals'}{' '}
                "{conditionalContent.conditionValue}"
              </p>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Configure the condition above
              </p>
            )}
          </div>
        )}
      </div>

      {/* Hint for nested blocks */}
      {isSelected && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
          Tip: Add blocks inside this conditional to show them only when the condition is met.
        </p>
      )}
    </div>
  )
}
