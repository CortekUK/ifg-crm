'use client'

import * as React from 'react'
import { RotateCcw, Plus, Trash2, Dot, Loader2, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/hooks/use-toast'
import { useWebsitePages, useSaveWebsitePage } from '@/lib/hooks/useWebsitePages'
import { getPageSchema, schemaSections, type PageField } from '@/lib/website-content/page-schema'
import { getPath, setPath } from '@/lib/website-content/overrides'
import { ImageField } from './ImageField'
import { MultiImageField } from './MultiImageField'

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
type Values = Record<string, string | string[]>

function FieldControl({
  field, value, modified, onChange, onReset,
}: {
  field: PageField
  value: string | string[]
  modified: boolean
  onChange: (v: string | string[]) => void
  onReset: () => void
}) {
  const strVal = typeof value === 'string' ? value : ''
  const arrVal = Array.isArray(value) ? value : []
  const header = (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {field.label}
        {modified && <Dot className="h-4 w-4 text-emerald-500" aria-label="Changed from default" />}
      </span>
      {modified && (
        <button type="button" onClick={onReset} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <RotateCcw className="h-3 w-3" />Reset
        </button>
      )}
    </div>
  )

  if (field.type === 'image') {
    return <div className="space-y-1.5">{header}<ImageField label="" hint={field.hint} value={strVal} onChange={onChange} /></div>
  }
  if (field.type === 'images') {
    return (
      <div className="space-y-1.5">{header}
        <MultiImageField label="" value={arrVal} onChange={onChange} />
        {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
      </div>
    )
  }
  if (field.type === 'list') {
    return (
      <div className="space-y-2">{header}
        <div className="space-y-2">
          {arrVal.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <Textarea rows={2} value={item} className="min-h-0"
                onChange={(e) => onChange(arrVal.map((v, idx) => (idx === i ? e.target.value : v)))} />
              <Button type="button" variant="outline" size="icon" onClick={() => onChange(arrVal.filter((_, idx) => idx !== i))} aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...arrVal, ''])}>
            <Plus className="mr-2 h-4 w-4" />Add item
          </Button>
        </div>
        {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
      </div>
    )
  }
  return (
    <div className="space-y-1.5">{header}
      {field.type === 'textarea'
        ? <Textarea rows={3} value={strVal} onChange={(e) => onChange(e.target.value)} />
        : <Input value={strVal} onChange={(e) => onChange(e.target.value)} />}
      {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
    </div>
  )
}

// Inline (non-dialog) content editor for one page's schema. Saves only fields that
// differ from their default into website_pages.overrides; publish toggle controls
// whether the overrides are live.
export function PageContentEditor({ slug }: { slug: string }) {
  const schema = getPageSchema(slug)
  const pages = useWebsitePages()
  const save = useSaveWebsitePage()
  const row = pages.data?.find((r) => r.slug === slug) ?? null

  const [values, setValues] = React.useState<Values>({})
  const [published, setPublished] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)
  const seeded = React.useRef(false)

  React.useEffect(() => { seeded.current = false }, [slug])
  React.useEffect(() => {
    if (!schema || pages.isLoading || seeded.current) return
    const v: Values = {}
    for (const f of schema.fields) {
      const ov = getPath(row?.overrides ?? {}, f.path)
      v[f.path] = (ov as string | string[] | undefined) ?? f.default
    }
    setValues(v)
    setPublished(row?.published ?? false)
    setDirty(false)
    seeded.current = true
  }, [schema, pages.isLoading, row])

  if (!schema) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-6 text-sm text-muted-foreground">
        Editable content for this page is coming soon.
      </div>
    )
  }

  const setField = (path: string, val: string | string[]) => { setValues((s) => ({ ...s, [path]: val })); setDirty(true) }
  const resetField = (f: PageField) => { setValues((s) => ({ ...s, [f.path]: f.default })); setDirty(true) }
  const modified = (f: PageField) => !eq(values[f.path] ?? f.default, f.default)
  const changedCount = schema.fields.filter(modified).length

  function resetPage() {
    const v: Values = {}
    for (const f of schema!.fields) v[f.path] = f.default
    setValues(v); setDirty(true)
  }

  async function submit() {
    let overrides: Record<string, unknown> = {}
    for (const f of schema!.fields) {
      const val = values[f.path] ?? f.default
      if (!eq(val, f.default)) overrides = setPath(overrides, f.path, val)
    }
    try {
      await save.mutateAsync({ slug, title: schema!.title, route: schema!.route, overrides, published })
      setDirty(false)
      seeded.current = false // reseed from fresh row
      toast({
        title: 'Page content saved',
        description: Object.keys(overrides).length
          ? (published ? 'Live within about a minute.' : 'Saved as draft — publish to go live.')
          : 'Reset to the website defaults.',
      })
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-oswald text-base font-semibold text-slate-900 dark:text-white">Page content</h3>
            <p className="text-xs text-muted-foreground">
              {changedCount ? <><strong className="text-foreground">{changedCount}</strong> field{changedCount === 1 ? '' : 's'} changed from default</> : 'All fields using website defaults'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {changedCount > 0 && (
            <button type="button" onClick={resetPage} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3 w-3" />Reset all
            </button>
          )}
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={published} onCheckedChange={(v) => { setPublished(v); setDirty(true) }} />
            <span className="text-sm font-medium">{published ? 'Published' : 'Draft'}</span>
          </label>
          <Button size="sm" onClick={submit} disabled={save.isPending || !dirty}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {published ? 'Save & publish' : 'Save draft'}
          </Button>
        </div>
      </div>

      <div className="space-y-6 p-4 md:p-6">
        {schemaSections(schema).map((section) => (
          <div key={section} className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{section}</p>
            <div className={cn('space-y-4')}>
              {schema.fields.filter((f) => f.section === section).map((f) => (
                <FieldControl key={f.path} field={f} value={values[f.path] ?? f.default}
                  modified={modified(f)} onChange={(v) => setField(f.path, v)} onReset={() => resetField(f)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
