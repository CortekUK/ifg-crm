'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'

interface BulkEditModalProps {
  isOpen: boolean
  onClose: () => void
  contactIds: string[]
  onSuccess: () => void
}

export function BulkEditModal({ isOpen, onClose, contactIds, onSuccess }: BulkEditModalProps) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [fields, setFields] = useState({
    subscription_status: '',
    sms_subscribed: '',
    country: '',
  })
  const [enabledFields, setEnabledFields] = useState({
    subscription_status: false,
    sms_subscribed: false,
    country: false,
  })

  const bulkUpdate = useMutation({
    mutationFn: async () => {
      const updates: Record<string, unknown> = {}

      if (enabledFields.subscription_status && fields.subscription_status) {
        updates.subscription_status = fields.subscription_status
      }
      if (enabledFields.sms_subscribed && fields.sms_subscribed) {
        updates.sms_subscribed = fields.sms_subscribed === 'true'
      }
      if (enabledFields.country && fields.country) {
        updates.country = fields.country
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No fields selected for update')
      }

      const { error } = await supabase
        .from('contacts')
        .update(updates)
        .in('id', contactIds)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-stats'] })
      toast({
        title: 'Contacts updated',
        description: `${contactIds.length} contact(s) have been updated.`,
      })
      onSuccess()
      onClose()
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    },
  })

  const hasChanges = Object.values(enabledFields).some(Boolean)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Edit {contactIds.length} Contact{contactIds.length !== 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            Toggle the fields you want to update. Only enabled fields will be changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Subscription Status */}
          <div className="flex items-start gap-3">
            <Switch
              checked={enabledFields.subscription_status}
              onCheckedChange={(v) => setEnabledFields((p) => ({ ...p, subscription_status: v }))}
              className="mt-1"
            />
            <div className="flex-1 space-y-1.5">
              <Label className={!enabledFields.subscription_status ? 'text-muted-foreground' : ''}>
                Email Subscription
              </Label>
              <Select
                value={fields.subscription_status}
                onValueChange={(v) => setFields((p) => ({ ...p, subscription_status: v }))}
                disabled={!enabledFields.subscription_status}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscribed">Subscribed</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* SMS Subscribed */}
          <div className="flex items-start gap-3">
            <Switch
              checked={enabledFields.sms_subscribed}
              onCheckedChange={(v) => setEnabledFields((p) => ({ ...p, sms_subscribed: v }))}
              className="mt-1"
            />
            <div className="flex-1 space-y-1.5">
              <Label className={!enabledFields.sms_subscribed ? 'text-muted-foreground' : ''}>
                SMS Subscription
              </Label>
              <Select
                value={fields.sms_subscribed}
                onValueChange={(v) => setFields((p) => ({ ...p, sms_subscribed: v }))}
                disabled={!enabledFields.sms_subscribed}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Subscribed</SelectItem>
                  <SelectItem value="false">Unsubscribed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Country */}
          <div className="flex items-start gap-3">
            <Switch
              checked={enabledFields.country}
              onCheckedChange={(v) => setEnabledFields((p) => ({ ...p, country: v }))}
              className="mt-1"
            />
            <div className="flex-1 space-y-1.5">
              <Label className={!enabledFields.country ? 'text-muted-foreground' : ''}>
                Country
              </Label>
              <Select
                value={fields.country}
                onValueChange={(v) => setFields((p) => ({ ...p, country: v }))}
                disabled={!enabledFields.country}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="Spain">Spain</SelectItem>
                  <SelectItem value="Germany">Germany</SelectItem>
                  <SelectItem value="France">France</SelectItem>
                  <SelectItem value="Italy">Italy</SelectItem>
                  <SelectItem value="Netherlands">Netherlands</SelectItem>
                  <SelectItem value="Ireland">Ireland</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => bulkUpdate.mutate()}
            disabled={!hasChanges || bulkUpdate.isPending}
          >
            {bulkUpdate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update {contactIds.length} Contact{contactIds.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
