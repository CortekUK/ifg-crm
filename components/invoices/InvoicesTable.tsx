'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useState, useMemo } from 'react'
import { MoreHorizontal, Eye, Send, CheckCircle, Trash2, Receipt, FileDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { generateInvoicePDF } from '@/lib/utils/generateInvoicePDF'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Invoice, InvoiceStatus, InvoiceType } from '@/lib/types/invoices'

interface InvoicesTableProps {
  invoices: Invoice[]
  isLoading: boolean
  selectedIds: string[]
  onSelectChange: (ids: string[]) => void
  onView: (invoice: Invoice) => void
  onSend: (invoice: Invoice) => void
  onMarkPaid: (invoice: Invoice) => void
  onDelete: (invoice: Invoice) => void
  onBulkSend?: (ids: string[]) => void
  onBulkMarkPaid?: (ids: string[]) => void
  onBulkDelete?: (ids: string[]) => void
}

const statusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
  sent: { label: 'Sent', className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  viewed: { label: 'Viewed', className: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' },
  paid: { label: 'Paid', className: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
  overdue: { label: 'Overdue', className: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 line-through' },
}

const typeLabels: Record<InvoiceType, string> = {
  deposit: 'Deposit',
  installment: 'Instalment',
  full_payment: 'Full Payment',
  meal_plan: 'Meal Plan',
  trip: 'Trip',
  other: 'Other',
}

type InvoiceSortField = 'invoice_number' | 'amount' | 'status' | 'due_date' | 'sent_at' | 'paid_at'
type SortDir = 'asc' | 'desc'

function InvoiceSortIcon({ field, activeField, dir }: { field: InvoiceSortField; activeField: InvoiceSortField; dir: SortDir }) {
  if (field !== activeField) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
  return dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
}

export function InvoicesTable({
  invoices,
  isLoading,
  selectedIds,
  onSelectChange,
  onView,
  onSend,
  onMarkPaid,
  onDelete,
  onBulkSend,
  onBulkMarkPaid,
  onBulkDelete,
}: InvoicesTableProps) {
  const getInitials = (contact?: Invoice['contact']) => {
    if (!contact) return '??'
    const first = contact.first_name?.[0] || ''
    const last = contact.last_name?.[0] || ''
    return (first + last).toUpperCase()
  }

  const isOverdue = (invoice: Invoice) => {
    if (invoice.status === 'paid' || invoice.status === 'cancelled') return false
    return new Date(invoice.due_date) < new Date()
  }

  const [sortField, setSortField] = useState<InvoiceSortField>('due_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = (field: InvoiceSortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'invoice_number' ? 'asc' : 'desc')
    }
  }

  const sortedInvoices = useMemo(() => {
    const sorted = [...invoices]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'invoice_number':
          cmp = (a.invoice_number || '').localeCompare(b.invoice_number || '')
          break
        case 'amount':
          cmp = a.amount - b.amount
          break
        case 'status': {
          const statusOrder: Record<string, number> = { draft: 0, sent: 1, viewed: 2, overdue: 3, paid: 4, cancelled: 5 }
          cmp = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0)
          break
        }
        case 'due_date':
          cmp = new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
          break
        case 'sent_at':
          cmp = (a.sent_at ? new Date(a.sent_at).getTime() : 0) - (b.sent_at ? new Date(b.sent_at).getTime() : 0)
          break
        case 'paid_at':
          cmp = (a.paid_at ? new Date(a.paid_at).getTime() : 0) - (b.paid_at ? new Date(b.paid_at).getTime() : 0)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [invoices, sortField, sortDir])

  const allSelected = invoices.length > 0 && selectedIds.length === invoices.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < invoices.length

  const handleSelectAll = (checked: boolean) => {
    onSelectChange(checked ? invoices.map((inv) => inv.id) : [])
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    onSelectChange(
      checked
        ? [...selectedIds, id]
        : selectedIds.filter((selectedId) => selectedId !== id)
    )
  }

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"><Checkbox disabled /></TableHead>
              <TableHead className="w-[100px]">Invoice #</TableHead>
              <TableHead className="min-w-[140px]">Contact</TableHead>
              <TableHead className="w-[120px]">Programme</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[100px] text-right">Amount</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[100px]">Due Date</TableHead>
              <TableHead className="w-[100px]">Sent</TableHead>
              <TableHead className="w-[100px]">Paid</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Checkbox disabled /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-8 w-36" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center bg-white dark:bg-slate-900 dark:border-slate-700">
        <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No invoices yet</h3>
        <p className="text-muted-foreground">
          Create your first invoice to start tracking payments.
        </p>
      </div>
    )
  }

  // Get selected invoices for bulk actions
  const selectedInvoices = invoices.filter((inv) => selectedIds.includes(inv.id))
  const canBulkSend = selectedInvoices.some((inv) => inv.status === 'draft')
  const canBulkMarkPaid = selectedInvoices.some(
    (inv) => inv.status !== 'paid' && inv.status !== 'cancelled'
  )

  return (
    <div className="space-y-2">
      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
            {selectedIds.length} invoice{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            {canBulkSend && onBulkSend && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onBulkSend(selectedIds)}
                className="h-8"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Send Selected
              </Button>
            )}
            {canBulkMarkPaid && onBulkMarkPaid && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onBulkMarkPaid(selectedIds)}
                className="h-8"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                Mark Paid
              </Button>
            )}
            {onBulkDelete && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onBulkDelete(selectedIds)}
                className="h-8 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSelectChange([])}
            className="h-8 ml-auto"
          >
            Clear Selection
          </Button>
        </div>
      )}

      <div className="border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={someSelected ? 'indeterminate' : allSelected}
                onCheckedChange={(checked) => handleSelectAll(checked === true)}
              />
            </TableHead>
            <TableHead className="w-[100px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('invoice_number')}>
              <div className="flex items-center gap-1">
                Invoice # <InvoiceSortIcon field="invoice_number" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="min-w-[140px]">Contact</TableHead>
            <TableHead className="w-[120px]">Programme</TableHead>
            <TableHead className="w-[100px]">Type</TableHead>
            <TableHead className="w-[100px] text-right cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('amount')}>
              <div className="flex items-center justify-end gap-1">
                Amount <InvoiceSortIcon field="amount" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-[90px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('status')}>
              <div className="flex items-center gap-1">
                Status <InvoiceSortIcon field="status" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-[100px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('due_date')}>
              <div className="flex items-center gap-1">
                Due Date <InvoiceSortIcon field="due_date" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-[100px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('sent_at')}>
              <div className="flex items-center gap-1">
                Sent <InvoiceSortIcon field="sent_at" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-[100px] cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('paid_at')}>
              <div className="flex items-center gap-1">
                Paid <InvoiceSortIcon field="paid_at" activeField={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedInvoices.map((invoice) => {
            const status = statusConfig[invoice.status]
            const overdue = isOverdue(invoice)

            return (
              <TableRow
                key={invoice.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onView(invoice)}
              >
                {/* Checkbox */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(invoice.id)}
                    onCheckedChange={(checked) =>
                      handleSelectOne(invoice.id, checked as boolean)
                    }
                  />
                </TableCell>

                {/* Invoice Number */}
                <TableCell className="font-medium text-blue-600">
                  {invoice.invoice_number}
                </TableCell>

                {/* Contact */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs">
                        {getInitials(invoice.contact)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {invoice.contact
                        ? `${invoice.contact.first_name} ${invoice.contact.last_name}`
                        : 'Unknown'}
                    </span>
                  </div>
                </TableCell>

                {/* Programme */}
                <TableCell>
                  {invoice.deal?.pipeline ? (
                    <Badge variant="outline">{invoice.deal.pipeline.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Type */}
                <TableCell className="text-sm">
                  {typeLabels[invoice.type]}
                </TableCell>

                {/* Amount */}
                <TableCell className="text-right font-medium">
                  {formatCurrency(invoice.amount)}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge className={status.className}>{status.label}</Badge>
                </TableCell>

                {/* Due Date */}
                <TableCell
                  className={cn(
                    'text-sm',
                    overdue && invoice.status !== 'overdue' && 'text-red-600 font-medium'
                  )}
                >
                  {formatDate(invoice.due_date)}
                </TableCell>

                {/* Sent Date */}
                <TableCell className="text-sm text-muted-foreground">
                  {invoice.sent_at ? formatDate(invoice.sent_at) : '—'}
                </TableCell>

                {/* Paid Date */}
                <TableCell className="text-sm text-muted-foreground">
                  {invoice.paid_at ? formatDate(invoice.paid_at) : '—'}
                </TableCell>

                {/* Actions */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(invoice)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generateInvoicePDF(invoice)}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Download PDF
                      </DropdownMenuItem>
                      {invoice.status === 'draft' && (
                        <DropdownMenuItem onClick={() => onSend(invoice)}>
                          <Send className="h-4 w-4 mr-2" />
                          Send
                        </DropdownMenuItem>
                      )}
                      {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                        <DropdownMenuItem onClick={() => onMarkPaid(invoice)}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark Paid
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(invoice)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
