import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { EmailReply } from '@/lib/types/email'
import type { SMSMessage } from '@/lib/types/sms'

interface BulkProcessResult {
  processed: number
  dealsCreated: number
  contactsCreated: number
  contactsMatched: number
  errors: string[]
}

interface BulkProcessInput {
  pipelineId: string
  userId: string
}

/**
 * Hook for bulk processing email replies
 * - Matches replies to contacts (or creates new contacts)
 * - Creates deals for positive intent replies with round-robin assignment
 */
export function useBulkProcessEmailReplies(selectedReplies: EmailReply[]) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ pipelineId, userId }: BulkProcessInput): Promise<BulkProcessResult> => {
      const result: BulkProcessResult = {
        processed: 0,
        dealsCreated: 0,
        contactsCreated: 0,
        contactsMatched: 0,
        errors: [],
      }

      if (selectedReplies.length === 0) {
        return result
      }

      // Get first stage of the pipeline
      const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', pipelineId)
        .order('display_order', { ascending: true })
        .limit(1)

      if (!stages || stages.length === 0) {
        throw new Error('No stages found for pipeline')
      }
      const firstStageId = stages[0].id

      // Process each reply
      for (const reply of selectedReplies) {
        try {
          let contactId = reply.contact_id

          // If not already matched, try to find or create contact
          if (!contactId) {
            // Try to find existing contact by email
            const { data: existingContact } = await supabase
              .from('contacts')
              .select('id')
              .eq('email', reply.from_email.toLowerCase())
              .single()

            if (existingContact) {
              contactId = existingContact.id
              result.contactsMatched++
            } else {
              // Create new contact from email
              const nameParts = reply.from_name?.split(' ') || []
              const firstName = nameParts[0] || reply.from_email.split('@')[0]
              const lastName = nameParts.slice(1).join(' ') || ''

              const { data: newContact, error: contactError } = await supabase
                .from('contacts')
                .insert({
                  first_name: firstName,
                  last_name: lastName,
                  email: reply.from_email.toLowerCase(),
                  source: 'email_reply',
                  email_subscription_status: 'subscribed',
                  sms_subscription_status: 'subscribed',
                })
                .select('id')
                .single()

              if (contactError) {
                result.errors.push(`Failed to create contact for ${reply.from_email}: ${contactError.message}`)
                continue
              }

              contactId = newContact.id
              result.contactsCreated++
            }

            // Update reply with matched contact
            await supabase
              .from('email_replies')
              .update({
                contact_id: contactId,
                match_status: 'manually_matched',
                matched_by_id: userId,
                matched_at: new Date().toISOString(),
              })
              .eq('id', reply.id)
          }

          // Create deal only for positive intent
          if (reply.ai_intent === 'positive' && contactId) {
            // Get contact name for deal title
            const { data: contact } = await supabase
              .from('contacts')
              .select('first_name, last_name')
              .eq('id', contactId)
              .single()

            const dealTitle = contact
              ? `${contact.first_name} ${contact.last_name}`.trim()
              : reply.from_name || reply.from_email.split('@')[0]

            // Create deal
            const { error: dealError } = await supabase
              .from('deals')
              .insert({
                title: dealTitle,
                contact_id: contactId,
                pipeline_id: pipelineId,
                current_stage_id: firstStageId,
                deal_owner_id: userId,
                source: 'email_reply',
                deal_value: 0,
                status: 'active',
                stage_changed_at: new Date().toISOString(),
              })

            if (dealError) {
              result.errors.push(`Failed to create deal for ${reply.from_email}: ${dealError.message}`)
            } else {
              result.dealsCreated++
            }
          }

          result.processed++
        } catch (error) {
          result.errors.push(`Error processing ${reply.from_email}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-replies'] })
      queryClient.invalidateQueries({ queryKey: ['email-reply-counts'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

/**
 * Hook for bulk processing SMS messages
 * - Matches messages to contacts (or creates new contacts)
 * - Creates deals for positive intent messages with round-robin assignment
 */
export function useBulkProcessSMSMessages(selectedMessages: SMSMessage[]) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ pipelineId, userId }: BulkProcessInput): Promise<BulkProcessResult> => {
      const result: BulkProcessResult = {
        processed: 0,
        dealsCreated: 0,
        contactsCreated: 0,
        contactsMatched: 0,
        errors: [],
      }

      if (selectedMessages.length === 0) {
        return result
      }

      // Get first stage of the pipeline
      const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', pipelineId)
        .order('display_order', { ascending: true })
        .limit(1)

      if (!stages || stages.length === 0) {
        throw new Error('No stages found for pipeline')
      }
      const firstStageId = stages[0].id

      // Process each message
      for (const message of selectedMessages) {
        try {
          let contactId = message.contact_id

          // If not already matched, try to find or create contact
          if (!contactId) {
            // Normalise phone number for matching
            const normalizedPhone = message.phone_number.replace(/\D/g, '')

            // Try to find existing contact by phone
            const { data: existingContacts } = await supabase
              .from('contacts')
              .select('id, phone')
              .not('phone', 'is', null)

            // Find matching phone (comparing normalized versions)
            const matchingContact = existingContacts?.find((c) => {
              const contactPhone = c.phone?.replace(/\D/g, '')
              return contactPhone && (
                contactPhone === normalizedPhone ||
                contactPhone.endsWith(normalizedPhone) ||
                normalizedPhone.endsWith(contactPhone)
              )
            })

            if (matchingContact) {
              contactId = matchingContact.id
              result.contactsMatched++
            } else {
              // Create new contact from phone number
              const { data: newContact, error: contactError } = await supabase
                .from('contacts')
                .insert({
                  first_name: 'Unknown',
                  last_name: message.phone_number,
                  phone: message.phone_number,
                  source: 'sms_reply',
                  email_subscription_status: 'subscribed',
                  sms_subscription_status: 'subscribed',
                })
                .select('id')
                .single()

              if (contactError) {
                result.errors.push(`Failed to create contact for ${message.phone_number}: ${contactError.message}`)
                continue
              }

              contactId = newContact.id
              result.contactsCreated++
            }

            // Update message with matched contact
            await supabase
              .from('sms_messages')
              .update({
                contact_id: contactId,
                match_status: 'manually_matched',
                matched_by_id: userId,
                matched_at: new Date().toISOString(),
              })
              .eq('id', message.id)
          }

          // Create deal only for positive intent
          if (message.ai_intent === 'positive' && contactId) {
            // Get contact name for deal title
            const { data: contact } = await supabase
              .from('contacts')
              .select('first_name, last_name')
              .eq('id', contactId)
              .single()

            const dealTitle = contact
              ? `${contact.first_name} ${contact.last_name}`.trim()
              : message.phone_number

            // Create deal
            const { error: dealError } = await supabase
              .from('deals')
              .insert({
                title: dealTitle,
                contact_id: contactId,
                pipeline_id: pipelineId,
                current_stage_id: firstStageId,
                deal_owner_id: userId,
                source: 'sms_reply',
                deal_value: 0,
                status: 'active',
                stage_changed_at: new Date().toISOString(),
              })

            if (dealError) {
              result.errors.push(`Failed to create deal for ${message.phone_number}: ${dealError.message}`)
            } else {
              result.dealsCreated++
            }
          }

          result.processed++
        } catch (error) {
          result.errors.push(`Error processing ${message.phone_number}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-messages'] })
      queryClient.invalidateQueries({ queryKey: ['sms-message-counts'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}
