'use client'

import { useState } from 'react'
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
import { RecipientPicker, type ChosenRecipient } from './RecipientPicker'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'
import { useSendOutlookMail } from '@/lib/hooks/useOutlook'
import { ComposeDealPrompt } from './ComposeDealPrompt'

interface ComposeModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  /** Pre-filled recipient, when composing from a contact or thread. */
  defaultTo?: string
}

/**
 * Compose a new message from the signed-in user's own mailbox.
 *
 * After a successful send, if the recipient is a known contact with NO deal,
 * we offer to create one. That offer is deliberately a second step rather than
 * something that happens automatically: a deal needs a pipeline, and picking
 * one on the user's behalf would file a player into a programme nobody chose.
 */
export function ComposeModal({ isOpen, onClose, userId, defaultTo = '' }: ComposeModalProps) {
  const [recipient, setRecipient] = useState<ChosenRecipient | null>(
    defaultTo ? { email: defaultTo, contact: null, pipelines: [] } : null,
  )
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [dealPrompt, setDealPrompt] = useState<{ id: string; name: string } | null>(null)

  const sendMail = useSendOutlookMail()

  const reset = () => {
    setRecipient(null)
    setSubject('')
    setBody('')
  }

  const handleSend = async () => {
    if (!recipient) return
    try {
      const result = await sendMail.mutateAsync({ to: recipient.email, subject, body })
      toast({ title: 'Message sent', description: `Sent to ${recipient.email}.` })

      // Offer to open a deal when the recipient has none. This covers both
      // cases: somebody already in the CRM without a deal, and somebody brand
      // new, whom the send route has just created a contact for. Cold outreach
      // to a new address is the main reason Compose exists, so it would be odd
      // to support the send and then drop the person on the floor.
      if (result.contact && !result.contact.hasDeal) {
        setDealPrompt({ id: result.contact.id, name: result.contact.name })
      } else {
        reset()
        onClose()
      }
    } catch (error) {
      toast({
        title: 'Could not send',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const canSend = !!recipient && subject.trim() && body.trim() && !sendMail.isPending

  return (
    <>
      <Dialog
        open={isOpen && !dealPrompt}
        onOpenChange={(open) => {
          if (!open) {
            reset()
            onClose()
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New message</DialogTitle>
            <DialogDescription>
              Sent from your own mailbox. It will appear in your Outlook Sent Items.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>To</Label>
              <RecipientPicker value={recipient} onChange={setRecipient} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compose-subject">Subject</Label>
              <Input
                id="compose-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compose-body">Message</Label>
              <Textarea
                id="compose-body"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                reset()
                onClose()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={!canSend}>
              {sendMail.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dealPrompt && (
        <ComposeDealPrompt
          contactId={dealPrompt.id}
          contactName={dealPrompt.name}
          userId={userId}
          onDone={() => {
            setDealPrompt(null)
            reset()
            onClose()
          }}
        />
      )}
    </>
  )
}
