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
import { ScrollArea } from '@/components/ui/scroll-area'
import { CalendarIcon, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useSearchContacts } from '@/lib/hooks/useSearchContacts'
import { useContactDeals, useCreateInvoice, useUpdateInvoiceStatus } from '@/lib/hooks/useInvoices'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { toast } from '@/lib/hooks/use-toast'
import type { InvoiceType } from '@/lib/types/invoices'

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
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [type, setType] = useState<InvoiceType>('deposit')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [dueDateOpen, setDueDateOpen] = useState(false)
  const [notes, setNotes] = useState('')

  const debouncedSearch = useDebouncedValue(contactSearch, 300)
  const { data: contacts = [], isLoading: contactsLoading } = useSearchContacts(debouncedSearch)
  const { data: deals = [] } = useContactDeals(selectedContactId)
  const createInvoice = useCreateInvoice()
  const updateStatus = useUpdateInvoiceStatus()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setContactSearch('')
      setSelectedContactId(null)
      setSelectedContactName('')
      setSelectedDealId(null)
      setType('deposit')
      setDescription('')
      setAmount('')
      setDueDate(undefined)
      setNotes('')
    }
  }, [isOpen])

  const handleSelectContact = (contact: { id: string; first_name: string; last_name: string }) => {
    setSelectedContactId(contact.id)
    setSelectedContactName(`${contact.first_name} ${contact.last_name}`)
    setSelectedDealId(null) // Reset deal when contact changes
    setContactOpen(false)
  }

  const handleSubmit = async (sendNow: boolean) => {
    if (!selectedContactId || !description || !amount || !dueDate) return

    try {
      const invoice = await createInvoice.mutateAsync({
        contact_id: selectedContactId,
        deal_id: selectedDealId,
        type,
        description,
        amount: parseFloat(amount),
        due_date: format(dueDate, 'yyyy-MM-dd'),
        notes: notes || undefined,
        created_by_id: userId,
      })

      if (sendNow && invoice) {
        await updateStatus.mutateAsync({
          invoiceId: invoice.id,
          status: 'sent',
        })
      }

      toast({
        title: sendNow ? 'Invoice sent' : 'Invoice created',
        description: sendNow
          ? `Invoice ${invoice?.invoice_number || ''} sent to ${selectedContactName}.`
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
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900">
            Create Invoice
          </SheetTitle>
          <SheetDescription>
            Create a new invoice for a player or contact.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-6">
            {/* Contact & Deal */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Contact & Deal
              </h3>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
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
                  <Label className="text-sm font-medium text-slate-700">Link to Deal (optional)</Label>
                  <Select
                    value={selectedDealId || '__none__'}
                    onValueChange={(v) => setSelectedDealId(v === '__none__' ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a deal..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No deal</SelectItem>
                      {deals.map((deal) => (
                        <SelectItem key={deal.id} value={deal.id}>
                          {deal.title} - {deal.pipeline?.name || 'Unknown pipeline'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Invoice Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Invoice Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
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
                  <Label className="text-sm font-medium text-slate-700">
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
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. UCLan 2026 Programme Deposit"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
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
                <Label className="text-sm font-medium text-slate-700">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="border-t px-6 py-4 bg-slate-50">
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
