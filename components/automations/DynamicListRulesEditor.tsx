'use client'

// Grouped editor for the dynamic_list_rules array on a form-trigger
// automation. Replaces a flat list of "field / value / list" cards with
// one card per field, each containing a "this value goes to this list"
// row — mirrors the AC switch-statement layout the recruiter is used to
// and removes the "what field am I configuring?" mental tax.
//
// Why a separate component:
//   - The parent ConfigureAutomationModal is already 2500+ lines and we
//     don't want another 250 lines bolted on inside it.
//   - The value-suggestion dropdown and the inline "create list" flow
//     have their own state that's noisy at the parent level.
//
// Two niceties this adds beyond the old flat editor:
//   1. The Value cell is a Select populated from the actual values that
//      have come through the chosen form (useFormFieldValues). With a
//      free-text fallback for first-time setup. So "Male" / "MALE" /
//      "male" can't accidentally split a single rule into three.
//   2. The List cell has an inline "+ Create list…" item at the bottom
//      so the recruiter can spin up a list without leaving the modal.

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Trash2, Pencil, Sparkles } from 'lucide-react'
import { useFormFieldValues } from '@/lib/hooks/useFormSubmissions'
import { useCreateList } from '@/lib/hooks/useLists'
import { toast } from '@/lib/hooks/use-toast'

export interface DynamicListRule {
  field: string
  value: string
  list_id: string
}

interface DynamicListRulesEditorProps {
  formId: string | null | undefined
  rules: DynamicListRule[]
  lists: { id: string; name: string }[]
  onChange: (rules: DynamicListRule[]) => void
}

// Display labels for the supported fields. The webhook handlers
// (form-webhook, wordpress, activecampaign) read these field names from
// the contact / payload, so changing a key here without changing the
// switch-statement there will silently break the rule.
const FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: 'gender', label: 'Gender' },
  { key: 'graduation_year', label: 'Graduation Year' },
  { key: 'country', label: 'Country' },
  { key: 'state', label: 'State' },
  { key: 'position', label: 'Position' },
  { key: 'sport', label: 'Sport' },
]

// Hardcoded fallback suggestions used when no past form-submission data
// is available for the picked field. Once submissions start landing, the
// useFormFieldValues hook takes over and shows real values instead.
const FALLBACK_VALUES: Record<string, string[]> = {
  gender: ['male', 'female', 'other'],
  graduation_year: ['2024', '2025', '2026', '2027', '2028', '2029'],
  position: [
    'goalkeeper',
    'defender',
    'midfielder',
    'forward',
    'striker',
    'winger',
    'fullback',
    'centre-back',
  ],
  sport: ['football', 'basketball'],
  country: ['United Kingdom', 'United States', 'Ireland', 'Australia', 'Canada'],
  state: [],
}

export function DynamicListRulesEditor({
  formId,
  rules,
  lists,
  onChange,
}: DynamicListRulesEditorProps) {
  // Group the flat rules array by field. The flat shape stays the source of
  // truth in formData.config.dynamic_list_rules — we never persist groups,
  // only render them. Order of fields is the order they first appear in the
  // rules array, so editing one row doesn't reshuffle the cards on the user.
  const groups = useMemo(() => {
    const map = new Map<string, DynamicListRule[]>()
    for (const rule of rules) {
      const key = rule.field
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(rule)
    }
    return [...map.entries()].map(([field, items]) => ({ field, items }))
  }, [rules])

  // The set of fields NOT yet used in any rule — the "+ Add field" menu
  // hides ones that already have a card.
  const usedFields = new Set(groups.map((g) => g.field))
  const availableFields = FIELD_OPTIONS.filter((f) => !usedFields.has(f.key))

  // Mutators rebuild the flat array from the modified group. Keeps the
  // parent's onChange contract simple — it just sees a new rules array.
  const updateGroupRules = (field: string, items: DynamicListRule[]) => {
    const next: DynamicListRule[] = []
    let inserted = false
    for (const g of groups) {
      if (g.field === field) {
        next.push(...items)
        inserted = true
      } else {
        next.push(...g.items)
      }
    }
    if (!inserted) next.push(...items)
    onChange(next)
  }

  const addField = (field: string) => {
    onChange([...rules, { field, value: '', list_id: '' }])
  }

  const removeField = (field: string) => {
    onChange(rules.filter((r) => r.field !== field))
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Dynamic List Rules</Label>
        <p className="text-xs text-muted-foreground">
          When a form is submitted, route the contact into different lists based
          on what they answered. Matching is case-insensitive and ignores spaces
          — &ldquo;male&rdquo;, &ldquo;Male&rdquo;, &ldquo;MALE &rdquo; all match.
        </p>
      </div>

      {groups.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/30 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            No rules yet. Pick a field to split contacts on:
          </p>
          <AddFieldMenu availableFields={availableFields} onPick={addField} />
        </div>
      )}

      {groups.map((g) => (
        <FieldGroupCard
          key={g.field}
          field={g.field}
          formId={formId}
          items={g.items}
          lists={lists}
          onChange={(items) => updateGroupRules(g.field, items)}
          onRemove={() => removeField(g.field)}
        />
      ))}

      {groups.length > 0 && availableFields.length > 0 && (
        <AddFieldMenu availableFields={availableFields} onPick={addField} />
      )}
    </div>
  )
}

