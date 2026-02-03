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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Mail,
  MessageSquare,
  CalendarIcon,
  Loader2,
  X,
  Users,
  Search,
  ChevronDown,
  AlertTriangle,
  Eye,
  Type,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatNumber } from '@/lib/utils/format'
import {
  useCreateCampaign,
  useUpdateCampaign,
  useCampaignLists,
  useEmailTemplates,
  useCalculateRecipients,
} from '@/lib/hooks/useCampaigns'
import { toast } from '@/lib/hooks/use-toast'
import type { Campaign, CreateCampaignInput } from '@/lib/types/campaigns'

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  editCampaign?: Campaign | null
}

const SMS_MAX_CHARS = 480

const EMAIL_MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{last_name}}', label: 'Last Name' },
  { tag: '{{email}}', label: 'Email' },
  { tag: '{{programme}}', label: 'Programme' },
  { tag: '{{calendly_link}}', label: 'Calendly Link' },
]

const SMS_MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First Name' },
  { tag: '{{last_name}}', label: 'Last Name' },
  { tag: '{{programme}}', label: 'Programme' },
  { tag: '{{calendly_link}}', label: 'Calendly' },
]

export function CreateCampaignModal({
  isOpen,
  onClose,
  userId,
  editCampaign,
}: CreateCampaignModalProps) {
  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState<'email' | 'sms'>('email')
  const [selectedLists, setSelectedLists] = useState<string[]>([])
  const [listSearchQuery, setListSearchQuery] = useState('')
  const [isListDropdownOpen, setIsListDropdownOpen] = useState(false)

  // Email fields
  const [emailSubject, setEmailSubject] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [templateId, setTemplateId] = useState<string>('')
  const [emailContentMode, setEmailContentMode] = useState<'template' | 'compose'>('template')
  const [emailBodyText, setEmailBodyText] = useState('')
  const [emailBodyHtml, setEmailBodyHtml] = useState('')

  // SMS fields
  const [smsContent, setSmsContent] = useState('')

  // Scheduling
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>()
  const [scheduledTime, setScheduledTime] = useState('09:00')

  // Preview modal
  const [showPreview, setShowPreview] = useState(false)

  const { data: lists = [] } = useCampaignLists()
  const { data: templates = [] } = useEmailTemplates()
  const { data: recipientData, isLoading: recipientCountLoading } = useCalculateRecipients(selectedLists)
  const createCampaign = useCreateCampaign()
  const updateCampaign = useUpdateCampaign()

  const isEditing = !!editCampaign

  // Filter lists based on search query
  const filteredLists = lists.filter((list) =>
    list.name.toLowerCase().includes(listSearchQuery.toLowerCase())
  )

  // Initialize form when modal opens or editCampaign changes
  useEffect(() => {
    if (isOpen) {
      if (editCampaign) {
        // Populate form with existing campaign data
        setName(editCampaign.name)
        setType(editCampaign.type)
        setSelectedLists(editCampaign.recipient_list_ids || [])
        setEmailSubject(editCampaign.subject || '')
        setPreviewText(editCampaign.preview_text || '')
        setFromName(editCampaign.from_name || '')
        setFromEmail(editCampaign.from_email || '')
        setReplyTo(editCampaign.reply_to || '')
        setTemplateId(editCampaign.email_template_id || '')
        setEmailBodyText(editCampaign.body_text || '')
        setEmailBodyHtml(editCampaign.body_html || '')
        setEmailContentMode(editCampaign.email_template_id ? 'template' : 'compose')
        setSmsContent(editCampaign.sms_content || '')
        if (editCampaign.scheduled_at) {
          setIsScheduled(true)
          const date = new Date(editCampaign.scheduled_at)
          setScheduledDate(date)
          setScheduledTime(
            `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
          )
        } else {
          setIsScheduled(false)
          setScheduledDate(undefined)
          setScheduledTime('09:00')
        }
      } else {
        // Reset form for new campaign
        setName('')
        setType('email')
        setSelectedLists([])
        setListSearchQuery('')
        setIsListDropdownOpen(false)
        setEmailSubject('')
        setPreviewText('')
        setFromName('')
        setFromEmail('')
        setReplyTo('')
        setTemplateId('')
        setEmailContentMode('template')
        setEmailBodyText('')
        setEmailBodyHtml('')
        setSmsContent('')
        setIsScheduled(false)
        setScheduledDate(undefined)
        setScheduledTime('09:00')
      }
    }
  }, [isOpen, editCampaign])

  const handleListToggle = (listId: string) => {
    setSelectedLists((prev) =>
      prev.includes(listId)
        ? prev.filter((id) => id !== listId)
        : [...prev, listId]
    )
  }

  const insertMergeTag = (tag: string, target: 'email' | 'sms' | 'subject') => {
    if (target === 'sms') {
      setSmsContent((prev) => prev + tag)
    } else if (target === 'subject') {
      setEmailSubject((prev) => prev + tag)
    } else {
      setEmailBodyText((prev) => prev + tag)
    }
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

      const campaignData: CreateCampaignInput = {
        name: name.trim(),
        type,
        status: saveAsDraft ? 'draft' : isScheduled ? 'scheduled' : 'draft',
        from_user_id: userId,
        created_by_id: userId,
        recipient_list_ids: selectedLists.length > 0 ? selectedLists : undefined,
        scheduled_at: !saveAsDraft && isScheduled ? scheduledAt : undefined,
      }

      if (type === 'email') {
        campaignData.subject = emailSubject || undefined
        campaignData.preview_text = previewText || undefined
        campaignData.from_name = fromName || undefined
        campaignData.from_email = fromEmail || undefined
        campaignData.reply_to = replyTo || undefined
        if (emailContentMode === 'template' && templateId && templateId !== 'scratch') {
          campaignData.email_template_id = templateId
        } else if (emailContentMode === 'compose') {
          campaignData.body_text = emailBodyText || undefined
          campaignData.body_html = emailBodyHtml || emailBodyText || undefined
        }
      } else {
        campaignData.sms_content = smsContent || undefined
      }

      if (isEditing && editCampaign) {
        await updateCampaign.mutateAsync({
          id: editCampaign.id,
          ...campaignData,
        })
        toast({
          title: 'Campaign updated',
          description: `"${name.trim()}" has been updated.`,
        })
      } else {
        await createCampaign.mutateAsync(campaignData)
        toast({
          title: saveAsDraft ? 'Draft saved' : isScheduled ? 'Campaign scheduled' : 'Campaign created',
          description: saveAsDraft
            ? `"${name.trim()}" saved as draft.`
            : isScheduled
              ? `"${name.trim()}" scheduled for ${formatDate(scheduledDate!)}.`
              : `"${name.trim()}" created successfully.`,
        })
      }

      onClose()
    } catch (error) {
      toast({
        title: isEditing ? 'Failed to update campaign' : 'Failed to create campaign',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const smsSegments = Math.ceil(smsContent.length / 160)
  const isValid = name.trim().length > 0
  const hasNoRecipients = selectedLists.length === 0
  const isPending = createCampaign.isPending || updateCampaign.isPending

  // Get preview content
  const getPreviewContent = () => {
    if (type === 'sms') {
      return smsContent || '(No content)'
    }
    if (emailContentMode === 'template' && templateId && templateId !== 'scratch') {
      const template = templates.find((t) => t.id === templateId)
      return template ? `Using template: ${template.name}` : '(No template selected)'
    }
    return emailBodyText || emailBodyHtml || '(No content)'
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
              {isEditing ? 'Edit Campaign' : 'Create Campaign'}
            </SheetTitle>
            <SheetDescription>
              {isEditing
                ? 'Update your campaign details and settings.'
                : 'Set up a new email or SMS campaign to reach your contacts.'}
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
                      disabled={isEditing}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                    <Button
                      type="button"
                      variant={type === 'sms' ? 'default' : 'outline'}
                      onClick={() => setType('sms')}
                      className={cn('flex-1', type === 'sms' && 'bg-blue-600 hover:bg-blue-700')}
                      disabled={isEditing}
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

                {/* No Recipients Warning */}
                {hasNoRecipients && (
                  <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      No recipient lists selected. Select at least one list to send this campaign.
                    </AlertDescription>
                  </Alert>
                )}

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
                                  isSelected ? 'bg-blue-50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
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
                    Email Settings
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">From Name</Label>
                      <Input
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        placeholder="e.g. IFG Recruitment"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">From Email</Label>
                      <Input
                        type="email"
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                        placeholder="e.g. recruitment@ifg.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Reply-To Email</Label>
                    <Input
                      type="email"
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                      placeholder="e.g. replies@ifg.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-slate-700">
                        Subject Line <span className="text-red-500">*</span>
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 text-xs">
                            <Type className="h-3 w-3 mr-1" />
                            Insert Variable
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1" align="end">
                          {EMAIL_MERGE_TAGS.slice(0, 3).map((item) => (
                            <Button
                              key={item.tag}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-xs"
                              onClick={() => insertMergeTag(item.tag, 'subject')}
                            >
                              {item.label}
                            </Button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Enter email subject..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Preview Text</Label>
                    <Input
                      value={previewText}
                      onChange={(e) => setPreviewText(e.target.value)}
                      placeholder="Text shown in inbox preview..."
                    />
                    <p className="text-xs text-muted-foreground">
                      This text appears next to the subject in most email clients
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                      Email Content
                    </h3>

                    <Tabs
                      value={emailContentMode}
                      onValueChange={(v) => setEmailContentMode(v as 'template' | 'compose')}
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="template">Use Template</TabsTrigger>
                        <TabsTrigger value="compose">Compose</TabsTrigger>
                      </TabsList>

                      <TabsContent value="template" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-slate-700">Template</Label>
                          <Select value={templateId} onValueChange={setTemplateId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a template" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TabsContent>

                      <TabsContent value="compose" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-slate-700">Email Body</Label>
                            <div className="flex gap-1">
                              {EMAIL_MERGE_TAGS.map((item) => (
                                <Button
                                  key={item.tag}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => insertMergeTag(item.tag, 'email')}
                                >
                                  {item.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                          <Textarea
                            value={emailBodyText}
                            onChange={(e) => setEmailBodyText(e.target.value)}
                            placeholder="Write your email content here..."
                            rows={8}
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Use merge tags like {'{{first_name}}'} to personalize your email
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>

                    {/* Preview Button */}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowPreview(true)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview Email
                    </Button>
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
                      {SMS_MERGE_TAGS.map((item) => (
                        <Button
                          key={item.tag}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => insertMergeTag(item.tag, 'sms')}
                        >
                          {item.tag}
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
                disabled={!isValid || isPending}
                className="flex-1"
              >
                Save as Draft
              </Button>
              <Button
                onClick={() => handleSubmit(false)}
                disabled={!isValid || isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
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

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview how your email will appear to recipients
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-slate-100 p-3 border-b">
                <p className="text-sm">
                  <strong>From:</strong> {fromName || 'Your Name'} &lt;{fromEmail || 'email@example.com'}&gt;
                </p>
                <p className="text-sm">
                  <strong>Subject:</strong> {emailSubject || '(No subject)'}
                </p>
                {previewText && (
                  <p className="text-xs text-muted-foreground mt-1">{previewText}</p>
                )}
              </div>
              <div className="p-4 bg-white min-h-[200px]">
                {emailContentMode === 'template' && templateId ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Template content will be rendered when sent</p>
                    <p className="text-sm">
                      Template: {templates.find((t) => t.id === templateId)?.name}
                    </p>
                  </div>
                ) : emailBodyText ? (
                  <div className="whitespace-pre-wrap text-sm">
                    {emailBodyText
                      .replace(/\{\{first_name\}\}/g, 'John')
                      .replace(/\{\{last_name\}\}/g, 'Doe')
                      .replace(/\{\{email\}\}/g, 'john.doe@example.com')
                      .replace(/\{\{programme\}\}/g, 'US Soccer')
                      .replace(/\{\{calendly_link\}\}/g, 'https://calendly.com/example')}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No content yet</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              * Merge tags shown with sample data (John Doe)
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
