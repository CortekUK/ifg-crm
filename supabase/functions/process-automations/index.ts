// Supabase Edge Function: Process Automations
// This function handles automation triggers, processes the queue, and checks exit conditions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@2.0.0'
import { corsHeaders } from '../_shared/cors.ts'

interface ProcessingSummary {
  enrollmentsCreated: number
  stepsProcessed: number
  emailsQueued: number
  stagesMoved: number
  enrollmentsCompleted: number
  enrollmentsStopped: number
  enrollmentsStoppedByReply: number
  errors: string[]
}

interface Automation {
  id: string
  name: string
  pipeline_id: string | null
  trigger_stage_id: string | null
  trigger_type?: string
  stop_on_stage_ids: string[]
  is_active: boolean
}

interface AutomationStep {
  id: string
  automation_id: string
  step_order: number
  step_type: 'send_email' | 'wait' | 'send_sms' | 'move_to_stage' | 'create_deal'
  delay_days: number
  delay_hours: number
  email_template_id: string | null
  target_stage_id: string | null
}

interface AutomationEnrollment {
  id: string
  automation_id: string
  deal_id: string
  current_step_id: string | null
  status: 'active' | 'completed' | 'stopped' | 'paused'
  next_step_at: string | null
  send_as_user_id: string | null
}

interface Deal {
  id: string
  current_stage_id: string
  pipeline_id: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key for full access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const summary: ProcessingSummary = {
      enrollmentsCreated: 0,
      stepsProcessed: 0,
      emailsQueued: 0,
      stagesMoved: 0,
      enrollmentsCompleted: 0,
      enrollmentsStopped: 0,
      enrollmentsStoppedByReply: 0,
      errors: [],
    }

    // ============================================
    // 1. CHECK REPLIES - Stop automations where contact replied
    // ============================================
    await checkReplies(supabase, summary)

    // ============================================
    // 2. TRIGGER CHECK - Enroll deals in automations
    // ============================================
    await checkTriggers(supabase, summary)

    // ============================================
    // 3. PROCESS QUEUE - Execute ready steps
    // ============================================
    await processQueue(supabase, summary)

