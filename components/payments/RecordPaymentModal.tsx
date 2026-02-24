'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useSearchContacts } from '@/lib/hooks/useSearchContacts'
import { useCreatePayment } from '@/lib/hooks/usePayments'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { toast } from '@/lib/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import type { PaymentMethod } from '@/lib/types/payments'

interface RecordPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'website', label: 'Website Payment' },
  { value: 'other', label: 'Other' },
]

interface Invoice {
  id: string
  invoice_number: string
  amount: number
  description: string
  status: string
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  userId,
}: RecordPaymentModalProps) {
  const [contactSearch, setContactSearch] = useState('')
  const [contactOpen, setContactOpen] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [selectedContactName, setSelectedContactName] = useState('')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date())
  const [paymentDateOpen, setPaymentDateOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  const debouncedSearch = useDebouncedValue(contactSearch, 300)
  const { data: contacts = [], isLoading: contactsLoading } = useSearchContacts(debouncedSearch)
  const createPayment = useCreatePayment()

  // Load unpaid invoices for selected contact
  useEffect(() => {
    if (!selectedContactId) {
      setInvoices([])
      return
    }

    const loadInvoices = async () => {
      setLoadingInvoices(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount, description, status')
        .eq('contact_id', selectedContactId)
        .in('status', ['sent', 'overdue', 'viewed'])
        .order('created_at', { ascending: false })

      if (!error && data) {
        setInvoices(data)
      }
      setLoadingInvoices(false)
    }

    loadInvoices()
  }, [selectedContactId])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setContactSearch('')
      setSelectedContactId(null)
      setSelectedContactName('')
      setSelectedInvoiceId(null)
      setPaymentMethod('bank_transfer')
      setAmount('')
      setReference('')
      setPaymentDate(new Date())
      setNotes('')
      setInvoices([])
    }
  }, [isOpen])

  // Auto-fill amount when invoice is selected
  useEffect(() => {
    if (selectedInvoiceId) {
      const invoice = invoices.find((i) => i.id === selectedInvoiceId)
      if (invoice) {
        setAmount(invoice.amount.toString())
      }
    }
  }, [selectedInvoiceId, invoices])

  const handleSelectContact = (contact: { id: string; first_name: string; last_name: string }) => {
    setSelectedContactId(contact.id)
    setSelectedContactName(`${contact.first_name} ${contact.last_name}`)
    setSelectedInvoiceId(null) // Reset invoice when contact changes
    setContactOpen(false)
  }

  const handleSubmit = async () => {
    if (!selectedContactId || !amount || !paymentDate || parseFloat(amount) <= 0) return

    try {
      await createPayment.mutateAsync({
        contact_id: selectedContactId,
        invoice_id: selectedInvoiceId,
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        reference: reference || undefined,
        notes: notes || undefined,
        recorded_by_id: userId,
        payment_date: format(paymentDate, 'yyyy-MM-dd'),
      })

      toast({
        title: 'Payment recorded',
        description: `Payment of £${parseFloat(amount).toFixed(2)} recorded for ${selectedContactName}.`,
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Failed to record payment',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const isValid =
    selectedContactId &&
    amount &&
    parseFloat(amount) > 0 &&
    paymentDate

  const isSubmitting = createPayment.isPending

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            Record Payment
          </SheetTitle>
          <SheetDescription>
            Record a manual payment for a contact or invoice.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-6 py-6">
            {/* Contact Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Contact & Invoice
              </h3>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Contact <span className="text-red-500">*</span>
                </Label>
                <Popover open={contactOpen} onOpenChange={setContactOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={contactOpen}
                      className="w-full justify-between"
                    >
                      {selectedContactName || 'Search contacts...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search contacts..."
                        value={contactSearch}
                        onValueChange={setContactSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {contactsLoading ? 'Searching...' : 'No contacts found.'}
                        </CommandEmpty>
                        <CommandGroup>
                          {contacts.map((contact) => (
                            <CommandItem
                              key={contact.id}
                              onSelect={() => handleSelectContact(contact)}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedContactId === contact.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              <div>
                                <p className="font-medium">
                                  {contact.first_name} {contact.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {contact.email}
                                </p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedContactId && invoices.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Link to Invoice (optional)</Label>
                  <Select
                    value={selectedInvoiceId || '__none__'}
                    onValueChange={(v) => setSelectedInvoiceId(v === '__none__' ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an invoice..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No invoice</SelectItem>
                      {invoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - £{invoice.amount.toFixed(2)} ({invoice.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loadingInvoices && (
                    <p className="text-xs text-muted-foreground">Loading invoices...</p>
                  )}
                </div>
              )}
            </div>

            {/* Payment Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Payment Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Payment Method <span className="text-red-500">*</span>
                  </Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Payment Date <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={paymentDateOpen} onOpenChange={setPaymentDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !paymentDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {paymentDate ? format(paymentDate, 'dd/MM/yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={paymentDate}
                        onSelect={(date) => {
                          setPaymentDate(date)
                          setPaymentDateOpen(false)
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Amount (£) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    £
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Reference Number</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Bank transfer reference, cheque number..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes about this payment..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 bg-slate-50 dark:bg-slate-800 shrink-0">
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Payment'
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
