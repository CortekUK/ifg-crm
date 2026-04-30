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
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarIcon, Check, ChevronsUpDown, Loader2, ReceiptPoundSterling } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, addMonths } from 'date-fns'
import { useSearchContacts } from '@/lib/hooks/useSearchContacts'
import { useContactDeals, useCreateInvoice } from '@/lib/hooks/useInvoices'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { toast } from '@/lib/hooks/use-toast'

interface CreatePaymentPlanModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
}

interface PaymentPlanTemplate {
  id: string
  name: string
  months: number
  description: string
}

const paymentPlanTemplates: PaymentPlanTemplate[] = [
  {
    id: '3-month',
    name: '3 Month Plan',
    months: 3,
    description: 'Split total into 3 equal monthly payments',
  },
  {
    id: '5-month',
    name: '5 Month Plan',
    months: 5,
    description: 'Split total into 5 equal monthly payments',
  },
  {
    id: '10-month',
    name: '10 Month Plan',
    months: 10,
    description: 'Split total into 10 equal monthly payments',
  },
]

interface ScheduledInvoice {
  month: number
  amount: number
  dueDate: Date
  description: string
}

export function CreatePaymentPlanModal({
  isOpen,
  onClose,
  userId,
}: CreatePaymentPlanModalProps) {
  const [contactSearch, setContactSearch] = useState('')
  const [contactOpen, setContactOpen] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [selectedContactName, setSelectedContactName] = useState('')
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [totalAmount, setTotalAmount] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>(new Date())
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const debouncedSearch = useDebouncedValue(contactSearch, 300)
  const { data: contacts = [], isLoading: contactsLoading } = useSearchContacts(debouncedSearch)
  const { data: deals = [] } = useContactDeals(selectedContactId)
  const createInvoice = useCreateInvoice()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setContactSearch('')
      setSelectedContactId(null)
      setSelectedContactName('')
      setSelectedDealId(null)
      setSelectedTemplate(null)
      setTotalAmount('')
      setStartDate(new Date())
      setDescription('')
      setNotes('')
    }
  }, [isOpen])

  const handleSelectContact = (contact: { id: string; first_name: string; last_name: string }) => {
    setSelectedContactId(contact.id)
    setSelectedContactName(`${contact.first_name} ${contact.last_name}`)
    setSelectedDealId(null)
    setContactOpen(false)
  }

  // Calculate scheduled invoices based on template
  const scheduledInvoices: ScheduledInvoice[] = (() => {
    if (!selectedTemplate || !totalAmount || !startDate) return []

    const template = paymentPlanTemplates.find((t) => t.id === selectedTemplate)
    if (!template) return []

    const total = parseFloat(totalAmount)
    if (isNaN(total) || total <= 0) return []

    const monthlyAmount = Math.round((total / template.months) * 100) / 100
    const invoices: ScheduledInvoice[] = []

    for (let i = 0; i < template.months; i++) {
      // Adjust last payment for rounding
      const amount = i === template.months - 1
        ? Math.round((total - monthlyAmount * (template.months - 1)) * 100) / 100
        : monthlyAmount

      invoices.push({
        month: i + 1,
        amount,
        dueDate: addMonths(startDate, i),
        description: `${description || 'Payment Plan'} - Instalment ${i + 1} of ${template.months}`,
      })
    }

    return invoices
  })()

  const handleSubmit = async () => {
    if (!selectedContactId || !selectedTemplate || scheduledInvoices.length === 0) return

    setIsCreating(true)

    let created = 0
    try {
      for (const invoice of scheduledInvoices) {
        await createInvoice.mutateAsync({
          contact_id: selectedContactId,
          deal_id: selectedDealId,
          type: 'installment',
          description: invoice.description,
          amount: invoice.amount,
          due_date: format(invoice.dueDate, 'yyyy-MM-dd'),
          notes: notes || undefined,
          created_by_id: userId,
        })
        created++
      }

      toast({
        title: 'Payment plan created',
        description: `${scheduledInvoices.length} invoices created for ${selectedContactName}.`,
      })

      onClose()
    } catch (error) {
      if (created > 0) {
        toast({
          title: 'Payment plan partially created',
          description: `${created} of ${scheduledInvoices.length} invoices were created before an error occurred. Please check and create the remaining invoices manually.`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Failed to create payment plan',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        })
      }
    } finally {
      setIsCreating(false)
    }
  }

  const template = paymentPlanTemplates.find((t) => t.id === selectedTemplate)
  const isValid =
    selectedContactId &&
    selectedTemplate &&
    totalAmount &&
    parseFloat(totalAmount) > 0 &&
    startDate &&
    description.trim().length > 0

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            Create Payment Plan
          </SheetTitle>
          <SheetDescription>
            Generate multiple invoices from a payment plan template.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-6 py-6">
            {/* Contact Selection */}
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
                    <Command shouldFilter={false}>
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

            {/* Plan Template Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Payment Plan
              </h3>

              <div className="grid grid-cols-3 gap-3">
                {paymentPlanTemplates.map((t) => (
                  <Card
                    key={t.id}
                    className={cn(
                      'cursor-pointer transition-all hover:border-blue-300',
                      selectedTemplate === t.id && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    )}
                    onClick={() => setSelectedTemplate(t.id)}
                  >
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{t.months}</p>
                      <p className="text-xs text-muted-foreground">months</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {template && (
                <p className="text-sm text-muted-foreground">{template.description}</p>
              )}
            </div>

            {/* Plan Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Plan Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Total Amount (£) <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      £
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    First Payment Date <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !startDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'dd/MM/yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          setStartDate(date)
                          setStartDateOpen(false)
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
                  placeholder="e.g. UCLan 2026 Programme Fee"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>
            </div>

            {/* Invoice Preview */}
            {scheduledInvoices.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                  Invoice Schedule Preview
                </h3>

                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {scheduledInvoices.map((invoice, index) => (
                    <Card key={index} className="border-slate-200">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                            <ReceiptPoundSterling className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              Instalment {invoice.month} of {scheduledInvoices.length}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Due: {format(invoice.dueDate, 'dd MMM yyyy')}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                          £{invoice.amount.toFixed(2)}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Total</span>
                  <span className="text-lg font-bold text-blue-600">
                    £{scheduledInvoices.reduce((sum, inv) => sum + inv.amount, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 bg-slate-50 dark:bg-slate-800 shrink-0">
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isCreating}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isCreating}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating {scheduledInvoices.length} Invoices...
                </>
              ) : (
                `Create ${scheduledInvoices.length || ''} Invoices`
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