    // ============================================
    // 4. EXIT CONDITIONS - Stop enrollments that should exit
    // ============================================
    await checkExitConditions(supabase, summary)

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        processedAt: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error processing automations:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

/**
 * Check for email replies and stop automations accordingly
 */
async function checkReplies(
  supabase: ReturnType<typeof createClient>,
  summary: ProcessingSummary
) {
  try {
    // Get unprocessed replies
    const { data: replies, error: repliesError } = await supabase
      .from('email_replies')
      .select(`
        id,
        contact_id,
        email_send_id,
        received_at
      `)
      .eq('processed', false)
      .limit(50)

    if (repliesError || !replies || replies.length === 0) {
      return
    }

    for (const reply of replies) {
      try {
        if (!reply.email_send_id) {
          // Mark as processed since we can't link it to an automation
          await supabase
            .from('email_replies')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq('id', reply.id)
          continue
        }

        // Get the email send and related automation log
        const { data: emailSend } = await supabase
          .from('email_sends')
          .select('automation_log_id')
          .eq('id', reply.email_send_id)
          .single()

        if (!emailSend?.automation_log_id) {
          await supabase
            .from('email_replies')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq('id', reply.id)
          continue
        }

        // Get the automation log to find the enrollment
        const { data: log } = await supabase
          .from('automation_logs')
          .select('enrollment_id')
          .eq('id', emailSend.automation_log_id)
          .single()

        if (!log?.enrollment_id) {
          await supabase
            .from('email_replies')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq('id', reply.id)
          continue
        }

        // Get the enrollment with automation settings
        const { data: enrollment } = await supabase
          .from('automation_enrollments')
          .select(`
            id,
            status,
            automation:automations(exit_on_reply, config)
          `)
          .eq('id', log.enrollment_id)
          .single()

        if (!enrollment || enrollment.status !== 'active') {
          await supabase
            .from('email_replies')
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq('id', reply.id)
          continue
        }

        // Check if automation should exit on reply
        const automation = enrollment.automation as { exit_on_reply: boolean; config: { exit_on_reply?: boolean } } | null
        const exitOnReply = automation?.exit_on_reply ?? automation?.config?.exit_on_reply ?? true

        if (exitOnReply) {
          // Stop the enrollment
          const { error: stopError } = await supabase
            .from('automation_enrollments')
            .update({
              status: 'stopped',
              stopped_reason: 'Contact replied',
              next_step_at: null,
            })
            .eq('id', enrollment.id)

          if (stopError) {
            summary.errors.push(`Failed to stop enrollment ${enrollment.id}: ${stopError.message}`)
          } else {
            summary.enrollmentsStoppedByReply++
            console.log(`Stopped enrollment ${enrollment.id} - contact replied`)
          }
        }

        // Mark reply as processed
        await supabase
          .from('email_replies')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', reply.id)
      } catch (err) {
        summary.errors.push(`Error processing reply ${reply.id}: ${err}`)
      }
    }
  } catch (err) {
    summary.errors.push(`Error checking replies: ${err}`)
  }
}

/**
 * Check triggers and enroll deals in automations
 */
async function checkTriggers(
  supabase: ReturnType<typeof createClient>,
  summary: ProcessingSummary
) {
  // Get all active automations with their first step
  const { data: automations, error: automationsError } = await supabase
    .from('automations')
    .select(`
      id,
      name,
      pipeline_id,
      trigger_stage_id,
      stop_on_stage_ids,
      is_active,
      steps:automation_steps(id, step_order)
    `)
    .eq('is_active', true)
    .not('trigger_stage_id', 'is', null)

  if (automationsError) {
    summary.errors.push(`Failed to fetch automations: ${automationsError.message}`)
    return
  }

  if (!automations || automations.length === 0) {
    return
  }

  for (const automation of automations) {
    try {
      // Get the first step for this automation
      const steps = automation.steps as AutomationStep[]
      const firstStep = steps
        ?.sort((a, b) => a.step_order - b.step_order)
        ?.[0]

      if (!firstStep) {
        continue // Skip automations with no steps
      }

      // Find deals in the trigger stage that aren't already enrolled
      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, current_stage_id, pipeline_id')
        .eq('current_stage_id', automation.trigger_stage_id)
        .eq('pipeline_id', automation.pipeline_id)

      if (dealsError) {
        summary.errors.push(`Failed to fetch deals for automation ${automation.id}: ${dealsError.message}`)
        continue
      }

      if (!deals || deals.length === 0) {
        continue
      }

      // Get existing enrollments for this automation
      const { data: existingEnrollments, error: enrollmentsError } = await supabase
        .from('automation_enrollments')
        .select('deal_id')
        .eq('automation_id', automation.id)
        .in('status', ['active', 'completed']) // Don't re-enroll stopped deals

      if (enrollmentsError) {
        summary.errors.push(`Failed to fetch enrollments for automation ${automation.id}: ${enrollmentsError.message}`)
        continue
      }

      const enrolledDealIds = new Set(existingEnrollments?.map((e) => e.deal_id) || [])

      // Enroll deals that aren't already enrolled
      const dealsToEnroll = deals.filter((deal) => !enrolledDealIds.has(deal.id))

      if (dealsToEnroll.length === 0) {
        continue
      }

      // Create enrollment records
      const enrollmentRecords = dealsToEnroll.map((deal) => ({
        automation_id: automation.id,
        deal_id: deal.id,
        current_step_id: firstStep.id,
        status: 'active',
        enrolled_at: new Date().toISOString(),
        next_step_at: new Date().toISOString(), // Process immediately
      }))

      const { error: insertError } = await supabase
        .from('automation_enrollments')
        .insert(enrollmentRecords)

      if (insertError) {
        summary.errors.push(`Failed to create enrollments for automation ${automation.id}: ${insertError.message}`)
        continue
      }

      summary.enrollmentsCreated += dealsToEnroll.length
      console.log(`Enrolled ${dealsToEnroll.length} deals in automation "${automation.name}"`)
    } catch (err) {
      summary.errors.push(`Error processing automation ${automation.id}: ${err}`)
    }
  }
}

/**
 * Process enrollments that are ready (next_step_at <= now)
 */
async function processQueue(
  supabase: ReturnType<typeof createClient>,
  summary: ProcessingSummary
) {
  const now = new Date().toISOString()

  // Get enrollments ready to process
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('automation_enrollments')
    .select(`
      id,
      automation_id,
      deal_id,
      current_step_id,
      status,
      next_step_at,
      send_as_user_id
    `)
    .eq('status', 'active')
    .lte('next_step_at', now)
    .limit(100) // Process in batches

  if (enrollmentsError) {
    summary.errors.push(`Failed to fetch enrollments queue: ${enrollmentsError.message}`)
    return
  }

  if (!enrollments || enrollments.length === 0) {
    return
  }

  for (const enrollment of enrollments) {
    try {
      // ============================================
      // Handle NULL current_step_id - attempt recovery
      // ============================================
      if (!enrollment.current_step_id) {
        // Fetch first step of the automation to reset
        const { data: firstStep } = await supabase
          .from('automation_steps')
          .select('id, delay_days, delay_hours')
          .eq('automation_id', enrollment.automation_id)
          .order('step_order', { ascending: true })
          .limit(1)
          .single()

        if (firstStep) {
          const nextStepAt = calculateNextStepTime(firstStep as AutomationStep)
          await supabase
            .from('automation_enrollments')
            .update({
              current_step_id: firstStep.id,
              next_step_at: nextStepAt.toISOString(),
            })
            .eq('id', enrollment.id)
          console.log(`Recovered enrollment ${enrollment.id} - reset to first step`)
          summary.errors.push(`Recovered enrollment ${enrollment.id} with NULL current_step_id`)
        } else {
          // No steps exist - stop the enrollment
          await stopEnrollment(supabase, enrollment, 'Automation has no steps')
          summary.enrollmentsStopped++
          console.log(`Stopped enrollment ${enrollment.id} - automation has no steps`)
        }
        continue
      }

      // ============================================
      // LOCK: Set next_step_at to NULL to prevent duplicate processing
      // Uses optimistic locking - only updates if next_step_at hasn't changed
      // ============================================
      const { data: lockResult, error: lockError } = await supabase
        .from('automation_enrollments')
        .update({ next_step_at: null })
        .eq('id', enrollment.id)
        .not('next_step_at', 'is', null) // Only if not already being processed
        .select('id')

      if (lockError || !lockResult || lockResult.length === 0) {
        console.log(`Enrollment ${enrollment.id} already being processed, skipping`)
        continue
      }

      // ============================================
      // Post-lock processing wrapped in try/catch
      // On error, release lock by setting a retry time
      // ============================================
      try {
        // ============================================
        // CHECK DEAL STATUS - Stop if deal is won or lost
        // ============================================
        const { data: deal, error: dealError } = await supabase
          .from('deals')
          .select('status')
          .eq('id', enrollment.deal_id)
          .single()

        if (dealError) {
          summary.errors.push(`Failed to fetch deal ${enrollment.deal_id}: ${dealError.message}`)
          throw new Error(`Failed to fetch deal: ${dealError.message}`)
        }

        if (deal?.status === 'won') {
          // Stop enrollment - deal was won
          await stopEnrollment(supabase, enrollment, 'Deal marked as won')
          summary.enrollmentsStopped++
          console.log(`Stopped enrollment ${enrollment.id} - deal was won`)
          continue
        }

        if (deal?.status === 'lost') {
          // Stop enrollment - deal was lost
          await stopEnrollment(supabase, enrollment, 'Deal marked as lost')
          summary.enrollmentsStopped++
          console.log(`Stopped enrollment ${enrollment.id} - deal was lost`)
          continue
        }

        // Get current step details
        const { data: currentStep, error: stepError } = await supabase
          .from('automation_steps')
          .select('*')
          .eq('id', enrollment.current_step_id)
          .single()

        if (stepError || !currentStep) {
          summary.errors.push(`Failed to fetch step ${enrollment.current_step_id}: ${stepError?.message}`)
          throw new Error(`Failed to fetch step: ${stepError?.message}`)
        }

        // Process based on step type
        switch (currentStep.step_type) {
          case 'send_email':
            await processEmailStep(supabase, enrollment, currentStep, summary)
            break

          case 'wait':
            // Wait steps just advance to next step
            break

          case 'move_to_stage':
            await processMoveToStageStep(supabase, enrollment, currentStep, summary)
            break

          case 'send_sms':
            // Log SMS for later implementation
            await logStepExecution(supabase, enrollment, currentStep, 'sent')
            break

          case 'create_deal':
            // Deal creation handled by form submission trigger
            break
        }

        summary.stepsProcessed++

        // Find next step
        const { data: nextStep, error: nextStepError } = await supabase
          .from('automation_steps')
          .select('*')
          .eq('automation_id', enrollment.automation_id)
          .eq('step_order', currentStep.step_order + 1)
          .single()

        if (nextStepError && nextStepError.code !== 'PGRST116') {
          // PGRST116 = no rows returned (no next step)
          summary.errors.push(`Failed to fetch next step: ${nextStepError.message}`)
          throw new Error(`Failed to fetch next step: ${nextStepError.message}`)
        }

        if (nextStep) {
          // Calculate next execution time based on step delays
          const nextStepAt = calculateNextStepTime(nextStep)

          // Update enrollment with next step
          const { error: updateError } = await supabase
            .from('automation_enrollments')
            .update({
              current_step_id: nextStep.id,
              next_step_at: nextStepAt.toISOString(),
            })
            .eq('id', enrollment.id)

          if (updateError) {
            summary.errors.push(`Failed to update enrollment ${enrollment.id}: ${updateError.message}`)
          }
        } else {
          // No next step - mark as completed
          const { error: completeError } = await supabase
            .from('automation_enrollments')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              next_step_at: null,
            })
            .eq('id', enrollment.id)

          if (completeError) {
            summary.errors.push(`Failed to complete enrollment ${enrollment.id}: ${completeError.message}`)
          } else {
            summary.enrollmentsCompleted++
          }
        }
      } catch (lockErr) {
        // Release lock by setting retry time (5 minutes from now)
        const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
        console.error(`Error processing enrollment ${enrollment.id}, scheduling retry at ${retryAt}:`, lockErr)
        await supabase
          .from('automation_enrollments')
          .update({ next_step_at: retryAt })
          .eq('id', enrollment.id)
      }
    } catch (err) {
      summary.errors.push(`Error processing enrollment ${enrollment.id}: ${err}`)
    }
  }
}

