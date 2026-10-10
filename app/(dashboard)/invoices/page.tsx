'use client'

import { useState, useEffect } from 'react'
import { InvoicesPageHeader } from '@/components/invoices/InvoicesPageHeader'
import { InvoiceStats } from '@/components/invoices/InvoiceStats'
import { InvoiceFilters } from '@/components/invoices/InvoiceFilters'
import { AbandonedDeposits } from '@/components/invoices/AbandonedDeposits'
import { InvoicesTable } from '@/components/invoices/InvoicesTable'
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal'
import { CreatePaymentPlanModal } from '@/components/invoices/CreatePaymentPlanModal'
import { InvoiceDetailSheet } from '@/components/invoices/InvoiceDetailSheet'
import { RecordPaymentModal } from '@/components/payments/RecordPaymentModal'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useInvoices,
  useInvoiceStats,
  useUpdateInvoiceStatus,
  useDeleteInvoice,
  useBulkUpdateInvoiceStatus,
  useBulkDeleteInvoices,
} from '@/lib/hooks/useInvoices'
import { toast } from '@/lib/hooks/use-toast'
import { formatInvoiceAmount } from '@/lib/invoices/payment-link-email'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { createClient } from '@/lib/supabase/client'
import type { InvoiceFilters as InvoiceFiltersType, Invoice } from '@/lib/types/invoices'

