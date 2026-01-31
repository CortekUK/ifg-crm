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
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, MessageSquare, CalendarIcon, Loader2, X, Users, Search, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatNumber } from '@/lib/utils/format'
import { useCreateCampaign, useCampaignLists, useEmailTemplates, useCalculateRecipients } from '@/lib/hooks/useCampaigns'
import { toast } from '@/lib/hooks/use-toast'

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
}

const SMS_MAX_CHARS = 480

export function CreateCampaignModal({
  isOpen,
  onClose,
  userId,
}: CreateCampaignModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'email' | 'sms'>('email')
  const [selectedLists, setSelectedLists] = useState<string[]>([])
  const [listSearchQuery, setListSearchQuery] = useState('')
  const [isListDropdownOpen, setIsListDropdownOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [templateId, setTemplateId] = useState<string>('')
  const [smsContent, setSmsContent] = useState('')
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>()
  const [scheduledTime, setScheduledTime] = useState('09:00')

  const { data: lists = [] } = useCampaignLists()
  const { data: templates = [] } = useEmailTemplates()
  const { data: recipientData, isLoading: recipientCountLoading } = useCalculateRecipients(selectedLists)
  const createCampaign = useCreateCampaign()

  // Filter lists based on search query
  const filteredLists = lists.filter((list) =>
    list.name.toLowerCase().includes(listSearchQuery.toLowerCase())
  )

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('')
      setType('email')
      setSelectedLists([])
      setListSearchQuery('')
      setIsListDropdownOpen(false)
      setEmailSubject('')
      setTemplateId('')
      setSmsContent('')
      setIsScheduled(false)
      setScheduledDate(undefined)
      setScheduledTime('09:00')
    }
  }, [isOpen])

  const handleListToggle = (listId: string) => {
    setSelectedLists((prev) =>
      prev.includes(listId)
        ? prev.filter((id) => id !== listId)
        : [...prev, listId]
    )
  }

  const insertVariable = (variable: string) => {
    setSmsContent((prev) => prev + variable)
  }

  const handleSubmit = async (saveAsDraft: boolean) => {
    if (!name.trim()) return

    try {
      let scheduledAt: string | undefined
      if (isScheduled && scheduledDate) {
        const [hours, minutes] = scheduledTime.split(':')
        const scheduled = new Date(scheduledDate)
        scheduled.setHours(parseInt(hours), parseInt(minutes))
        scheduledAt = scheduled.toISOString()
      }

      await createCampaign.mutateAsync({
        name: name.trim(),
        type,
        status: saveAsDraft ? 'draft' : isScheduled ? 'scheduled' : 'draft',
        email_template_id: type === 'email' && templateId ? templateId : undefined,
        sms_content: type === 'sms' ? smsContent : undefined,
        from_user_id: userId,
        created_by_id: userId,
        scheduled_at: !saveAsDraft && isScheduled ? scheduledAt : undefined,
        recipient_list_ids: selectedLists.length > 0 ? selectedLists : undefined,
      })

      toast({
        title: saveAsDraft ? 'Draft saved' : isScheduled ? 'Campaign scheduled' : 'Campaign created',
        description: saveAsDraft
          ? `"${name.trim()}" saved as draft.`
          : isScheduled
            ? `"${name.trim()}" scheduled for ${formatDate(scheduledDate!)}.`
            : `"${name.trim()}" created successfully.`,
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Failed to create campaign',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const smsSegments = Math.ceil(smsContent.length / 160)
  const isValid = name.trim().length > 0

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900">
            Create Campaign
          </SheetTitle>
          <SheetDescription>
            Set up a new email or SMS campaign to reach your contacts.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-6 py-6">
            {/* Campaign Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Campaign Details
              </h3>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Campaign Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. January 2026 Newsletter"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={type === 'email' ? 'default' : 'outline'}
                    onClick={() => setType('email')}
                    className={cn('flex-1', type === 'email' && 'bg-blue-600 hover:bg-blue-700')}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant={type === 'sms' ? 'default' : 'outline'}
                    onClick={() => setType('sms')}
                    className={cn('flex-1', type === 'sms' && 'bg-blue-600 hover:bg-blue-700')}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    SMS
                  </Button>
                </div>
              </div>
            </div>

            {/* Recipients */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Recipients
              </h3>
              
              {/* List Selection Dropdown */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Select Lists</Label>
                <Popover open={isListDropdownOpen} onOpenChange={setIsListDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className="text-muted-foreground">
                        {selectedLists.length === 0
                          ? 'Select lists...'
                          : `${selectedLists.length} list${selectedLists.length > 1 ? 's' : ''} selected`}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search lists..."
                          value={listSearchQuery}
                          onChange={(e) => setListSearchQuery(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                      {filteredLists.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No lists found
                        </p>
                      ) : (
                        filteredLists.map((list) => {
                          const isSelected = selectedLists.includes(list.id)
                          return (
                            <div
                              key={list.id}
                              className={cn(
                                'flex items-center justify-between p-2 rounded-md cursor-pointer',
                                isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                              )}
                              onClick={() => handleListToggle(list.id)}
                            >
                              <div className="flex items-center gap-2">
                                <Checkbox checked={isSelected} />
                                <span className="text-sm font-medium">{list.name}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatNumber(list.contact_count || 0)} contacts
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Selected Lists Badges */}
              {selectedLists.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedLists.map((listId) => {
                    const list = lists.find((l) => l.id === listId)
                    return list ? (
                      <Badge
                        key={listId}
                        variant="secondary"
                        className="bg-blue-50 text-blue-700 border border-blue-200 pr-1"
                      >
                        {list.name}
                        <span className="text-blue-500 ml-1">
                          ({formatNumber(list.contact_count || 0)})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleListToggle(listId)}
                          className="ml-1 p-0.5 rounded-full hover:bg-blue-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null
                  })}
                </div>
              )}

              {/* Total Recipients Card */}
              {selectedLists.length > 0 && (
                <Card className="bg-slate-50 border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        <span className="text-sm font-medium text-slate-700">Total Recipients</span>
                      </div>
                      <div className="text-right">
                        {recipientCountLoading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Calculating...</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-lg font-bold text-blue-600">
                              {formatNumber(recipientData?.count || 0)}
                            </span>
                            <span className="text-sm text-slate-600 ml-1">contacts</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {recipientData?.hasDuplicates && !recipientCountLoading && (
                      <p className="text-xs text-muted-foreground mt-2">
                        (duplicates removed across lists)
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Email Content */}
            {type === 'email' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                  Email Content
                </h3>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Subject Line</Label>
                  <Input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Enter email subject..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Template</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template or create from scratch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scratch">Create from scratch</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* SMS Content */}
            {type === 'sms' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                  SMS Content
                </h3>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-slate-700">
                      Message <span className="text-red-500">*</span>
                    </Label>
                    <span className="text-xs text-slate-500">
                      {smsContent.length}/{SMS_MAX_CHARS} • {smsSegments} segment{smsSegments !== 1 && 's'}
                    </span>
                  </div>
                  <Textarea
                    value={smsContent}
                    onChange={(e) => setSmsContent(e.target.value)}
                    placeholder="Type your SMS message..."
                    rows={4}
                    maxLength={SMS_MAX_CHARS}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Insert Variable</Label>
                  <div className="flex flex-wrap gap-2">
                    {['{{first_name}}', '{{last_name}}', '{{programme}}', '{{calendly_link}}'].map((variable) => (
                      <Button
                        key={variable}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertVariable(variable)}
                      >
                        {variable}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Schedule */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Schedule
              </h3>
              
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-slate-700">Schedule for later</Label>
                <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
              </div>

              {isScheduled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !scheduledDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduledDate ? formatDate(scheduledDate) : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={setScheduledDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Time</Label>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 bg-slate-50 shrink-0">
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={() => handleSubmit(true)}
              disabled={!isValid || createCampaign.isPending}
              className="flex-1"
            >
              Save as Draft
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={!isValid || createCampaign.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createCampaign.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : isScheduled ? (
                'Schedule'
              ) : (
                'Send Now'
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
