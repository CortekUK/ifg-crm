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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Mail, MessageSquare, CalendarIcon, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils/format'
import { useCreateCampaign, useLists, useEmailTemplates } from '@/lib/hooks/useCampaigns'
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
  const [emailSubject, setEmailSubject] = useState('')
  const [templateId, setTemplateId] = useState<string>('')
  const [smsContent, setSmsContent] = useState('')
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>()
  const [scheduledTime, setScheduledTime] = useState('09:00')

  const { data: lists = [] } = useLists()
  const { data: templates = [] } = useEmailTemplates()
  const createCampaign = useCreateCampaign()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('')
      setType('email')
      setSelectedLists([])
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
              
              <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                {lists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No lists available</p>
                ) : (
                  lists.map((list) => (
                    <div key={list.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-md">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={list.id}
                          checked={selectedLists.includes(list.id)}
                          onCheckedChange={() => handleListToggle(list.id)}
                        />
                        <label htmlFor={list.id} className="text-sm font-medium cursor-pointer">
                          {list.name}
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {selectedLists.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedLists.map((listId) => {
                    const list = lists.find((l) => l.id === listId)
                    return list ? (
                      <Badge key={listId} variant="secondary" className="text-xs">
                        {list.name}
                        <button
                          type="button"
                          onClick={() => handleListToggle(listId)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null
                  })}
                </div>
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