export default function InvoicesPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [filters, setFilters] = useState<InvoiceFiltersType>({})
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [paymentPlanModalOpen, setPaymentPlanModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single'; invoice: Invoice } | { type: 'bulk'; ids: string[] } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null)
  // Mark Paid opens the Record Payment form instead of flipping the status.
  const [markPaidTarget, setMarkPaidTarget] = useState<Invoice | null>(null)
  const [bulkMarkPaidIds, setBulkMarkPaidIds] = useState<string[] | null>(null)

  // Debounce search
  const debouncedFilters = {
    ...filters,
    search: useDebouncedValue(filters.search || '', 300),
  }

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    fetchUser()
  }, [])

  // Fetch invoices and stats
  const { data: invoices = [], isLoading } = useInvoices(debouncedFilters)
  const { data: stats, isLoading: statsLoading } = useInvoiceStats()
  const updateStatus = useUpdateInvoiceStatus()
  const deleteInvoice = useDeleteInvoice()
  const bulkUpdateStatus = useBulkUpdateInvoiceStatus()
  const bulkDeleteInvoices = useBulkDeleteInvoices()

  const handleView = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
  }

  const handleSend = async (invoice: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send-with-link`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        // Fallback to just marking as sent
        await updateStatus.mutateAsync({ invoiceId: invoice.id, status: 'sent' })
        toast({
          title: 'Invoice marked as sent',
          description: data.error || 'Email could not be sent.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Invoice sent',
          description: data.message || 'Invoice sent with payment link.',
        })
      }
    } catch (error) {
      console.error('Failed to send invoice:', error)
      toast({
        title: 'Error',
        description: 'Failed to send invoice.',
        variant: 'destructive',
      })
    }
  }

  // Mark Paid asks how they paid, rather than guessing.
  //
  // It used to flip the invoice to paid in one click: no confirmation, no
  // method, and — until the payments row was added — no record of the money at
  // all. Even with the row, the method was always "Other", because nothing ever
  // asked. QA flagged both: one click on a real invoice is easy to do by
  // accident, and "Other" is not a usable answer for the finance figures.
  //
  // RecordPaymentModal already does exactly this job from the invoice sheet —
  // amount pre-filled from the invoice, method required — so Mark Paid now
  // opens it rather than duplicating a form.
  const handleMarkPaid = (invoice: Invoice) => {
    setMarkPaidTarget(invoice)
  }

  const handleDelete = (invoice: Invoice) => {
    setDeleteTarget({ type: 'single', invoice })
  }

  // Cancelling is destructive — the payment link dies and the player is emailed
  // — so it confirms first, the same as delete.
  const handleCancel = (invoice: Invoice) => {
    setCancelTarget(invoice)
  }

  const confirmCancel = async () => {
    if (!cancelTarget) return
    try {
      await updateStatus.mutateAsync({ invoiceId: cancelTarget.id, status: 'cancelled' })
      toast({
        title: 'Invoice cancelled',
        description: `Invoice ${cancelTarget.invoice_number} can no longer be paid.`,
      })
    } catch (error) {
      toast({
        title: 'Failed to cancel',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setCancelTarget(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      if (deleteTarget.type === 'single') {
        await deleteInvoice.mutateAsync(deleteTarget.invoice.id)
        toast({
          title: 'Invoice deleted',
          description: `Invoice ${deleteTarget.invoice.invoice_number} has been deleted.`,
        })
      } else {
        await bulkDeleteInvoices.mutateAsync(deleteTarget.ids)
        setSelectedIds([])
        toast({
          title: 'Invoices deleted',
          description: `${deleteTarget.ids.length} invoice(s) deleted successfully.`,
        })
      }
    } catch (error) {
      toast({
        title: 'Failed to delete',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleBulkSend = async (ids: string[]) => {
    // Filter to only draft invoices
    const draftIds = invoices
      .filter((inv) => ids.includes(inv.id) && inv.status === 'draft')
      .map((inv) => inv.id)

    if (draftIds.length === 0) {
      toast({
        title: 'No draft invoices selected',
        description: 'Only draft invoices can be sent.',
        variant: 'destructive',
      })
      return
    }

    try {
      await bulkUpdateStatus.mutateAsync({ invoiceIds: draftIds, status: 'sent' })
      setSelectedIds([])
      toast({
        title: 'Invoices sent',
        description: `${draftIds.length} invoice(s) sent successfully.`,
      })
    } catch (error) {
      toast({
        title: 'Failed to send invoices',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleBulkMarkPaid = async (ids: string[]) => {
    // Filter to only unpaid/uncancelled invoices
    const unpaidIds = invoices
      .filter((inv) => ids.includes(inv.id) && inv.status !== 'paid' && inv.status !== 'cancelled')
      .map((inv) => inv.id)

    if (unpaidIds.length === 0) {
      toast({
        title: 'No unpaid invoices selected',
        description: 'Only unpaid invoices can be marked as paid.',
        variant: 'destructive',
      })
      return
    }

    // Asking the method for each of a hundred invoices is not workable, so the
    // bulk action keeps recording them as a manual payment — but it confirms
    // first, because marking real invoices paid in bulk is not undoable.
    setBulkMarkPaidIds(unpaidIds)
  }

  const confirmBulkMarkPaid = async () => {
    const unpaidIds = bulkMarkPaidIds
    if (!unpaidIds) return
    setBulkMarkPaidIds(null)
    try {
      await bulkUpdateStatus.mutateAsync({ invoiceIds: unpaidIds, status: 'paid' })
      setSelectedIds([])
      toast({
        title: 'Invoices marked as paid',
        description: `${unpaidIds.length} invoice(s) marked as paid.`,
      })
    } catch (error) {
      toast({
        title: 'Failed to update invoices',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const handleBulkDelete = (ids: string[]) => {
    setDeleteTarget({ type: 'bulk', ids })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <InvoicesPageHeader
        onCreateClick={() => setCreateModalOpen(true)}
        onCreatePaymentPlan={() => setPaymentPlanModalOpen(true)}
      />

      {/* Stats */}
      <InvoiceStats
        totalOutstanding={stats?.totalOutstanding || 0}
        paidThisMonth={stats?.paidThisMonth || 0}
        overdueCount={stats?.overdueCount || 0}
        avgPaymentDays={stats?.avgPaymentDays ?? null}
        isLoading={statsLoading}
      />

      {/* Abandoned website checkouts — warm leads who reached payment but didn't pay */}
      <AbandonedDeposits onView={handleView} />

      {/* Filters */}
      <InvoiceFilters filters={filters} onFiltersChange={setFilters} />

      {/* Table */}
      <InvoicesTable
        invoices={invoices}
        isLoading={isLoading}
        selectedIds={selectedIds}
        onSelectChange={setSelectedIds}
        onView={handleView}
        onSend={handleSend}
        onMarkPaid={handleMarkPaid}
        onCancel={handleCancel}
        onDelete={handleDelete}
        onBulkSend={handleBulkSend}
        onBulkMarkPaid={handleBulkMarkPaid}
        onBulkDelete={handleBulkDelete}
      />

      {/* Create Invoice Modal */}
      {userId && (
        <CreateInvoiceModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          userId={userId}
        />
      )}

      {/* Create Payment Plan Modal */}
      {userId && (
        <CreatePaymentPlanModal
          isOpen={paymentPlanModalOpen}
          onClose={() => setPaymentPlanModalOpen(false)}
          userId={userId}
        />
      )}

      {/* Invoice Detail Sheet */}
      <InvoiceDetailSheet
        invoiceId={selectedInvoice?.id || null}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />

      {/* Mark Paid — the Record Payment form, so the method is recorded */}
      {markPaidTarget && (
        <RecordPaymentModal
          isOpen={!!markPaidTarget}
          onClose={() => setMarkPaidTarget(null)}
          userId={userId ?? undefined}
          preselectedContactId={markPaidTarget.contact_id}
          preselectedInvoiceId={markPaidTarget.id}
        />
      )}

      {/* Bulk Mark Paid confirmation */}
      <AlertDialog
        open={!!bulkMarkPaidIds}
        onOpenChange={(open) => !open && setBulkMarkPaidIds(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark {bulkMarkPaidIds?.length ?? 0} invoice
              {(bulkMarkPaidIds?.length ?? 0) === 1 ? '' : 's'} as paid?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Each one is recorded as a manual payment, their deals move to the paid
                stage, and any payment reminders stop.
              </span>
              <span className="block">
                The method is recorded as &quot;Other&quot; because a bulk action cannot ask
                how each player paid. To record the method, use Mark Paid on a single
                invoice instead.
              </span>
              <span className="block font-medium text-amber-700 dark:text-amber-500">
                This cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkUpdateStatus.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmBulkMarkPaid()
              }}
              disabled={bulkUpdateStatus.isPending}
            >
              {bulkUpdateStatus.isPending ? 'Marking\u2026' : 'Mark them paid'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this invoice?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {cancelTarget && (
                <span className="block">
                  <strong>{cancelTarget.invoice_number}</strong>
                  <span className="text-muted-foreground">
                    {' '}&mdash; {formatInvoiceAmount(cancelTarget.amount, cancelTarget.currency)}
                    {cancelTarget.contact
                      ? ` for ${cancelTarget.contact.first_name} ${cancelTarget.contact.last_name}`
                      : ''}
                  </span>
                </span>
              )}
              <span className="block">
                The payment link stops working and the player is emailed to say it has
                been cancelled. It is also taken out of revenue and outstanding totals.
              </span>
              <span className="block font-medium text-red-600">This cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStatus.isPending}>
              Keep the invoice
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmCancel()
              }}
              disabled={updateStatus.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {updateStatus.isPending ? 'Cancelling\u2026' : 'Cancel the invoice'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === 'single'
                ? `Delete invoice ${deleteTarget.invoice.invoice_number}?`
                : `Delete ${deleteTarget?.ids.length} invoice(s)?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The {deleteTarget?.type === 'single' ? 'invoice' : 'invoices'} will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
