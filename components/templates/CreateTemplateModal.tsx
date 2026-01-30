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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Mail, MessageSquare, Loader2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreateTemplate } from '@/lib/hooks/useTemplates'
import { toast } from '@/lib/hooks/use-toast'
import type { Template } from '@/lib/types/templates'

interface CreateTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
}

const SMS_MAX_CHARS = 160

const variableButtons = [
  { label: '{{first_name}}', value: '{{first_name}}' },
  { label: '{{last_name}}', value: '{{last_name}}' },
  { label: '{{programme}}', value: '{{programme}}' },
  { label: '{{email}}', value: '{{email}}' },
  { label: '{{calendly_link}}', value: '{{calendly_link}}' },
]

export function CreateTemplateModal({
  isOpen,
  onClose,
  userId,
}: CreateTemplateModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'email' | 'sms'>('email')
  const [category, setCategory] = useState<Template['category']>('campaign')
  const [subject, setSubject] = useState('')
  const [fromNameType, setFromNameType] = useState<'deal_owner' | 'fixed'>('deal_owner')
  const [fixedFromName, setFixedFromName] = useState('')
  const [fixedFromEmail, setFixedFromEmail] = useState('')
  const [smsContent, setSmsContent] = useState('')

  const createTemplate = useCreateTemplate()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('')
      setType('email')
      setCategory('campaign')
      setSubject('')
      setFromNameType('deal_owner')
      setFixedFromName('')
      setFixedFromEmail('')
      setSmsContent('')
    }
  }, [isOpen])

  const handleInsertVariable = (variable: string) => {
    setSmsContent((prev) => prev + variable)
  }

  const handleSubmit = async () => {
    if (!name.trim()) return
    if (type === 'email' && !subject.trim()) return

    try {
      await createTemplate.mutateAsync({
        name: name.trim(),
        subject: type === 'email' ? subject.trim() : `SMS: ${name.trim()}`,
        body_html: type === 'email' ? '<p>Email content here...</p>' : smsContent,
        category,
        from_name_type: fromNameType,
        fixed_from_name: fromNameType === 'fixed' ? fixedFromName : undefined,
        fixed_from_email: fromNameType === 'fixed' ? fixedFromEmail : undefined,
        created_by_id: userId,
      })

      toast({
        title: 'Template created',
        description: `"${name.trim()}" has been saved.`,
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Failed to create template',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const smsCharsRemaining = SMS_MAX_CHARS - smsContent.length
  const smsSegments = Math.ceil(smsContent.length / SMS_MAX_CHARS) || 1

  const isValid = name.trim().length > 0 && (type === 'sms' || subject.trim().length > 0)

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900">
            Create Template
          </SheetTitle>
          <SheetDescription>
            Create a reusable template for your campaigns and automations.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-6">
            {/* Template Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Template Details
              </h3>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Template Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Initial Contact Email"
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

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as Template['category'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automation">Automation</SelectItem>
                    <SelectItem value="campaign">Campaign</SelectItem>
                    <SelectItem value="transactional">Transactional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Email Content */}
            {type === 'email' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                  Email Content
                </h3>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    Subject Line <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Hi {{first_name}}, let's chat about your future"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">From Name Type</Label>
                  <Select
                    value={fromNameType}
                    onValueChange={(v) => setFromNameType(v as 'deal_owner' | 'fixed')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deal_owner">Deal Owner (dynamic)</SelectItem>
                      <SelectItem value="fixed">Fixed Name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {fromNameType === 'fixed' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">From Name</Label>
                      <Input
                        value={fixedFromName}
                        onChange={(e) => setFixedFromName(e.target.value)}
                        placeholder="e.g. IFG Team"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">From Email</Label>
                      <Input
                        type="email"
                        value={fixedFromEmail}
                        onChange={(e) => setFixedFromEmail(e.target.value)}
                        placeholder="e.g. hello@ifg-crm.com"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Email Content</Label>
                  <Button variant="outline" className="w-full" disabled>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Edit Content (coming soon)
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Full email editor will be available in a future update.
                  </p>
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
                      Message Content <span className="text-red-500">*</span>
                    </Label>
                    <span
                      className={cn(
                        'text-xs',
                        smsCharsRemaining < 0 ? 'text-red-500' : 'text-muted-foreground'
                      )}
                    >
                      {smsContent.length}/{SMS_MAX_CHARS} ({smsSegments} SMS)
                    </span>
                  </div>
                  <Textarea
                    value={smsContent}
                    onChange={(e) => setSmsContent(e.target.value)}
                    placeholder="Type your SMS message..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Insert Variable</Label>
                  <div className="flex flex-wrap gap-2">
                    {variableButtons.map((variable) => (
                      <Badge
                        key={variable.value}
                        variant="outline"
                        className="cursor-pointer hover:bg-blue-50 hover:border-blue-300"
                        onClick={() => handleInsertVariable(variable.value)}
                      >
                        {variable.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="border-t px-6 py-4 bg-slate-50">
          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || createTemplate.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createTemplate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Template'
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