/**
 * Process an email step - send email via Resend
 */
async function processEmailStep(
  supabase: ReturnType<typeof createClient>,
  enrollment: AutomationEnrollment,
  step: AutomationStep,
  summary: ProcessingSummary
) {
  try {
    // Get the enrollment's enrolled_at timestamp to check for logs from THIS enrollment cycle
    const { data: enrollmentData } = await supabase
      .from('automation_enrollments')
      .select('enrolled_at')
      .eq('id', enrollment.id)
      .single()

    const enrolledAt = enrollmentData?.enrolled_at

    // Check if email was already sent (or is pending) for this enrollment + step IN THIS CYCLE
    // (logs from before the current enrolled_at are from previous cycles and should be ignored)
    let logQuery = supabase
      .from('automation_logs')
      .select('id')
      .eq('enrollment_id', enrollment.id)
      .eq('step_id', step.id)
      .in('status', ['sent', 'pending'])

    if (enrolledAt) {
      logQuery = logQuery.gte('sent_at', enrolledAt)
    }

    const { data: existingLog } = await logQuery.limit(1)

    if (existingLog && existingLog.length > 0) {
      console.log(`Email already sent for enrollment ${enrollment.id} step ${step.id} in this cycle, skipping`)
      return
    }

    if (!step.email_template_id) {
      summary.errors.push(`Email step ${step.id} has no template`)
      await logStepExecution(supabase, enrollment, step, 'failed', 'No email template configured')
      return
    }

    // Fetch deal first (without joins - they don't work reliably)
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, title, contact_id, deal_owner_id, owner_id')
      .eq('id', enrollment.deal_id)
      .single()

    if (dealError || !deal) {
      summary.errors.push(`Failed to fetch deal ${enrollment.deal_id}: ${dealError?.message || 'Not found'}`)
      await logStepExecution(supabase, enrollment, step, 'failed', `Deal not found: ${dealError?.message || 'No data'}`)
      return
    }

    // Fetch contact separately using contact_id
    let contact: { id: string; email: string; first_name: string; last_name: string; phone: string | null; country: string | null; position: string | null; club_name: string | null; graduation_year: number | null; gender: string | null; gpa: number | null; parent_name: string | null; parent_email: string | null; sport: string | null } | null = null
    if (deal.contact_id) {
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('id, email, first_name, last_name, phone, country, position, club_name, graduation_year, gender, gpa, parent_name, parent_email, sport')
        .eq('id', deal.contact_id)
        .single()

      if (contactError) {
        console.log(`Warning: Failed to fetch contact ${deal.contact_id}: ${contactError.message}`)
      } else {
        contact = contactData
      }
    }
    
    if (!contact?.email) {
      summary.errors.push(`Deal ${enrollment.deal_id} has no contact email`)
      await logStepExecution(supabase, enrollment, step, 'failed', 'No contact email')
      return
    }

    // Fetch sender profile - use send_as_user_id override if set, otherwise deal owner
    let owner: { id: string; email: string; full_name: string; phone: string | null; title: string | null; calendly_url: string | null; email_signature: string | null; avatar_url: string | null } | null = null
    const senderId = enrollment.send_as_user_id || deal.deal_owner_id || deal.owner_id
    if (senderId) {
      const { data: ownerData, error: ownerError } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, title, calendly_url, email_signature, avatar_url')
        .eq('id', senderId)
        .single()

      if (ownerError) {
        console.log(`Warning: Failed to fetch sender ${senderId}: ${ownerError.message}`)
      } else {
        owner = ownerData
      }
    }

    // Get email template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', step.email_template_id)
      .single()

    if (templateError || !template) {
      summary.errors.push(`Failed to fetch template ${step.email_template_id}: ${templateError?.message}`)
      await logStepExecution(supabase, enrollment, step, 'failed', 'Template not found')
      return
    }

    // Replace merge tags in subject and body
    const mergeData: Record<string, string | number | boolean | null | undefined> = {
      // Contact fields
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || null,
      country: contact.country || null,
      position: contact.position || null,
      club_name: contact.club_name || null,
      graduation_year: contact.graduation_year || null,
      gender: contact.gender || null,
      gpa: contact.gpa || null,
      sport: contact.sport || null,
      parent_name: contact.parent_name || null,
      parent_email: contact.parent_email || null,
      // Deal fields
      deal_title: deal.title || '',
      // Owner fields
      deal_owner_name: owner?.full_name || 'The Team',
      deal_owner_email: owner?.email || '',
      deal_owner_phone: owner?.phone || null,
      deal_owner_title: owner?.title || null,
      deal_owner_calendly: owner?.calendly_url || null,
      deal_owner_signature: owner?.email_signature || null,
      deal_owner_photo: owner?.avatar_url || null,
    }

    const subject = replaceMergeTags(template.subject, mergeData)
    const htmlBody = replaceMergeTags(template.body_html, mergeData)

    // Determine from name and reply_to
    let fromName = 'International Football Group'
    let replyTo = owner?.email || undefined

    if (template.from_name_type === 'deal_owner' && owner?.full_name) {
      fromName = owner.full_name
    } else if (template.from_name_type === 'fixed' && template.fixed_from_name) {
      fromName = template.fixed_from_name
    }

    // Get the from email (in Resend test mode, must use onboarding@resend.dev)
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'

    // Log step execution as 'pending' first (to get the log id)
    // Updated to 'sent' after successful send, or 'failed' on error
    const { data: logEntry, error: logError } = await supabase
      .from('automation_logs')
      .insert({
        enrollment_id: enrollment.id,
        step_id: step.id,
        deal_id: enrollment.deal_id,
        status: 'pending',
        log_type: 'email_sent',
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (logError) {
      summary.errors.push(`Failed to create log entry: ${logError.message}`)
    }

    // Generate tracking ID for this email
    const trackingId = crypto.randomUUID()

    // Get Resend API key and send email directly
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      summary.errors.push('RESEND_API_KEY not configured')
      await logStepExecution(supabase, enrollment, step, 'failed', 'RESEND_API_KEY not configured')
      return
    }

    const resend = new Resend(resendApiKey)

    // Send email via Resend API directly
    const { data: emailData, error: resendError } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [contact.email],
      reply_to: replyTo,
      subject: subject,
      html: htmlBody,
    })

    if (resendError) {
      console.error('Full Resend error:', JSON.stringify(resendError))
      console.error('Resend error:', resendError)
      summary.errors.push(`Failed to send email to ${contact.email}: ${resendError.message}`)
      
      // Update log entry to failed
      if (logEntry?.id) {
        await supabase
          .from('automation_logs')
          .update({
            status: 'failed',
            error_message: resendError.message,
          })
          .eq('id', logEntry.id)
      }

      // Log to email_sends table
      await supabase.from('email_sends').insert({
        tracking_id: trackingId,
        recipient_email: contact.email,
        recipient_contact_id: contact.id,
        automation_log_id: logEntry?.id,
        subject: subject,
        status: 'failed',
        error_message: resendError.message,
        sent_at: new Date().toISOString(),
      })

      return
    }

    const messageId = emailData?.id || null

    // Update log entry to 'sent' after successful send
    if (logEntry?.id) {
      await supabase
        .from('automation_logs')
        .update({ status: 'sent' })
        .eq('id', logEntry.id)
    }

    // Log successful send to email_sends table
    await supabase.from('email_sends').insert({
      tracking_id: trackingId,
      recipient_email: contact.email,
      recipient_contact_id: contact.id,
      automation_log_id: logEntry?.id,
      subject: subject,
      status: 'sent',
      resend_message_id: messageId,
      sent_at: new Date().toISOString(),
    })

    summary.emailsQueued++
    console.log(`Sent email to ${contact.email} for enrollment ${enrollment.id}, message_id: ${messageId}`)

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    summary.errors.push(`Error sending email for enrollment ${enrollment.id}: ${errorMessage}`)
    await logStepExecution(supabase, enrollment, step, 'failed', errorMessage)
  }
}

