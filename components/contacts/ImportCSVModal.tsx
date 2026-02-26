'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Upload, FileText, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, Loader2, Plus } from 'lucide-react'
import { parseCSV, autoMapColumns, validateRow, hasNameMapping, CONTACT_FIELDS, type RowValidationError } from '@/lib/utils/csv'
import { useImportContacts, type DuplicateStrategy, type ImportResult } from '@/lib/hooks/useImportContacts'
import { Input } from '@/components/ui/input'
import { useLists, useCreateList } from '@/lib/hooks/useLists'
import { useTags } from '@/lib/hooks/useContacts'
import { toast } from '@/lib/hooks/use-toast'

interface ImportCSVModalProps {
  isOpen: boolean
  onClose: () => void
  requireList?: boolean
}

type Step = 1 | 2 | 3

export function ImportCSVModal({ isOpen, onClose, requireList = false }: ImportCSVModalProps) {
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<number, string>>({})
  const [skippedColumns, setSkippedColumns] = useState<Set<number>>(new Set())
  const [listId, setListId] = useState<string | null>(null)
  const [tagId, setTagId] = useState<string | null>(null)
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('update')
  const [validationErrors, setValidationErrors] = useState<RowValidationError[]>([])
  const [duplicateEmails, setDuplicateEmails] = useState<Set<string>>(new Set())
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [creatingList, setCreatingList] = useState(false)
  const [newListName, setNewListName] = useState('')

  const { data: lists = [] } = useLists()
  const { data: tags = [] } = useTags()
  const createListMutation = useCreateList()
  const importMutation = useImportContacts()

  const reset = useCallback(() => {
    setStep(1)
    setFile(null)
    setHeaders([])
    setRows([])
    setMapping({})
    setSkippedColumns(new Set())
    setListId(null)
    setTagId(null)
    setCreatingList(false)
    setNewListName('')
    setDuplicateStrategy('update')
    setValidationErrors([])
    setDuplicateEmails(new Set())
    setCheckingDuplicates(false)
    setImportResult(null)
    setImportProgress(null)
    importMutation.reset()
  }, [importMutation])

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    setFile(f)
    const text = await f.text()
    const parsed = parseCSV(text)

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast({ title: 'Invalid CSV', description: 'The file appears to be empty or invalid.', variant: 'destructive' })
      return
    }

    setHeaders(parsed.headers)
    setRows(parsed.rows)
    setMapping(autoMapColumns(parsed.headers))
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f || !f.name.endsWith('.csv')) {
      toast({ title: 'Invalid file', description: 'Please drop a .csv file.', variant: 'destructive' })
      return
    }

    setFile(f)
    const text = await f.text()
    const parsed = parseCSV(text)

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast({ title: 'Invalid CSV', description: 'The file appears to be empty or invalid.', variant: 'destructive' })
      return
    }

    setHeaders(parsed.headers)
    setRows(parsed.rows)
    setMapping(autoMapColumns(parsed.headers))
  }

  const handleMappingChange = (colIndex: number, fieldKey: string) => {
    if (fieldKey === '__skip__') {
      // Explicitly skip — don't map and don't save as custom field
      setMapping((prev) => {
        const next = { ...prev }
        delete next[colIndex]
        return next
      })
      setSkippedColumns((prev) => new Set(prev).add(colIndex))
    } else if (fieldKey === '__custom__') {
      // Save as custom field — remove from mapping and skipped
      setMapping((prev) => {
        const next = { ...prev }
        delete next[colIndex]
        return next
      })
      setSkippedColumns((prev) => {
        const next = new Set(prev)
        next.delete(colIndex)
        return next
      })
    } else {
      // Map to a specific field
      setMapping((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(next)) {
          if (next[Number(key)] === fieldKey) {
            delete next[Number(key)]
          }
        }
        next[colIndex] = fieldKey
        return next
      })
      setSkippedColumns((prev) => {
        const next = new Set(prev)
        next.delete(colIndex)
        return next
      })
    }
  }

  const goToStep2 = () => {
    if (!file || rows.length === 0) return
    setStep(2)
  }

  const goToStep3 = async () => {
    const mappedFields = new Set(Object.values(mapping))

    // Email is always required
    if (!mappedFields.has('email')) {
      toast({
        title: 'Missing required field',
        description: 'Please map the Email column.',
        variant: 'destructive',
      })
      return
    }

    // Need either Full Name OR (First Name + Last Name)
    if (!hasNameMapping(mapping)) {
      toast({
        title: 'Missing name field',
        description: 'Please map either Full Name, or both First Name and Last Name.',
        variant: 'destructive',
      })
      return
    }

    // Validate rows
    const errors: RowValidationError[] = []
    rows.forEach((row, idx) => {
      const err = validateRow(row, mapping, idx + 1)
      if (err) errors.push(err)
    })
    setValidationErrors(errors)

    // Check for duplicate emails in the database
    setCheckingDuplicates(true)
    try {
      const emailColIndex = Object.entries(mapping).find(([, v]) => v === 'email')?.[0]
      if (emailColIndex !== undefined) {
        const emails = rows
          .map((row) => row[Number(emailColIndex)]?.trim().toLowerCase())
          .filter(Boolean)

        const uniqueEmails = [...new Set(emails)]
        const dupes = new Set<string>()

        // Check in batches of 100
        const supabase = (await import('@/lib/supabase/client')).createClient()
        for (let i = 0; i < uniqueEmails.length; i += 100) {
          const batch = uniqueEmails.slice(i, i + 100)
          const { data } = await supabase
            .from('contacts')
            .select('email')
            .in('email', batch)

          data?.forEach((c) => {
            if (c.email) dupes.add(c.email.toLowerCase())
          })
        }

        setDuplicateEmails(dupes)
      }
    } catch {
      // Non-blocking: if dedup check fails, proceed anyway
    } finally {
      setCheckingDuplicates(false)
    }

    setStep(3)
  }

  const validRows = rows.filter((_, idx) => !validationErrors.find((e) => e.row === idx + 1))

  const handleImport = async () => {
    try {
      setImportProgress({ processed: 0, total: validRows.length })
      const result = await importMutation.mutateAsync({
        rows: validRows,
        mapping,
        headers,
        skippedColumns: [...skippedColumns],
        listId,
        tagId,
        duplicateStrategy,
        onProgress: (processed, total) => {
          setImportProgress({ processed, total })
        },
      })
      setImportResult(result)
      toast({
        title: 'Import complete',
        description: `${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`,
      })
    } catch {
      toast({ title: 'Import failed', description: 'An unexpected error occurred.', variant: 'destructive' })
    }
  }

  const mappedFields = new Set(Object.values(mapping))

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
          <DialogDescription>
            {step === 1 && 'Upload a CSV file to import contacts.'}
            {step === 2 && 'Map CSV columns to contact fields.'}
            {step === 3 && (importResult ? 'Import complete.' : 'Review and import contacts.')}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 py-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : step > s
                      ? 'bg-green-100 text-green-700'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-green-300' : 'bg-muted'}`} />}
            </div>
          ))}
          <span className="ml-2 text-sm text-muted-foreground">
            {step === 1 && 'Upload'}
            {step === 2 && 'Map Columns'}
            {step === 3 && 'Review & Import'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-8 h-8 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {rows.length} rows found &middot; {headers.length} columns
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Click to select or drag & drop a CSV file</p>
                    <p className="text-xs text-muted-foreground mt-1">Supports .csv files</p>
                  </div>
                )}
              </div>

              {/* List selection */}
              <div className="space-y-2">
                <Label>Add to List{requireList ? ' *' : ' (optional)'}</Label>
                {creatingList ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="New list name..."
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newListName.trim()) {
                          e.preventDefault()
                          createListMutation.mutate(
                            { name: newListName.trim() },
                            {
                              onSuccess: (data) => {
                                setListId(data.id)
                                setCreatingList(false)
                                setNewListName('')
                                toast({ title: 'List created', description: `"${data.name}" is ready.` })
                              },
                            }
                          )
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      disabled={!newListName.trim() || createListMutation.isPending}
                      onClick={() => {
                        if (!newListName.trim()) return
                        createListMutation.mutate(
                          { name: newListName.trim() },
                          {
                            onSuccess: (data) => {
                              setListId(data.id)
                              setCreatingList(false)
                              setNewListName('')
                              toast({ title: 'List created', description: `"${data.name}" is ready.` })
                            },
                          }
                        )
                      }}
                    >
                      {createListMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setCreatingList(false); setNewListName('') }}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={listId || '__none__'} onValueChange={(v) => setListId(v === '__none__' ? null : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a list..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No list</SelectItem>
                        {lists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => setCreatingList(true)}>
                      <Plus className="w-4 h-4 mr-1" /> New
                    </Button>
                  </div>
                )}
              </div>

              {/* Tag selection */}
              <div className="space-y-2">
                <Label>Add to Tag (optional)</Label>
                <Select value={tagId || '__none__'} onValueChange={(v) => setTagId(v === '__none__' ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No tag</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duplicate strategy */}
              <div className="space-y-2">
                <Label>Duplicate Email Handling</Label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className={`flex-1 border rounded-lg p-3 text-left text-sm transition-colors ${
                      duplicateStrategy === 'skip' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                    }`}
                    onClick={() => setDuplicateStrategy('skip')}
                  >
                    <p className="font-medium">Skip duplicates</p>
                    <p className="text-xs text-muted-foreground mt-1">Existing contacts with the same email will be left unchanged</p>
                  </button>
                  <button
                    type="button"
                    className={`flex-1 border rounded-lg p-3 text-left text-sm transition-colors ${
                      duplicateStrategy === 'update' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                    }`}
                    onClick={() => setDuplicateStrategy('update')}
                  >
                    <p className="font-medium">Update duplicates</p>
                    <p className="text-xs text-muted-foreground mt-1">Existing contacts will be updated with the CSV data</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Map Columns */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Map each CSV column to a contact field. Unmapped columns are automatically saved as custom fields.
              </p>
              <div className="space-y-2">
                {/* Sort: mapped columns first, then unmapped */}
                {[...headers.map((header, index) => ({ header, index }))]
                  .sort((a, b) => {
                    const aMapped = mapping[a.index] ? 0 : 1
                    const bMapped = mapping[b.index] ? 0 : 1
                    return aMapped - bMapped
                  })
                  .map(({ header, index }) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-1/3 text-sm font-medium truncate" title={header}>
                      {header}
                    </div>
                    <div className="text-muted-foreground">→</div>
                    <div className="flex-1">
                      <Select
                        value={mapping[index] || (skippedColumns.has(index) ? '__skip__' : '__custom__')}
                        onValueChange={(v) => handleMappingChange(index, v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__custom__">
                            <span className="text-blue-600">Save as custom field</span>
                          </SelectItem>
                          <SelectItem value="__skip__">
                            <span className="text-muted-foreground">Skip this column</span>
                          </SelectItem>
                          {CONTACT_FIELDS.map((field) => (
                            <SelectItem
                              key={field.key}
                              value={field.key}
                              disabled={mappedFields.has(field.key) && mapping[index] !== field.key}
                            >
                              {field.label}{field.required ? ' *' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Unmapped columns info */}
              {(() => {
                const customCount = headers.filter((_, i) => !mapping[i] && !skippedColumns.has(i)).length
                const skipCount = skippedColumns.size
                return (customCount > 0 || skipCount > 0) ? (
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      {customCount > 0 && <>{customCount} column{customCount !== 1 ? 's' : ''} will be saved as custom fields.</>}
                      {customCount > 0 && skipCount > 0 && ' '}
                      {skipCount > 0 && <>{skipCount} column{skipCount !== 1 ? 's' : ''} will be skipped.</>}
                    </p>
                  </div>
                ) : null
              })()}

              {/* Preview first 3 rows */}
              {rows.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Preview (first 3 rows)</p>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          {headers.map((h, i) => (
                            <th key={i} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                              {mapping[i] ? CONTACT_FIELDS.find((f) => f.key === mapping[i])?.label || h : skippedColumns.has(i) ? <span className="text-muted-foreground line-through">{h}</span> : <span className="text-blue-600 italic">{h}</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-t">
                            {row.map((cell, j) => (
                              <td key={j} className={`px-2 py-1.5 whitespace-nowrap ${!mapping[j] ? (skippedColumns.has(j) ? 'text-muted-foreground/50 line-through' : 'text-blue-600/70') : ''}`}>
                                {cell || <span className="text-muted-foreground/50">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review & Import */}
          {step === 3 && (
            <div className="space-y-4">
              {importResult ? (
                /* Results */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-600">{importResult.created}</div>
                      <div className="text-sm text-muted-foreground">Created</div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-600">{importResult.updated}</div>
                      <div className="text-sm text-muted-foreground">Updated</div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-2xl font-bold text-yellow-600">{importResult.skipped}</div>
                      <div className="text-sm text-muted-foreground">Skipped</div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-2xl font-bold text-red-600">{importResult.errors.length}</div>
                      <div className="text-sm text-muted-foreground">Errors</div>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="border border-red-200 rounded-lg p-3 bg-red-50 max-h-40 overflow-y-auto">
                      <p className="text-sm font-medium text-red-800 mb-1">Errors:</p>
                      {importResult.errors.slice(0, 20).map((err, i) => (
                        <p key={i} className="text-xs text-red-700">Row {err.row}: {err.message}</p>
                      ))}
                      {importResult.errors.length > 20 && (
                        <p className="text-xs text-red-600 mt-1">...and {importResult.errors.length - 20} more</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Pre-import summary */
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="border rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold">{rows.length}</div>
                      <div className="text-xs text-muted-foreground">Total Rows</div>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600">{validRows.length}</div>
                      <div className="text-xs text-muted-foreground">Valid</div>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-red-600">{validationErrors.length}</div>
                      <div className="text-xs text-muted-foreground">Invalid</div>
                    </div>
                  </div>

                  {duplicateEmails.size > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          {duplicateEmails.size} duplicate email{duplicateEmails.size !== 1 ? 's' : ''} found
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                          {duplicateStrategy === 'skip'
                            ? 'These contacts will be skipped during import.'
                            : 'These contacts will be updated with the new data.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Strategy:</span> {duplicateStrategy === 'skip' ? 'Skip duplicates' : 'Update duplicates'}</p>
                    {listId && (
                      <p><span className="text-muted-foreground">List:</span> {lists.find((l) => l.id === listId)?.name}</p>
                    )}
                    {tagId && (
                      <p><span className="text-muted-foreground">Tag:</span> {tags.find((t) => t.id === tagId)?.name}</p>
                    )}
                    <p><span className="text-muted-foreground">Fields mapped:</span> {Object.keys(mapping).length} of {headers.length}</p>
                    {(() => {
                      const customCount = headers.filter((_, i) => !mapping[i] && !skippedColumns.has(i)).length
                      return customCount > 0 ? (
                        <p><span className="text-muted-foreground">Custom fields:</span> {customCount} column{customCount !== 1 ? 's' : ''} saved as custom fields</p>
                      ) : null
                    })()}
                  </div>

                  {validationErrors.length > 0 && (
                    <div className="border border-yellow-200 rounded-lg p-3 bg-yellow-50 max-h-32 overflow-y-auto">
                      <div className="flex items-center gap-1 mb-1">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <p className="text-sm font-medium text-yellow-800">Validation warnings (these rows will be skipped):</p>
                      </div>
                      {validationErrors.slice(0, 10).map((err, i) => (
                        <p key={i} className="text-xs text-yellow-700">Row {err.row}: {err.message}</p>
                      ))}
                      {validationErrors.length > 10 && (
                        <p className="text-xs text-yellow-600 mt-1">...and {validationErrors.length - 10} more</p>
                      )}
                    </div>
                  )}

                  {importMutation.isPending && importProgress && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Importing contacts...
                        </div>
                        <span className="font-medium tabular-nums">
                          {importProgress.processed.toLocaleString()} / {importProgress.total.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={(importProgress.processed / importProgress.total) * 100} className="h-2" />
                      {importProgress.processed > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {Math.round((importProgress.processed / importProgress.total) * 100)}% complete
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={goToStep2} disabled={!file || rows.length === 0 || (requireList && !listId)}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={checkingDuplicates}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={goToStep3} disabled={checkingDuplicates}>
                {checkingDuplicates ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Checking duplicates...</>
                ) : (
                  <>Next <ArrowRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            </>
          )}
          {step === 3 && !importResult && (
            <>
              <Button variant="outline" onClick={() => setStep(2)} disabled={importMutation.isPending}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={handleImport} disabled={importMutation.isPending || validRows.length === 0}>
                {importMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Importing...</>
                ) : (
                  <>Import {validRows.length} Contacts</>
                )}
              </Button>
            </>
          )}
          {step === 3 && importResult && (
            <Button onClick={handleClose}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
