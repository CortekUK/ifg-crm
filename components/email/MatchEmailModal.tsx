'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Search, Mail, Phone, Check, Loader2 } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { useSearchContacts } from '@/lib/hooks/useSearchContacts'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { useMatchEmailReply } from '@/lib/hooks/useEmailReplies'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'
import type { EmailReply, EmailIntent } from '@/lib/types/email'

interface MatchEmailModalProps {
  reply: EmailReply | null
  isOpen: boolean
  onClose: () => void
  userId: string
}

const intentConfig: Record<EmailIntent, { label: string; className: string }> = {
  positive: { label: 'Positive', className: 'bg-green-100 text-green-700' },
  negative: { label: 'Negative', className: 'bg-red-100 text-red-700' },
  neutral: { label: 'Neutral', className: 'bg-gray-100 text-gray-700' },
  unknown: { label: 'Unknown', className: 'bg-gray-100 text-gray-500' },
}

export function MatchEmailModal({
  reply,
  isOpen,
  onClose,
  userId,
}: MatchEmailModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [createDeal, setCreateDeal] = useState(false)
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(searchQuery, 300)
  const { data: contacts = [], isLoading: contactsLoading } = useSearchContacts(
    debouncedSearch || reply?.from_email || ''
  )
  const { data: pipelines = [] } = usePipelines()
  const matchReply = useMatchEmailReply()

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setSelectedContactId(null)
      setCreateDeal(false)
      setSelectedPipelineId(pipelines[0]?.id || null)
    }
  }, [isOpen, pipelines])

  const handleMatch = async () => {
    if (!reply || !selectedContactId) return

    try {
      // Match the reply
      await matchReply.mutateAsync({
        replyId: reply.id,
        contactId: selectedContactId,
        matchedById: userId,
      })

      // Optionally create a deal
      if (createDeal && selectedPipelineId) {
        const supabase = createClient()
        const selectedContact = contacts.find((c) => c.id === selectedContactId)

        // Get the first stage of the pipeline
        const { data: stages } = await supabase
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', selectedPipelineId)
          .order('display_order')
          .limit(1)

        if (stages && stages.length > 0 && selectedContact) {
          await supabase.from('deals').insert({
            contact_id: selectedContactId,
            pipeline_id: selectedPipelineId,
            current_stage_id: stages[0].id,
            deal_owner_id: userId,
            title: `${selectedContact.first_name} ${selectedContact.last_name}`,
            deal_value: 0,
            source: 'email_reply',
          })
        }
      }

      toast({
        title: 'Contact matched',
        description: createDeal ? 'Contact matched and deal created.' : 'Contact matched successfully.',
      })

      onClose()
    } catch (error) {
      console.error("Match error:", error)
      toast({
        title: 'Failed to match contact',
        description: error instanceof Error ? error.message : JSON.stringify(error),
        variant: 'destructive',
      })
    }
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || ''
    const last = lastName?.[0] || ''
    return (first + last).toUpperCase() || '??'
  }

  const intent = reply?.ai_intent || 'unknown'
  const intentInfo = intentConfig[intent]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900">
            Match to Contact
          </DialogTitle>
          <DialogDescription>
            Link this email reply to an existing contact in your CRM.
          </DialogDescription>
        </DialogHeader>

        {reply && (
          <div className="space-y-6 py-2">
            {/* Email Preview */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Email Preview
              </h3>
              <Card className="bg-slate-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {reply.from_name || reply.from_email}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(reply.created_at)}
                        </span>
                      </div>
                      {reply.from_name && (
                        <p className="text-xs text-muted-foreground mb-1">
                          {reply.from_email}
                        </p>
                      )}
                      <p className="text-sm font-medium mb-1">
                        {reply.subject || '(No subject)'}
                      </p>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {reply.body_preview || reply.body_full?.slice(0, 150)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={intentInfo.className}>{intentInfo.label}</Badge>
                        {reply.campaign && (
                          <Badge variant="outline" className="text-xs">
                            {reply.campaign.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search & Select Contact */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Select Contact
              </h3>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Search Contacts</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <ScrollArea className="h-[180px] border rounded-lg">
                {contactsLoading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Searching...
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No contacts found. Try a different search.
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {contacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => setSelectedContactId(contact.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                          selectedContactId === contact.id
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-gray-50'
                        )}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-blue-100 text-blue-600 text-sm">
                            {getInitials(contact.first_name, contact.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            {contact.first_name} {contact.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {contact.email}
                          </p>
                          {contact.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </div>
                          )}
                        </div>
                        {selectedContactId === contact.id && (
                          <Check className="h-5 w-5 text-blue-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Options
              </h3>
              
              <div className="flex items-center gap-3">
                <Checkbox
                  id="createDeal"
                  checked={createDeal}
                  onCheckedChange={(checked) => setCreateDeal(checked as boolean)}
                />
                <Label htmlFor="createDeal" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Create a deal for this contact
                </Label>
              </div>

              {createDeal && (
                <div className="space-y-2 pl-7">
                  <Label className="text-sm font-medium text-slate-700">Pipeline</Label>
                  <Select
                    value={selectedPipelineId || ''}
                    onValueChange={setSelectedPipelineId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pipeline..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map((pipeline) => (
                        <SelectItem key={pipeline.id} value={pipeline.id}>
                          {pipeline.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleMatch}
            disabled={!selectedContactId || matchReply.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {matchReply.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Matching...
              </>
            ) : (
              'Match Contact'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
