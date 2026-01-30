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
import { MoreHorizontal, Eye, Send, CheckCircle, Trash2, Receipt } from 'lucide-react'
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
}

const statusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Sent', className: 'bg-blue-100 text-blue-700' },
  viewed: { label: 'Viewed', className: 'bg-purple-100 text-purple-700' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-700' },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500 line-through' },
}

const typeLabels: Record<InvoiceType, string> = {
  deposit: 'Deposit',
  installment: 'Instalment',
  full_payment: 'Full Payment',
  meal_plan: 'Meal Plan',
  trip: 'Trip',
  other: 'Other',
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
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"><Checkbox disabled /></TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Programme</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Paid</TableHead>
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
      <div className="border rounded-lg p-12 text-center">
        <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No invoices yet</h3>
        <p className="text-muted-foreground">
          Create your first invoice to start tracking payments.
        </p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={someSelected ? 'indeterminate' : allSelected}
                onCheckedChange={(checked) => handleSelectAll(checked === true)}
              />
            </TableHead>
            <TableHead>Invoice #</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Programme</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
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
                      <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
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
  )
}
