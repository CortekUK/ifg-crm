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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Calendar } from '@/components/ui/calendar'
import { Slider } from '@/components/ui/slider'
import { Check, ChevronsUpDown, Loader2, PoundSterling, CalendarIcon, TrendingUp } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { useSearchContacts } from '@/lib/hooks/useSearchContacts'
import { useCreateDeal } from '@/lib/hooks/useCreateDeal'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { toast } from '@/lib/hooks/use-toast'
import { OwnerSelect } from '@/components/ui/owner-select'
import type { Contact } from '@/lib/types/contacts'
import type { PipelineStage } from '@/lib/types/pipelines'

interface AddDealModalProps {
  isOpen: boolean
  onClose: () => void
  pipelineId: string
  stage: PipelineStage
  userId: string
  defaultDealValue?: number
}

export function AddDealModal({
  isOpen,
  onClose,
  pipelineId,
  stage,
  userId,
  defaultDealValue = 15000,
}: AddDealModalProps) {
  const [contactSearch, setContactSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false)
  const [dealValue, setDealValue] = useState(defaultDealValue.toString())
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(userId)
  const [notes, setNotes] = useState('')
  const [description, setDescription] = useState('')
  const [winProbability, setWinProbability] = useState<number | null>(null)
  const [forecastedCloseDate, setForecastedCloseDate] = useState<Date | undefined>()
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  const debouncedSearch = useDebouncedValue(contactSearch, 300)
  const { data: contacts = [], isLoading: isSearching } = useSearchContacts(debouncedSearch)
  const createDeal = useCreateDeal()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setContactSearch('')
      setSelectedContact(null)
      setDealValue(defaultDealValue.toString())
      setSelectedOwnerId(userId)
      setNotes('')
      setDescription('')
      setWinProbability(null)
      setForecastedCloseDate(undefined)
    }
  }, [isOpen, defaultDealValue, userId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedContact || !selectedOwnerId) return

    try {
      await createDeal.mutateAsync({
        contactId: selectedContact.id,
        pipelineId,
        stageId: stage.id,
        ownerId: selectedOwnerId,
        dealValue: parseFloat(dealValue) || 0,
        title: `${selectedContact.first_name} ${selectedContact.last_name}`,
        notes: notes || undefined,
        description: description || undefined,
        winProbability: winProbability ?? undefined,
        forecastedCloseDate: forecastedCloseDate ? forecastedCloseDate.toISOString().split('T')[0] : undefined,
      })

      toast({
        title: 'Deal created',
        description: `${selectedContact.first_name} ${selectedContact.last_name} added to ${stage.name}.`,
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Failed to create deal',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const getInitials = (contact: Contact) => {
    return `${contact.first_name.charAt(0)}${contact.last_name.charAt(0)}`.toUpperCase()
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            Add Deal to {stage.name}
          </SheetTitle>
          <SheetDescription>
            Create a new deal in the {stage.name} stage.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Deal Owner - At the top */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Deal Owner
              </h3>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Assign To <span className="text-red-500">*</span>
                </Label>
                <OwnerSelect
                  value={selectedOwnerId}
                  onChange={setSelectedOwnerId}
                  placeholder="Select deal owner"
                />
                <p className="text-xs text-muted-foreground">
                  The deal owner will receive automated emails and notifications for this deal.
                </p>
              </div>
            </div>

            {/* Contact Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Contact
              </h3>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Select Contact <span className="text-red-500">*</span>
                </Label>
                <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={contactPopoverOpen}
                      className="w-full justify-between"
                    >
                      {selectedContact ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                              {getInitials(selectedContact)}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            {selectedContact.first_name} {selectedContact.last_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Search contacts...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search by name or email..."
                        value={contactSearch}
                        onValueChange={setContactSearch}
                      />
                      <CommandList>
                        {isSearching && (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        )}
                        {!isSearching && contacts.length === 0 && (
                          <CommandEmpty>No contacts found.</CommandEmpty>
                        )}
                        {!isSearching && contacts.length > 0 && (
                          <CommandGroup>
                            {contacts.map((contact) => (
                              <CommandItem
                                key={contact.id}
                                value={contact.id}
                                onSelect={() => {
                                  setSelectedContact(contact)
                                  setContactPopoverOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    selectedContact?.id === contact.id ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <Avatar className="h-8 w-8 mr-2">
                                  <AvatarFallback className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                    {getInitials(contact)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {contact.first_name} {contact.last_name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {contact.email}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Deal Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Deal Details
              </h3>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Deal Value (£) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    className="pl-9"
                    placeholder="15000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this deal..."
                  rows={3}
                />
              </div>
            </div>

            {/* Forecasting */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Forecasting (Optional)
              </h3>
              
              {/* Win Probability */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Win Probability
                  </Label>
                  <span className="text-sm font-semibold">
                    {winProbability !== null ? `${winProbability}%` : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Slider
                    value={winProbability !== null ? [winProbability] : [50]}
                    onValueChange={(value) => setWinProbability(value[0])}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setWinProbability(null)}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {/* Forecasted Close Date */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Forecasted Close Date
                </Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !forecastedCloseDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {forecastedCloseDate ? formatDate(forecastedCloseDate.toISOString()) : 'Select a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={forecastedCloseDate}
                      onSelect={(date) => {
                        setForecastedCloseDate(date)
                        setDatePickerOpen(false)
                      }}
                      initialFocus
                    />
                    {forecastedCloseDate && (
                      <div className="p-2 border-t">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            setForecastedCloseDate(undefined)
                            setDatePickerOpen(false)
                          }}
                        >
                          Clear date
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a detailed description of this deal..."
                  rows={4}
                />
              </div>
            </div>
          </div>

          <SheetFooter className="border-t dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-800 shrink-0">
            <div className="flex gap-3 w-full">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!selectedContact || !selectedOwnerId || createDeal.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createDeal.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Deal'
                )}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
