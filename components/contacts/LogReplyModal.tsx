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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, MessageCircle, AlertCircle } from 'lucide-react'
import { useCreateEmailReply, useContactRecentEmails } from '@/lib/hooks/useEmailReplies'
import { toast } from '@/lib/hooks/use-toast'
import { formatDateTime } from '@/lib/utils/format'

interface LogReplyModalProps {
  isOpen: boolean
  onClose: () => void
  contactId: string
  contactName: string
  contactEmail: string
}

export function LogReplyModal({
  isOpen,
  onClose,
  contactId,
  contactName,
  contactEmail,
}: LogReplyModalProps) {
  const [selectedEmailId, setSelectedEmailId] = useState<string>('')
  const [subject, setSubject] = useState('')
  const [bodyPreview, setBodyPreview] = useState('')
  const [receivedAt, setReceivedAt] = useState('')

  const { data: recentEmails = [], isLoading: emailsLoading } = useContactRecentEmails(contactId)
  const createReply = useCreateEmailReply()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedEmailId('')
      setSubject('')
      setBodyPreview('')
      // Default to now
      const now = new Date()
      setReceivedAt(now.toISOString().slice(0, 16))
    }
  }, [isOpen])

  // Update subject when email is selected
  useEffect(() => {
    if (selectedEmailId && recentEmails.length > 0) {
      const email = recentEmails.find((e) => e.id === selectedEmailId)
      if (email?.subject) {
        setSubject(`Re: ${email.subject.replace(/^Re:\s*/i, '')}`)
      }
    }
  }, [selectedEmailId, recentEmails])

  const handleSubmit = async () => {
    try {
      await createReply.mutateAsync({
        contact_id: contactId,
        email_send_id: selectedEmailId || undefined,
        subject: subject || undefined,
        body_preview: bodyPreview || undefined,
        from_email: contactEmail,
        received_at: receivedAt ? new Date(receivedAt).toISOString() : undefined,
      })

      toast({
        title: 'Reply logged',
        description: 'The reply has been logged and will stop any active automations.',
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to log reply. Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900">
            Log Email Reply
          </DialogTitle>
          <DialogDescription>
            Record that {contactName} replied to an email. This will stop any active automations
            with "stop on reply" enabled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Select original email */}
          <div className="space-y-2">
            <Label htmlFor="email">In reply to (optional)</Label>
            {emailsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : recentEmails.length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>No recent emails found for this contact.</span>
              </div>
            ) : (
              <Select value={selectedEmailId} onValueChange={setSelectedEmailId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select the email they replied to" />
                </SelectTrigger>
                <SelectContent>
                  {recentEmails.map((email) => (
                    <SelectItem key={email.id} value={email.id}>
                      <div className="flex flex-col">
                        <span className="font-medium truncate max-w-[280px]">
                          {email.subject || 'No subject'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(email.sent_at)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Reply subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Reply Subject</Label>
            <Input
              id="subject"
              placeholder="Re: Your original email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Reply preview */}
          <div className="space-y-2">
            <Label htmlFor="body">Reply Preview (optional)</Label>
            <Textarea
              id="body"
              placeholder="First few lines of their reply..."
              value={bodyPreview}
              onChange={(e) => setBodyPreview(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Add a brief preview of what they said for reference.
            </p>
          </div>

          {/* Received time */}
          <div className="space-y-2">
            <Label htmlFor="received">Received At</Label>
            <Input
              id="received"
              type="datetime-local"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createReply.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {createReply.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging...
              </>
            ) : (
              <>
                <MessageCircle className="mr-2 h-4 w-4" />
                Log Reply
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
