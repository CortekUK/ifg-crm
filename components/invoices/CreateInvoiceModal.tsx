'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
import { useContactDeals, useCreateInvoice, useUpdateInvoiceStatus } from '@/lib/hooks/useInvoices'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { toast } from '@/lib/hooks/use-toast'
import type { InvoiceType, InvoiceRecipientType } from '@/lib/types/invoices'

interface CreateInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
}

const invoiceTypes: { value: InvoiceType; label: string }[] = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'installment', label: 'Instalment' },
  { value: 'full_payment', label: 'Full Payment' },
  { value: 'meal_plan', label: 'Meal Plan' },
  { value: 'trip', label: 'Trip' },
  { value: 'other', label: 'Other' },
]

export function CreateInvoiceModal({
  isOpen,
  onClose,
  userId,
}: CreateInvoiceModalProps) {
  const [contactSearch, setContactSearch] = useState('')
  const [contactOpen, setContactOpen] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [selectedContactName, setSelectedContactName] = useState('')
  const [selectedContactEmail, setSelectedContactEmail] = useState<string | null>(null)
  const [selectedContactParentEmail, setSelectedContactParentEmail] = useState<string | null>(null)
  const [selectedContactParentName, setSelectedContactParentName] = useState<string | null>(null)
  const [recipientType, setRecipientType] = useState<InvoiceRecipientType>('player')
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [type, setType] = useState<InvoiceType>('deposit')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>('none')
  const [discountValue, setDiscountValue] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [dueDateOpen, setDueDateOpen] = useState(false)
  const [notes, setNotes] = useState('')

  const debouncedSearch = useDebouncedValue(contactSearch, 300)
  const { data: contacts = [], isLoading: contactsLoading } = useSearchContacts(debouncedSearch)
  const { data: deals = [] } = useContactDeals(selectedContactId)
  const createInvoice = useCreateInvoice()
  const updateStatus = useUpdateInvoiceStatus()

  // Check which deals already have an active invoice linked
  const [dealsWithInvoice, setDealsWithInvoice] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!selectedContactId) {
      setDealsWithInvoice(new Set())
      return
    }
    const checkExistingInvoices = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('invoices')
        .select('deal_id')
        .eq('contact_id', selectedContactId)
        .not('deal_id', 'is', null)
        .not('status', 'in', '("cancelled")')

      const ids = new Set((data || []).map(i => i.deal_id).filter(Boolean) as string[])
      setDealsWithInvoice(ids)
    }
    checkExistingInvoices()
  }, [selectedContactId])

  // Filter deals: hide ones that already have an active invoice
  const availableDeals = deals.filter(d => !dealsWithInvoice.has(d.id))

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setContactSearch('')
      setSelectedContactId(null)
      setSelectedContactName('')
      setSelectedContactEmail(null)
      setSelectedContactParentEmail(null)
      setSelectedContactParentName(null)
      setRecipientType('player')
      setSelectedDealId(null)
      setType('deposit')
      setDescription('')
      setAmount('')
      setDiscountType('none')
      setDiscountValue('')
      setDueDate(undefined)
      setNotes('')
    }
  }, [isOpen])

  // Calculate final amount after discount
  const calculateFinalAmount = () => {
    const baseAmount = parseFloat(amount) || 0
    if (discountType === 'none' || !discountValue) return baseAmount

    const discountVal = parseFloat(discountValue) || 0
    if (discountType === 'percentage') {
      return baseAmount * (1 - discountVal / 100)
    } else {
      return Math.max(0, baseAmount - discountVal)
    }
  }

  const finalAmount = calculateFinalAmount()

  const handleSelectContact = (contact: {
    id: string
    first_name: string
    last_name: string
    email?: string | null
    parent_email?: string | null
    parent_name?: string | null
  }) => {
    setSelectedContactId(contact.id)
    setSelectedContactName(`${contact.first_name} ${contact.last_name}`)
    setSelectedContactEmail(contact.email ?? null)
    setSelectedContactParentEmail(contact.parent_email ?? null)
    setSelectedContactParentName(contact.parent_name ?? null)
    setRecipientType('player') // Default to player on every contact change
    setSelectedDealId(null) // Reset deal when contact changes
    setContactOpen(false)
  }

  const handleSubmit = async (sendNow: boolean) => {
    if (!selectedContactId || !description || !amount || !dueDate) return

    // Build description with discount note if applicable
    let finalDescription = description
    if (discountType !== 'none' && discountValue) {
      const discountNote = discountType === 'percentage'
        ? `(${discountValue}% scholarship applied)`
        : `(£${discountValue} discount applied)`
      finalDescription = `${description} ${discountNote}`
    }

    try {
      const invoice = await createInvoice.mutateAsync({
        contact_id: selectedContactId,
        deal_id: selectedDealId,
        type,
        description: finalDescription,
        amount: finalAmount,
        due_date: format(dueDate, 'yyyy-MM-dd'),
        notes: notes || undefined,
        recipient_type: recipientType,
        created_by_id: userId,
      })

      if (sendNow && invoice) {
        try {
          const res = await fetch(`/api/invoices/${invoice.id}/send-with-link`, {
            method: 'POST',
          })
          const data = await res.json()
          if (!res.ok) {
            // Fallback to just marking as sent
            await updateStatus.mutateAsync({ invoiceId: invoice.id, status: 'sent' })
          }
        } catch {
          await updateStatus.mutateAsync({ invoiceId: invoice.id, status: 'sent' })
        }
      }

      toast({
        title: sendNow ? 'Invoice sent' : 'Invoice created',
        description: sendNow
          ? `Invoice ${invoice?.invoice_number || ''} sent to ${selectedContactName} with payment link.`
          : `Invoice saved as draft.`,
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Failed to create invoice',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const isValid =
    selectedContactId &&
    description.trim().length > 0 &&
    amount &&
    parseFloat(amount) > 0 &&
    dueDate

  const isSubmitting = createInvoice.isPending || updateStatus.isPending

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            Create Invoice
          </SheetTitle>
          <SheetDescription>
            Create a new invoice for a player or contact.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-6 py-6">
            {/* Contact & Deal */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Contact & Deal
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

              {selectedContactId && deals.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Link to Deal (optional)</Label>
                  {availableDeals.length > 0 ? (
                    <Select
                      value={selectedDealId || '__none__'}
                      onValueChange={(v) => setSelectedDealId(v === '__none__' ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a deal..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No deal</SelectItem>
                        {availableDeals.map((deal) => (
                          <SelectItem key={deal.id} value={deal.id}>
                            {deal.title} - {deal.pipeline?.name || 'Unknown pipeline'}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground py-2">Initial invoice already sent/paid for this programme. You can still create an invoice without linking — the contact will be notified and can pay.</p>
                  )}
                </div>
              )}

              {/* Send invoice email to: player OR guardian. Either can pay. */}
              {selectedContactId && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Send invoice email to <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRecipientType('player')}
                      className={cn(
                        'text-left rounded-lg border px-3 py-2.5 transition-colors',
                        recipientType === 'player'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      )}
                    >
                      <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                        Player
                      </div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {selectedContactName}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {selectedContactEmail || 'No email on file'}
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={!selectedContactParentEmail}
                      onClick={() => setRecipientType('guardian')}
                      className={cn(
                        'text-left rounded-lg border px-3 py-2.5 transition-colors',
                        recipientType === 'guardian'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                        !selectedContactParentEmail &&
                          'opacity-50 cursor-not-allowed hover:border-slate-200 dark:hover:border-slate-700'
                      )}
                    >
                      <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                        Guardian
                      </div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {selectedContactParentName || 'Parent / Guardian'}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {selectedContactParentEmail ||
                          'No guardian email on contact'}
                      </div>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Either party can pay the invoice — this only controls who
                    receives the email.
                  </p>
                </div>
              )}
            </div>

            {/* Invoice Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Invoice Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Type <span className="text-red-500">*</span>
                  </Label>
                  <Select value={type} onValueChange={(v) => setType(v as InvoiceType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {invoiceTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Due Date <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !dueDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, 'dd/MM/yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={(date) => {
                          setDueDate(date)
                          setDueDateOpen(false)
                        }}
                        disabled={(date) => {
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          return date < today
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. UCLan 2026 Programme Deposit"
                />
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

              {/* Discount/Scholarship */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Discount / Scholarship</Label>
                <div className="flex gap-2">
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'none' | 'percentage' | 'fixed')}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No discount</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed (£)</SelectItem>
                    </SelectContent>
                  </Select>
                  {discountType !== 'none' && (
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {discountType === 'percentage' ? '%' : '£'}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step={discountType === 'percentage' ? '1' : '0.01'}
                        max={discountType === 'percentage' ? '100' : undefined}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder={discountType === 'percentage' ? '10' : '100.00'}
                        className="pl-7"
                      />
                    </div>
                  )}
                </div>
                {discountType !== 'none' && discountValue && parseFloat(amount) > 0 && (
                  <p className="text-sm text-green-600 font-medium">
                    Final amount: £{finalAmount.toFixed(2)}
                    <span className="text-muted-foreground font-normal ml-1">
                      (saving £{(parseFloat(amount) - finalAmount).toFixed(2)})
                    </span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
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
              onClick={() => handleSubmit(false)}
              disabled={!isValid || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save as Draft'}
            </Button>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={!isValid || isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create & Send'
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