function AddFieldMenu({
  availableFields,
  onPick,
}: {
  availableFields: { key: string; label: string }[]
  onPick: (field: string) => void
}) {
  if (availableFields.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add field
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {availableFields.map((f) => (
          <DropdownMenuItem key={f.key} onClick={() => onPick(f.key)}>
            {f.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FieldGroupCard({
  field,
  formId,
  items,
  lists,
  onChange,
  onRemove,
}: {
  field: string
  formId: string | null | undefined
  items: DynamicListRule[]
  lists: { id: string; name: string }[]
  onChange: (items: DynamicListRule[]) => void
  onRemove: () => void
}) {
  const fieldLabel = FIELD_OPTIONS.find((f) => f.key === field)?.label ?? field
  const { data: seenValues = [] } = useFormFieldValues(formId, field)

  // Merge real values from form submissions with the hardcoded fallbacks
  // (only ones not already in the real-values list). De-duped + lower-
  // cased so "Male" and "male" don't both appear as separate options.
  const valueOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: { value: string; meta: string | null }[] = []
    for (const row of seenValues) {
      const key = row.value.trim().toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ value: row.value, meta: `${row.count} ${row.count === 1 ? 'submission' : 'submissions'}` })
      }
    }
    for (const v of FALLBACK_VALUES[field] ?? []) {
      const key = v.trim().toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ value: v, meta: 'suggested' })
      }
    }
    return out
  }, [seenValues, field])

  const updateRow = (index: number, patch: Partial<DynamicListRule>) => {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it))
    onChange(next)
  }

  const removeRow = (index: number) => {
    const next = items.filter((_, i) => i !== index)
    if (next.length === 0) {
      onRemove()
    } else {
      onChange(next)
    }
  }

  const addRow = () => {
    onChange([...items, { field, value: '', list_id: '' }])
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-sm font-medium">When {fieldLabel} is…</span>
          {valueOptions.length === 0 && formId && (
            <span className="text-[10px] text-muted-foreground ml-1">
              (no past submissions for this form yet — type the value below)
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-red-600"
          onClick={onRemove}
          title="Remove field"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="p-3 space-y-2">
        {items.map((rule, i) => (
          <RuleRow
            key={i}
            rule={rule}
            valueOptions={valueOptions}
            lists={lists}
            onChange={(patch) => updateRow(i, patch)}
            onRemove={() => removeRow(i)}
          />
        ))}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 h-7"
          onClick={addRow}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add value mapping
        </Button>
      </div>
    </div>
  )
}

function RuleRow({
  rule,
  valueOptions,
  lists,
  onChange,
  onRemove,
}: {
  rule: DynamicListRule
  valueOptions: { value: string; meta: string | null }[]
  lists: { id: string; name: string }[]
  onChange: (patch: Partial<DynamicListRule>) => void
  onRemove: () => void
}) {
  // Local state for "type custom value" mode — when the recruiter wants
  // to enter a value that hasn't appeared in past submissions yet (e.g.
  // a brand-new form).
  const [customMode, setCustomMode] = useState(false)
  const matchesKnownValue = valueOptions.some(
    (o) => o.value.trim().toLowerCase() === rule.value.trim().toLowerCase(),
  )
  const showCustom = customMode || (rule.value !== '' && !matchesKnownValue)

  const createList = useCreateList()
  const [creatingList, setCreatingList] = useState(false)
  const [newListName, setNewListName] = useState('')

  const handleCreateList = async () => {
    const name = newListName.trim()
    if (!name) return
    try {
      const created = await createList.mutateAsync({ name, is_dynamic: false })
      onChange({ list_id: created.id })
      toast({ title: 'List created', description: `"${name}" is now selectable.` })
      setNewListName('')
      setCreatingList(false)
    } catch (err) {
      toast({
        title: 'Could not create list',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      {/* Value column */}
      <div className="flex-1 min-w-[140px] space-y-1">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Value
        </Label>
        {showCustom ? (
          <div className="flex gap-1">
            <Input
              placeholder="Type a value…"
              className="h-9 text-sm"
              value={rule.value}
              onChange={(e) => onChange({ value: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => {
                setCustomMode(false)
                onChange({ value: '' })
              }}
              title="Use a known value instead"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Select
            value={rule.value}
            onValueChange={(v) => {
              if (v === '__custom__') {
                setCustomMode(true)
                onChange({ value: '' })
              } else {
                onChange({ value: v })
              }
            }}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Pick a value" />
            </SelectTrigger>
            <SelectContent>
              {valueOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span>{opt.value}</span>
                  {opt.meta && (
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {opt.meta}
                    </span>
                  )}
                </SelectItem>
              ))}
              <SelectItem value="__custom__">
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Pencil className="h-3 w-3" />
                  Type a custom value…
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="text-xs text-muted-foreground pb-2">→</div>

      {/* List column */}
      <div className="flex-[2] min-w-[180px] space-y-1">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Add to list
        </Label>
        {creatingList ? (
          <div className="flex gap-1">
            <Input
              autoFocus
              placeholder="New list name…"
              className="h-9 text-sm"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreateList()
                } else if (e.key === 'Escape') {
                  setCreatingList(false)
                  setNewListName('')
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-9"
              disabled={!newListName.trim() || createList.isPending}
              onClick={handleCreateList}
            >
              Create
            </Button>
          </div>
        ) : (
          <Select
            value={rule.list_id}
            onValueChange={(v) => {
              if (v === '__create__') {
                setCreatingList(true)
              } else {
                onChange({ list_id: v })
              }
            }}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Pick a list" />
            </SelectTrigger>
            <SelectContent>
              {lists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name}
                </SelectItem>
              ))}
              <SelectItem value="__create__">
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Plus className="h-3 w-3" />
                  Create new list…
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Remove row */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-red-600"
        onClick={onRemove}
        title="Remove this mapping"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