/**
 * Replace merge tags in email content
 * Supports: {{field}}, {{field|fallback}}, {{#if field}}...{{/if}}, {{#unless field}}...{{/unless}}
 */
function replaceMergeTags(content: string, data: Record<string, string | number | boolean | null | undefined>): string {
  if (!content) return ''

  let result = content

  // Process conditional blocks first
  result = processConditionalBlocks(result, data)

  // Then replace simple tags (with optional fallback)
  result = replaceSimpleTags(result, data)

  return result
}

/**
 * Process conditional blocks: {{#if}}, {{#unless}}, equals/not_equals/contains
 */
function processConditionalBlocks(template: string, data: Record<string, string | number | boolean | null | undefined>): string {
  let result = template

  // {{#if field_name equals "value"}}content{{/if}}
  const equalsPattern = /\{\{#if\s+(\w+)\s+equals\s+"([^"]+)"\}\}([\s\S]*?)\{\{\/if\}\}/gi
  result = result.replace(equalsPattern, (_, fieldName, expectedValue, content) => {
    const actualValue = data[fieldName]
    return actualValue === expectedValue ? content : ''
  })

  // {{#if field_name not_equals "value"}}content{{/if}}
  const notEqualsPattern = /\{\{#if\s+(\w+)\s+not_equals\s+"([^"]+)"\}\}([\s\S]*?)\{\{\/if\}\}/gi
  result = result.replace(notEqualsPattern, (_, fieldName, expectedValue, content) => {
    const actualValue = data[fieldName]
    return actualValue !== expectedValue ? content : ''
  })

  // {{#if field_name contains "value"}}content{{/if}}
  const containsPattern = /\{\{#if\s+(\w+)\s+contains\s+"([^"]+)"\}\}([\s\S]*?)\{\{\/if\}\}/gi
  result = result.replace(containsPattern, (_, fieldName, value, content) => {
    const fieldValue = String(data[fieldName] || '')
    return fieldValue.toLowerCase().includes(value.toLowerCase()) ? content : ''
  })

  // {{#if field_name}}content{{/if}}
  const truthyPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/gi
  result = result.replace(truthyPattern, (_, fieldName, content) => {
    const value = data[fieldName]
    return value && value !== '' ? content : ''
  })

  // {{#unless field_name}}content{{/unless}}
  const unlessPattern = /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/gi
  result = result.replace(unlessPattern, (_, fieldName, content) => {
    const value = data[fieldName]
    return !value || value === '' ? content : ''
  })

  return result
}

/**
 * Replace simple merge tags: {{field_name}} or {{field_name|fallback}}
 */
function replaceSimpleTags(template: string, data: Record<string, string | number | boolean | null | undefined>): string {
  const tagPattern = /\{\{(\w+)(?:\|([^}]+))?\}\}/g

  return template.replace(tagPattern, (_, fieldName, fallback) => {
    const value = data[fieldName]

    if (value !== null && value !== undefined && value !== '') {
      // Format currency values
      if (typeof value === 'number') {
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
          minimumFractionDigits: 0,
        }).format(value)
      }
      return String(value)
    }

    return fallback !== undefined ? fallback : ''
  })
}

/**
 * Process a move_to_stage step - update the deal's stage
 */
async function processMoveToStageStep(
  supabase: ReturnType<typeof createClient>,
  enrollment: AutomationEnrollment,
  step: AutomationStep,
  summary: ProcessingSummary
) {
  if (!step.target_stage_id) {
    summary.errors.push(`Move to stage step ${step.id} has no target_stage_id`)
    return
  }

  // Update the deal's stage
  const { error: updateError } = await supabase
    .from('deals')
    .update({ current_stage_id: step.target_stage_id })
    .eq('id', enrollment.deal_id)

  if (updateError) {
    summary.errors.push(`Failed to move deal ${enrollment.deal_id} to stage: ${updateError.message}`)
    await logStepExecution(supabase, enrollment, step, 'failed', updateError.message)
  } else {
    summary.stagesMoved++
    await logStepExecution(supabase, enrollment, step, 'sent')

    // Log deal activity
    await supabase.from('deal_activities').insert({
      deal_id: enrollment.deal_id,
      activity_type: 'stage_changed',
      description: 'Stage updated by automation',
      new_value: { stage_id: step.target_stage_id },
    })
  }
}

/**
 * Log step execution to automation_logs
 */
async function logStepExecution(
  supabase: ReturnType<typeof createClient>,
  enrollment: AutomationEnrollment,
  step: AutomationStep,
  status: 'sent' | 'failed' | 'skipped',
  errorMessage?: string
) {
  await supabase.from('automation_logs').insert({
    enrollment_id: enrollment.id,
    step_id: step.id,
    deal_id: enrollment.deal_id,
    status,
    sent_at: new Date().toISOString(),
    error_message: errorMessage || null,
  })
}

/**
 * Stop an enrollment with a given reason
 */
async function stopEnrollment(
  supabase: ReturnType<typeof createClient>,
  enrollment: AutomationEnrollment,
  reason: string
) {
  // Update enrollment status
  await supabase
    .from('automation_enrollments')
    .update({
      status: 'stopped',
      stopped_reason: reason,
      next_step_at: null,
    })
    .eq('id', enrollment.id)

  // Log the stop
  await supabase.from('automation_logs').insert({
    enrollment_id: enrollment.id,
    step_id: enrollment.current_step_id,
    deal_id: enrollment.deal_id,
    status: 'skipped',
    sent_at: new Date().toISOString(),
    log_type: 'enrollment_stopped',
    error_message: reason,
  })
}

/**
 * Calculate when the next step should execute
 */
function calculateNextStepTime(step: AutomationStep): Date {
  const now = new Date()
  const delayMs =
    (step.delay_days || 0) * 24 * 60 * 60 * 1000 +
    (step.delay_hours || 0) * 60 * 60 * 1000

  // If no delay, execute immediately
  if (delayMs === 0) {
    return now
  }

  return new Date(now.getTime() + delayMs)
}

/**
 * Check exit conditions and stop enrollments that should exit
 */
async function checkExitConditions(
  supabase: ReturnType<typeof createClient>,
  summary: ProcessingSummary
) {
  // Get active enrollments with their automation's stop conditions
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('automation_enrollments')
    .select(`
      id,
      deal_id,
      automation:automations(stop_on_stage_ids)
    `)
    .eq('status', 'active')

  if (enrollmentsError) {
    summary.errors.push(`Failed to fetch enrollments for exit check: ${enrollmentsError.message}`)
    return
  }

  if (!enrollments || enrollments.length === 0) {
    return
  }

  // Get all deal IDs to fetch their current stages
  const dealIds = enrollments.map((e) => e.deal_id)

  const { data: deals, error: dealsError } = await supabase
    .from('deals')
    .select('id, current_stage_id')
    .in('id', dealIds)

  if (dealsError) {
    summary.errors.push(`Failed to fetch deals for exit check: ${dealsError.message}`)
    return
  }

  const dealStageMap = new Map(deals?.map((d) => [d.id, d.current_stage_id]) || [])

  for (const enrollment of enrollments) {
    try {
      const automation = enrollment.automation as { stop_on_stage_ids: string[] } | null
      const stopOnStageIds = automation?.stop_on_stage_ids || []

      if (stopOnStageIds.length === 0) {
        continue
      }

      const dealStageId = dealStageMap.get(enrollment.deal_id)

      if (dealStageId && stopOnStageIds.includes(dealStageId)) {
        // Deal is in an exit stage - stop the enrollment
        const { error: stopError } = await supabase
          .from('automation_enrollments')
          .update({
            status: 'stopped',
            stopped_reason: 'Deal moved to exit stage',
            next_step_at: null,
          })
          .eq('id', enrollment.id)

        if (stopError) {
          summary.errors.push(`Failed to stop enrollment ${enrollment.id}: ${stopError.message}`)
        } else {
          summary.enrollmentsStopped++
          console.log(`Stopped enrollment ${enrollment.id} - deal moved to exit stage`)
        }
      }
    } catch (err) {
      summary.errors.push(`Error checking exit for enrollment ${enrollment.id}: ${err}`)
    }
  }
}
