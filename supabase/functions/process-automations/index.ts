// Supabase Edge Function: Process Automations
// This function handles automation triggers, processes the queue, and checks exit conditions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@2.0.0'
import Stripe from 'npm:stripe@14'
import { corsHeaders } from '../_shared/cors.ts'
import { sendSMS } from '../_shared/clicksend.ts'
import type { StepType } from '../_shared/automation-constants.ts'
import { replaceMergeTags } from '../_shared/merge-tags.ts'
import { buildOutboundMessageId, buildReplyToAddress } from '../_shared/message-id.ts'
import { fetchBrandingSlots, applyBranding } from '../_shared/branding.ts'

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
  step_type: StepType
  delay_days: number
  delay_hours: number
  email_template_id: string | null
  sms_content: string | null
  target_stage_id: string | null
  conditions: Record<string, unknown> | null
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

// Step handler signature. Handlers run the side-effect for a step type
// (send an email, move a stage, etc). Advancing the enrollment to the next
// step is handled by the caller, not by the handler.
type StepHandler = (
  supabase: ReturnType<typeof createClient>,
  enrollment: AutomationEnrollment,
  step: AutomationStep,
  summary: ProcessingSummary,
) => Promise<void>

// No-op handler for step types whose side-effect happens elsewhere
// (create_deal runs in the form webhook) or hasn't been wired up yet
// (notify, create_portal_account). Registering them here makes unknown
// step types surface via the registry lookup instead of a silent fall-through.
const noopStepHandler: StepHandler = async () => {}

const waitStepHandler: StepHandler = async () => {
  // Waits are realised by the delay on the next step's next_step_at.
  // Nothing to execute at the moment the wait step itself runs.
}

// Registry: the single source of truth mapping step_type -> execution.
// Record<StepType, ...> forces every value in STEP_TYPES to have an entry,
// so adding a new step type to the constants file fails the build here
// until a handler is registered.
const stepHandlers: Record<StepType, StepHandler> = {
  send_email: (s, e, st, sum) => processEmailStep(s, e, st, sum),
  wait: waitStepHandler,
  // wait_until_before_date is realised entirely via next_step_at, so the
  // step itself has no side effect when its time arrives — it just advances
  // to the next step (typically a send_email).
  wait_until_before_date: waitStepHandler,
  // wait_until_meeting_ends is the final marker step on meeting_scheduler
  // automations. It schedules itself for the booked meeting's end_time so
  // the enrollment completes naturally only after the meeting is over.
  wait_until_meeting_ends: waitStepHandler,
  send_sms: (s, e, st, sum) => processSMSStep(s, e, st, sum),
  move_to_stage: (s, e, st, sum) => processMoveToStageStep(s, e, st, sum),
  create_deal: noopStepHandler,
  create_invoice: (s, e, st, sum) => processCreateInvoiceStep(s, e, st, sum),
  notify: noopStepHandler,
  create_portal_account: noopStepHandler,
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
  // Reclaim any log reservations abandoned by a crashed/timed-out previous
  // run before we try to dispatch new steps. Without this, the unique index
  // would keep blocking re-sends for enrolments whose pending log never
  // resolved.
  await sweepStalePending(supabase)

  // Unstick any enrollments parked on a wait_until_before_date step whose
  // deal date is now populated.
  await sweepBeforeDateWaits(supabase, summary)

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
          // Recovery path: first step almost always has an immediate or
          // fixed delay; if it happens to be wait_until_before_date and we
          // can't resolve it here, leave next_step_at null so the sweep
          // picks it up.
          const nextStepAt = calculateNextStepTime(firstStep as AutomationStep)
          await supabase
            .from('automation_enrollments')
            .update({
              current_step_id: firstStep.id,
              next_step_at: nextStepAt ? nextStepAt.toISOString() : null,
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

        // ============================================
        // STOP-ON-PAYMENT - Halt deposit/invoice sequences once any related
        // invoice on this deal flips to 'paid'. The flag is set per
        // automation in config.stop_on_payment (Deposit Invoice template).
        // ============================================
        const { data: automationMeta } = await supabase
          .from('automations')
          .select('config')
          .eq('id', enrollment.automation_id)
          .single()

        const automationCfg = automationMeta?.config as {
          stop_on_payment?: boolean
          paid_stage_id?: string | null
          unpaid_stage_id?: string | null
          activated_stage_id?: string | null
          // Recurring loop (e.g. Dormant reminder every 3 weeks). When the
          // sequence runs out of steps, instead of completing, jump back to
          // `recurring_loop_to_order` and reschedule — indefinitely, as long
          // as the deal is still parked in `recurring_anchor_stage_id`.
          recurring?: boolean
          recurring_loop_to_order?: number
          recurring_anchor_stage_id?: string | null
        } | null

        // Welcome Sequence — exit + stage move once the player has
        // activated their portal account (profiles.password_set_at set).
        // Looked up via the deal's contact: profiles row joined on
        // contact_id. This runs before stepping so a player who just
        // activated doesn't receive the next email in the sequence.
        if (automationCfg?.activated_stage_id) {
          const { data: dealRow } = await supabase
            .from('deals')
            .select('contact_id')
            .eq('id', enrollment.deal_id)
            .single()
          if (dealRow?.contact_id) {
            const { data: portalProfile } = await supabase
              .from('profiles')
              .select('password_set_at')
              .eq('contact_id', dealRow.contact_id)
              .eq('role', 'player')
              .maybeSingle()
            if (portalProfile?.password_set_at) {
              await supabase
                .from('deals')
                .update({
                  current_stage_id: automationCfg.activated_stage_id,
                  stage_changed_at: new Date().toISOString(),
                })
                .eq('id', enrollment.deal_id)
              await supabase.from('deal_activities').insert({
                deal_id: enrollment.deal_id,
                activity_type: 'stage_changed',
                description: 'Auto-moved to activated stage by welcome_sequence automation (player activated portal)',
                metadata: {
                  automation_id: enrollment.automation_id,
                  reason: 'portal_activated',
                },
              })
              summary.stagesMoved++
              await stopEnrollment(supabase, enrollment, 'Player portal activated')
              summary.enrollmentsStopped++
              continue
            }
          }
        }
        const stopOnPayment = automationCfg?.stop_on_payment === true
        if (stopOnPayment) {
          // Only count payments that landed AFTER the enrollment started.
          // Without the paid_at filter, a deal carrying any historical
          // paid invoice (e.g. an application fee paid months ago) would
          // make every fresh deposit-reminder enrollment stop on its
          // first cron tick, before any reminder could fire.
          const { data: paidInvoices } = await supabase
            .from('invoices')
            .select('id, paid_at')
            .eq('deal_id', enrollment.deal_id)
            .eq('status', 'paid')
            .gte('paid_at', enrollment.enrolled_at)
            .limit(1)

          if (paidInvoices && paidInvoices.length > 0) {
            // If the user configured a "paid" landing stage on this
            // automation, move the deal there before stopping. Logged via
            // deal_activities so the stage move is auditable.
            if (automationCfg?.paid_stage_id) {
              await supabase
                .from('deals')
                .update({
                  current_stage_id: automationCfg.paid_stage_id,
                  stage_changed_at: new Date().toISOString(),
                })
                .eq('id', enrollment.deal_id)
              await supabase.from('deal_activities').insert({
                deal_id: enrollment.deal_id,
                activity_type: 'stage_changed',
                description: 'Auto-moved to paid stage by deposit_invoice automation',
                metadata: {
                  automation_id: enrollment.automation_id,
                  reason: 'deposit_paid',
                },
              })
              summary.stagesMoved++
            }
            await stopEnrollment(supabase, enrollment, 'Deposit paid')
            summary.enrollmentsStopped++
            console.log(`Stopped enrollment ${enrollment.id} - deposit invoice paid`)
            continue
          }
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

        // Dispatch to the registered handler for this step type. The registry
        // is the single place that maps a step_type value to its execution.
        const handler = stepHandlers[currentStep.step_type]
        if (!handler) {
          summary.errors.push(
            `No handler registered for step type "${currentStep.step_type}" (step ${currentStep.id})`,
          )
        } else {
          await handler(supabase, enrollment, currentStep, summary)
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
          // For date-relative wait steps, fetch the source data so
          // calculateNextStepTime can resolve the offset. For other step
          // types these lookups are unused but cheap.
          let dealFields: Record<string, unknown> | null = null
          let meetingEndTime: string | null = null
          if (nextStep.step_type === 'wait_until_before_date') {
            const { data: dealRow } = await supabase
              .from('deals')
              .select('interview_date, programme_start_date, arrival_date')
              .eq('id', enrollment.deal_id)
              .single()
            dealFields = dealRow as Record<string, unknown> | null
          }
          if (nextStep.step_type === 'wait_until_meeting_ends') {
            const { data: meetingRow } = await supabase
              .from('calendly_events')
              .select('end_time')
              .eq('deal_id', enrollment.deal_id)
              .eq('status', 'scheduled')
              .order('start_time', { ascending: false })
              .limit(1)
              .maybeSingle()
            meetingEndTime = meetingRow?.end_time ?? null
          }
          const nextStepAt = calculateNextStepTime(nextStep, dealFields, meetingEndTime)

          // Update enrollment with next step. If nextStepAt is null
          // (wait_until_before_date with no field set), park the
          // enrollment — sweepBeforeDateWaits() will unstick it once the
          // deal field is populated.
          const { error: updateError } = await supabase
            .from('automation_enrollments')
            .update({
              current_step_id: nextStep.id,
              next_step_at: nextStepAt ? nextStepAt.toISOString() : null,
            })
            .eq('id', enrollment.id)

          if (updateError) {
            summary.errors.push(`Failed to update enrollment ${enrollment.id}: ${updateError.message}`)
          }
        } else {
          // No next step. If this automation is recurring AND the deal is
          // still parked in the anchor stage, loop back to the configured
          // step instead of completing. Powers the Dormant reminder cadence:
          // wait 3 weeks → reminder → loop, forever, until the deal leaves
          // Dormant (recruiter move or reply→exit) or is manually unenrolled.
          //
          // The anchor check happens HERE — right before re-arming the next
          // send — so a deal that has left Dormant during the wait window
          // never receives another reminder.
          let looped = false
          if (
            automationCfg?.recurring === true &&
            typeof automationCfg.recurring_loop_to_order === 'number'
          ) {
            const anchorStageId = automationCfg.recurring_anchor_stage_id ?? null
            let stillAnchored = true
            if (anchorStageId) {
              const { data: dealStageRow } = await supabase
                .from('deals')
                .select('current_stage_id')
                .eq('id', enrollment.deal_id)
                .single()
              stillAnchored = dealStageRow?.current_stage_id === anchorStageId
            }

            if (stillAnchored) {
              const { data: loopStep } = await supabase
                .from('automation_steps')
                .select('*')
                .eq('automation_id', enrollment.automation_id)
                .eq('step_order', automationCfg.recurring_loop_to_order)
                .single()

              if (loopStep) {
                const loopAt = calculateNextStepTime(loopStep as AutomationStep)
                const { error: loopError } = await supabase
                  .from('automation_enrollments')
                  .update({
                    current_step_id: loopStep.id,
                    next_step_at: loopAt ? loopAt.toISOString() : new Date().toISOString(),
                  })
                  .eq('id', enrollment.id)

                if (loopError) {
                  summary.errors.push(`Failed to loop recurring enrollment ${enrollment.id}: ${loopError.message}`)
                } else {
                  looped = true
                }
              }
            } else {
              // Deal has left the anchor stage (e.g. recruiter moved it out of
              // Dormant). Stop the loop, but DON'T let the deal be moved: mark
              // the enrollment stopped with a 'Manual'-prefixed reason, which
              // move_deal_on_enrollment_exit (migration 091) deliberately
              // ignores. Without the prefix, the 'completed'/'stopped' paths
              // would re-route the deal to no_reply_stage_id / exit_to_stage_id
              // and yank it back out of wherever the recruiter just put it.
              await supabase
                .from('automation_enrollments')
                .update({
                  status: 'stopped',
                  stopped_reason: 'Manual: deal left Dormant — recurring reminder ended',
                  next_step_at: null,
                })
                .eq('id', enrollment.id)
              summary.enrollmentsStopped++
              looped = true // handled — skip the completion path below
            }
          }

          if (looped) {
            // Re-armed for the next cycle — skip completion + final-stage logic.
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

          // Deposit-invoice flow specifically: if all reminders fired and
          // no invoice ever flipped to 'paid', move the deal to the
          // configured "unpaid" landing stage. We re-check paid status
          // here (rather than trusting the earlier check) because an
          // invoice could have been paid since the last cron tick.
          if (automationCfg?.unpaid_stage_id) {
            const { data: paidNow } = await supabase
              .from('invoices')
              .select('id')
              .eq('deal_id', enrollment.deal_id)
              .eq('status', 'paid')
              .limit(1)

            const noPayment = !paidNow || paidNow.length === 0
            if (noPayment) {
              await supabase
                .from('deals')
                .update({
                  current_stage_id: automationCfg.unpaid_stage_id,
                  stage_changed_at: new Date().toISOString(),
                })
                .eq('id', enrollment.deal_id)
              await supabase.from('deal_activities').insert({
                deal_id: enrollment.deal_id,
                activity_type: 'stage_changed',
                description: 'Auto-moved to unpaid stage by deposit_invoice automation (sequence completed without payment)',
                metadata: {
                  automation_id: enrollment.automation_id,
                  reason: 'no_payment_after_sequence',
                },
              })
              summary.stagesMoved++
            }
          }
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
    // Pull enrolled_at for this cycle. It is written into each log row as
    // enrolled_at_snapshot so the dedup unique index can distinguish re-enrolment
    // cycles that share the same enrollment_id.
    const { data: enrollmentData } = await supabase
      .from('automation_enrollments')
      .select('enrolled_at')
      .eq('id', enrollment.id)
      .single()

    const enrolledAt: string | null = enrollmentData?.enrolled_at ?? null

    if (!step.email_template_id) {
      summary.errors.push(`Email step ${step.id} has no template`)
      await logStepExecution(supabase, enrollment, step, 'failed', 'No email template configured', enrolledAt)
      return
    }

    // Fetch deal first (without joins - they don't work reliably)
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, title, contact_id, deal_owner_id, owner_id, interview_date')
      .eq('id', enrollment.deal_id)
      .single()

    if (dealError || !deal) {
      summary.errors.push(`Failed to fetch deal ${enrollment.deal_id}: ${dealError?.message || 'Not found'}`)
      await logStepExecution(supabase, enrollment, step, 'failed', `Deal not found: ${dealError?.message || 'No data'}`, enrolledAt)
      return
    }

    // Fetch contact separately using contact_id
    let contact: { id: string; email: string; first_name: string; last_name: string; phone: string | null; country: string | null; position: string | null; club_name: string | null; graduation_year: number | null; gender: string | null; gpa: number | null; parent_name: string | null; parent_email: string | null; sport: string | null; subscription_status: string | null } | null = null
    if (deal.contact_id) {
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('id, email, first_name, last_name, phone, country, position, club_name, graduation_year, gender, gpa, parent_name, parent_email, sport, subscription_status')
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
      await logStepExecution(supabase, enrollment, step, 'failed', 'No contact email', enrolledAt)
      return
    }

    // Skip unsubscribed or bounced contacts
    if (contact.subscription_status && contact.subscription_status !== 'subscribed') {
      console.log(`Skipping email for enrollment ${enrollment.id} - contact ${contact.email} is ${contact.subscription_status}`)
      await logStepExecution(supabase, enrollment, step, 'skipped', `Contact is ${contact.subscription_status}`, enrolledAt)
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
      await logStepExecution(supabase, enrollment, step, 'failed', 'Template not found', enrolledAt)
      return
    }

    // Look up the deal's most recent scheduled Calendly meeting so reminder
    // templates can render the live join link, time, and event name. Best-
    // effort — if the deal has no booked meeting yet, the merge tags fall
    // back to whatever default the template author specified.
    let meeting: {
      start_time: string
      join_url: string | null
      event_name: string | null
      location: string | null
    } | null = null
    {
      const { data: meetingData } = await supabase
        .from('calendly_events')
        .select('start_time, join_url, event_name, location')
        .eq('deal_id', deal.id)
        .eq('status', 'scheduled')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (meetingData) meeting = meetingData as typeof meeting
    }

    // Look up the deal's most recent unpaid invoice so payment-reminder
    // templates can render a working "Pay invoice" button. We hit /pay/<id>
    // (a public route handler) which forwards to a fresh Stripe Checkout
    // Session. APP_URL is the deployed Next.js host; falls back to local
    // for dev.
    let unpaidInvoice: {
      id: string
      invoice_number: string
      amount: number
      currency: string | null
      due_date: string | null
    } | null = null
    {
      // Prefer overdue invoices over merely-sent ones, then break ties
      // by most-recent created. So a Payment Overdue email always
      // points at an actually-overdue invoice when the deal has one.
      const { data: overdueRow } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount, currency, due_date')
        .eq('deal_id', deal.id)
        .eq('status', 'overdue')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (overdueRow) {
        unpaidInvoice = overdueRow as typeof unpaidInvoice
      } else {
        const { data: sentRow } = await supabase
          .from('invoices')
          .select('id, invoice_number, amount, currency, due_date')
          .eq('deal_id', deal.id)
          .eq('status', 'sent')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (sentRow) unpaidInvoice = sentRow as typeof unpaidInvoice
      }
    }
    const appUrl =
      Deno.env.get('NEXT_PUBLIC_APP_URL') || Deno.env.get('APP_URL') || ''
    const invoicePaymentLink = unpaidInvoice
      ? `${appUrl}/pay/${unpaidInvoice.id}`
      : null
    const invoiceAmountFormatted = unpaidInvoice
      ? new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: unpaidInvoice.currency || 'GBP',
        }).format(Number(unpaidInvoice.amount))
      : null
    const invoiceDueDateFormatted = unpaidInvoice?.due_date
      ? new Date(unpaidInvoice.due_date).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null

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
      interview_date: deal.interview_date ? formatMeetingDate(deal.interview_date) : null,
      // Meeting (Calendly) fields
      schedule_link: owner?.calendly_url || null,
      meeting_link: meeting?.join_url || null,
      meeting_time: meeting?.start_time ? formatMeetingDate(meeting.start_time) : null,
      meeting_event_name: meeting?.event_name || null,
      meeting_location: meeting?.location || null,
      // Invoice fields — resolved from the deal's most recent unpaid
      // invoice. invoice_payment_link routes through /pay/<id> which
      // mints a Stripe Checkout Session and redirects.
      invoice_payment_link: invoicePaymentLink,
      invoice_number: unpaidInvoice?.invoice_number || null,
      invoice_amount: invoiceAmountFormatted,
      invoice_due_date: invoiceDueDateFormatted,
      // Owner fields. Null (not 'The Team') for unowned deals so the
      // recruiter_signature block's `{{deal_owner_*|Nathan Bibby}}`
      // fallbacks fire — orphan deals then render as if Nathan sent
      // them, matching the AC behaviour where Nathan is the catch-all.
      deal_owner_name: owner?.full_name || null,
      deal_owner_email: owner?.email || null,
      deal_owner_phone: owner?.phone || null,
      deal_owner_title: owner?.title || null,
      deal_owner_calendly: owner?.calendly_url || null,
      deal_owner_signature: owner?.email_signature || null,
      deal_owner_photo: owner?.avatar_url || null,
    }

    const subject = replaceMergeTags(template.subject, mergeData)
    // Stitch the global header/footer in BEFORE merge tags run — the stored
    // branding HTML carries unresolved {{deal_owner_*}} tags so the signature
    // personalises to this deal's owner. A null slots value (settings missing
    // or unreadable) leaves the template exactly as saved rather than risking
    // a blank email.
    const brandingSlots = await fetchBrandingSlots(supabase)
    const htmlBody = replaceMergeTags(applyBranding(template.body_html, brandingSlots), mergeData)

    // Determine from name and reply_to.
    //
    // Reply-To routing: when INBOUND_REPLY_DOMAIN is set (e.g.
    // reply.theinternationalfootballgroup.com), replies are routed to that
    // subdomain — whose MX points at Resend Inbound — so the resend-inbound
    // edge function can ingest them, thread them via In-Reply-To, and stop
    // the automation if exit_on_reply is enabled.
    //
    // When INBOUND_REPLY_DOMAIN is unset, Reply-To falls back to the deal
    // owner's email (legacy behaviour: replies go directly to the owner's
    // mailbox, the CRM never sees them).
    // Reply-To uses VERP-style sub-addressing (replies+{tracking_id}@reply.<domain>)
    // — built later, once the trackingId for THIS send is generated. Decide the
    // fallback now so we know whether to override below.
    // FROM display name. For deal_owner-typed templates, fall back to
    // Nathan Bibby (the canonical IFG fallback recruiter) when the deal
    // has no owner — mirrors the body sig fallback in render-html.ts so
    // the FROM line and the signature stay coherent for orphan deals.
    let fromName = 'International Football Group'

    if (template.from_name_type === 'deal_owner') {
      fromName = owner?.full_name || 'Nathan Bibby'
    } else if (template.from_name_type === 'fixed' && template.fixed_from_name) {
      fromName = template.fixed_from_name
    }

    // Send AS the deal owner. Resend allows any address on a verified domain,
    // so max@theinternationalfootballgroup.com etc. all work without per-user
    // setup once the domain is verified. Falls back to the global FROM_EMAIL
    // if the deal has no owner (or owner profile has no email).
    const fromEmail = owner?.email || Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'

    // Reserve the log slot BEFORE calling Resend. The partial unique index on
    // automation_logs_dedup_active makes this insert the authoritative lock:
    // if another worker already holds it for this (enrollment, step, cycle),
    // the insert raises 23505 and we bail out instead of double-sending.
    const reservation = await reserveLogSlot(supabase, enrollment, step, enrolledAt, 'email_sent')
    if (reservation === 'conflict') {
      console.log(`Skip: log slot already reserved for enrollment ${enrollment.id} step ${step.id} in this cycle`)
      return
    }
    const logEntryId = reservation.logId

    // Generate tracking ID for this email. Used twice: once as the local part
    // of the Reply-To we set below (so the inbound webhook can recover it from
    // the contact's reply), and once as the email_sends.tracking_id value.
    const trackingId = crypto.randomUUID()
    const trackingReplyTo = buildReplyToAddress(trackingId, `${fromName} at IFG`)
    const replyTo: string | undefined = trackingReplyTo ?? owner?.email ?? undefined

    // Get Resend API key and send email directly
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      summary.errors.push('RESEND_API_KEY not configured')
      await supabase
        .from('automation_logs')
        .update({ status: 'failed', error_message: 'RESEND_API_KEY not configured' })
        .eq('id', logEntryId)
      return
    }

    const resend = new Resend(resendApiKey)

    // Send email via Resend API directly. We set our own Message-ID header
    // (using trackingId as the local part) so a contact's reply lands with
    // an In-Reply-To value we can directly look up in email_sends — no
    // UUID-fishing in headers, no fallback heuristics needed.
    const { data: emailData, error: resendError } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [contact.email],
      reply_to: replyTo,
      subject: subject,
      html: htmlBody,
      headers: {
        'Message-ID': buildOutboundMessageId(trackingId),
      },
    })

    if (resendError) {
      console.error('Full Resend error:', JSON.stringify(resendError))
      console.error('Resend error:', resendError)
      summary.errors.push(`Failed to send email to ${contact.email}: ${resendError.message}`)

      // Drop the reservation to 'failed' so retries (with a fresh pending row)
      // are not blocked by the partial unique index.
      await supabase
        .from('automation_logs')
        .update({
          status: 'failed',
          error_message: resendError.message,
        })
        .eq('id', logEntryId)

      // Log to email_sends table
      await supabase.from('email_sends').insert({
        tracking_id: trackingId,
        recipient_email: contact.email,
        recipient_contact_id: contact.id,
        automation_log_id: logEntryId,
        subject: subject,
        body_html: htmlBody,
        from_name: fromName,
        from_email: fromEmail,
        status: 'failed',
        error_message: resendError.message,
        sent_at: new Date().toISOString(),
      })

      return
    }

    const messageId = emailData?.id || null

    // Finalize the reservation to 'sent'.
    await supabase
      .from('automation_logs')
      .update({ status: 'sent', email_message_id: messageId })
      .eq('id', logEntryId)

    // Log successful send to email_sends table
    await supabase.from('email_sends').insert({
      tracking_id: trackingId,
      recipient_email: contact.email,
      recipient_contact_id: contact.id,
      automation_log_id: logEntryId,
      subject: subject,
      body_html: htmlBody,
      from_name: fromName,
      from_email: fromEmail,
      status: 'sent',
      resend_message_id: messageId,
      sent_at: new Date().toISOString(),
    })

    summary.emailsQueued++

    // ============================================
    // notify_parent — Application Received template (#5) sends a parallel
    // copy of the email to the contact's parent_email when the automation's
    // config.notify_parent flag is set. Failures here do NOT block the
    // primary send (it already went through).
    // ============================================
    try {
      const { data: automationCfg } = await supabase
        .from('automations')
        .select('config')
        .eq('id', enrollment.automation_id)
        .single()

      const cfg = (automationCfg?.config ?? {}) as { notify_parent?: boolean; create_portal_account?: boolean }
      const notifyParent = cfg.notify_parent === true
      if (notifyParent && contact.parent_email) {
        const parentSubject = `[Parent Copy] ${subject}`
        const parentTrackingId = crypto.randomUUID()
        const { data: parentEmailData, error: parentSendError } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [contact.parent_email],
          reply_to: replyTo,
          subject: parentSubject,
          html: htmlBody,
          headers: {
            'Message-ID': buildOutboundMessageId(parentTrackingId),
          },
        })

        if (parentSendError) {
          console.warn(`notify_parent: copy to ${contact.parent_email} failed:`, parentSendError.message)
        } else {
          // Track the parent copy as its own email_sends row so it shows up
          // in metrics and so a parent's reply could thread back.
          await supabase.from('email_sends').insert({
            tracking_id: parentTrackingId,
            recipient_email: contact.parent_email,
            recipient_contact_id: contact.id,
            automation_log_id: logEntryId,
            subject: parentSubject,
            body_html: htmlBody,
            from_name: fromName,
            from_email: fromEmail,
            status: 'sent',
            resend_message_id: parentEmailData?.id || null,
            sent_at: new Date().toISOString(),
          })
          console.log(`notify_parent: copy delivered to ${contact.parent_email}`)
        }
      }
    } catch (notifyErr) {
      console.warn('notify_parent: unexpected error', notifyErr)
    }

    // ============================================
    // create_portal_account — Welcome Sequence template (#10) provisions a
    // player_portal account for the contact when the automation's
    // config.create_portal_account flag is set. Mirrors the manual flow at
    // app/api/portal/invite/route.ts. Idempotent: a player profile or a
    // pending invite for this contact short-circuits the call.
    // ============================================
    try {
      const { data: automationCfg2 } = await supabase
        .from('automations')
        .select('config')
        .eq('id', enrollment.automation_id)
        .single()

      const createPortal = (automationCfg2?.config as { create_portal_account?: boolean } | null)?.create_portal_account === true
      if (createPortal && contact.email) {
        // Already a player? skip.
        const { data: existingPlayer } = await supabase
          .from('profiles')
          .select('id')
          .eq('contact_id', contact.id)
          .eq('role', 'player')
          .maybeSingle()

        // Pending invite already in flight? skip.
        const { data: pendingInvite } = await supabase
          .from('player_invites')
          .select('id')
          .eq('contact_id', contact.id)
          .eq('status', 'pending')
          .maybeSingle()

        if (!existingPlayer && !pendingInvite) {
          const { error: portalInviteError } = await supabase.auth.admin.inviteUserByEmail(
            contact.email,
            {
              data: {
                full_name: `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || contact.email,
                role: 'player',
                contact_id: contact.id,
              },
              redirectTo: `${Deno.env.get('NEXT_PUBLIC_APP_URL') ?? ''}/auth/callback`,
            },
          )

          if (portalInviteError) {
            console.warn(`create_portal_account: invite failed for ${contact.email}: ${portalInviteError.message}`)
          } else {
            await supabase.from('player_invites').insert({
              contact_id: contact.id,
              email: contact.email,
              invited_by: enrollment.send_as_user_id ?? null,
            })
            console.log(`create_portal_account: portal invite sent to ${contact.email}`)
          }
        } else {
          console.log(`create_portal_account: skipped — existing player profile or pending invite for ${contact.email}`)
        }
      }
    } catch (portalErr) {
      console.warn('create_portal_account: unexpected error', portalErr)
    }
    console.log(`Sent email to ${contact.email} for enrollment ${enrollment.id}, message_id: ${messageId}`)

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    summary.errors.push(`Error sending email for enrollment ${enrollment.id}: ${errorMessage}`)
    await logStepExecution(supabase, enrollment, step, 'failed', errorMessage)
  }
}

/**
 * Process an SMS step - send SMS via ClickSend
 */
async function processSMSStep(
  supabase: ReturnType<typeof createClient>,
  enrollment: AutomationEnrollment,
  step: AutomationStep,
  summary: ProcessingSummary
) {
  try {
    // Check for duplicate send in this enrollment cycle
    const { data: enrollmentData } = await supabase
      .from('automation_enrollments')
      .select('enrolled_at')
      .eq('id', enrollment.id)
      .single()

    const enrolledAt = enrollmentData?.enrolled_at

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
      console.log(`SMS already sent for enrollment ${enrollment.id} step ${step.id} in this cycle, skipping`)
      return
    }

    if (!step.sms_content) {
      summary.errors.push(`SMS step ${step.id} has no content`)
      await logStepExecution(supabase, enrollment, step, 'failed', 'No SMS content configured')
      return
    }

    // Fetch deal
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

    // Fetch contact
    let contact: { id: string; first_name: string; last_name: string; email: string; phone: string | null; sms_subscribed: boolean; country: string | null; position: string | null; club_name: string | null; graduation_year: number | null; sport: string | null } | null = null
    if (deal.contact_id) {
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, sms_subscribed, country, position, club_name, graduation_year, sport')
        .eq('id', deal.contact_id)
        .single()

      if (contactError) {
        console.log(`Warning: Failed to fetch contact ${deal.contact_id}: ${contactError.message}`)
      } else {
        contact = contactData
      }
    }

    if (!contact?.phone) {
      summary.errors.push(`Deal ${enrollment.deal_id} has no contact phone number`)
      await logStepExecution(supabase, enrollment, step, 'failed', 'No contact phone number')
      return
    }

    // Check sms_subscribed
    if (contact.sms_subscribed === false) {
      console.log(`Skipping SMS for enrollment ${enrollment.id} - contact ${contact.phone} is not SMS subscribed`)
      await logStepExecution(supabase, enrollment, step, 'skipped', 'Contact not SMS subscribed')
      return
    }

    // Fetch sender profile for merge data
    let owner: { full_name: string; email: string; phone: string | null; title: string | null; calendly_url: string | null } | null = null
    const senderId = enrollment.send_as_user_id || deal.deal_owner_id || deal.owner_id
    if (senderId) {
      const { data: ownerData } = await supabase
        .from('profiles')
        .select('full_name, email, phone, title, calendly_url')
        .eq('id', senderId)
        .single()
      owner = ownerData
    }

    // Build merge data and replace tags
    const mergeData: Record<string, string | number | boolean | null | undefined> = {
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || null,
      country: contact.country || null,
      position: contact.position || null,
      club_name: contact.club_name || null,
      graduation_year: contact.graduation_year || null,
      sport: contact.sport || null,
      deal_title: deal.title || '',
      // SMS path mirrors the email path — null for unowned so any
      // {{deal_owner_*|fallback}} merge tags in SMS templates can fire.
      deal_owner_name: owner?.full_name || null,
      deal_owner_email: owner?.email || null,
      deal_owner_phone: owner?.phone || null,
      deal_owner_calendly: owner?.calendly_url || null,
    }

    const processedContent = replaceMergeTags(step.sms_content, mergeData)

    // Log step execution as 'pending' first
    const { data: logEntry, error: logError } = await supabase
      .from('automation_logs')
      .insert({
        enrollment_id: enrollment.id,
        step_id: step.id,
        deal_id: enrollment.deal_id,
        status: 'pending',
        log_type: 'sms_sent',
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (logError) {
      summary.errors.push(`Failed to create log entry: ${logError.message}`)
    }

    // Send SMS via ClickSend
    const smsResult = await sendSMS({
      to: contact.phone,
      body: processedContent,
      source: `automation-${enrollment.automation_id}`,
    })

    if (smsResult.success) {
      // Update log entry to 'sent'
      if (logEntry?.id) {
        await supabase
          .from('automation_logs')
          .update({ status: 'sent' })
          .eq('id', logEntry.id)
      }

      // Log to sms_sends table
      await supabase.from('sms_sends').insert({
        recipient_phone: contact.phone,
        recipient_contact_id: contact.id,
        automation_log_id: logEntry?.id,
        content: processedContent,
        status: 'sent',
        clicksend_message_id: smsResult.message_id,
        segments: smsResult.segments || 1,
        sent_at: new Date().toISOString(),
      })

      console.log(`Sent SMS to ${contact.phone} for enrollment ${enrollment.id}, message_id: ${smsResult.message_id}`)
    } else {
      const errorMsg = smsResult.error || 'SMS send failed'
      summary.errors.push(`Failed to send SMS to ${contact.phone}: ${errorMsg}`)

      // Update log entry to failed
      if (logEntry?.id) {
        await supabase
          .from('automation_logs')
          .update({ status: 'failed', error_message: errorMsg })
          .eq('id', logEntry.id)
      }

      // Log failed send
      await supabase.from('sms_sends').insert({
        recipient_phone: contact.phone,
        recipient_contact_id: contact.id,
        automation_log_id: logEntry?.id,
        content: processedContent,
        status: 'failed',
        error_message: errorMsg,
        sent_at: new Date().toISOString(),
      })
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    summary.errors.push(`Error sending SMS for enrollment ${enrollment.id}: ${errorMessage}`)
    await logStepExecution(supabase, enrollment, step, 'failed', errorMessage)
  }
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
 * Handle a `create_invoice` step. Reads the deal + automation config,
 * computes the invoice amount from the configured source (full deal_value /
 * percentage / custom), and inserts an invoice with status='sent'. The
 * existing on_invoice_sent trigger (migration 109) will then enrol the deal
 * into any deposit_invoice automation on the same pipeline so payment-link
 * emails go out automatically.
 *
 * deal_value is read BEFORE the insert because the on_invoice_change_recalc
 * trigger (migration 110) overwrites deal_value to SUM(sent+paid invoices)
 * post-insert — so reading after the insert would give us the freshly-set
 * invoice amount instead of the programme's list price.
 */
async function processCreateInvoiceStep(
  supabase: ReturnType<typeof createClient>,
  enrollment: AutomationEnrollment,
  step: AutomationStep,
  summary: ProcessingSummary
) {
  // Pull deal (need value, contact, owner)
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, title, contact_id, deal_owner_id, owner_id, deal_value')
    .eq('id', enrollment.deal_id)
    .single()

  if (dealError || !deal) {
    summary.errors.push(`create_invoice: deal ${enrollment.deal_id} not found: ${dealError?.message || 'no data'}`)
    await logStepExecution(supabase, enrollment, step, 'failed', `Deal not found: ${dealError?.message || 'no data'}`)
    return
  }

  // Pull automation name + config
  const { data: automationMeta } = await supabase
    .from('automations')
    .select('name, config')
    .eq('id', enrollment.automation_id)
    .single()

  const cfg = (automationMeta?.config ?? {}) as {
    invoice_amount_source?: 'deal_value' | 'percentage' | 'custom'
    invoice_amount_percent?: number
    invoice_amount_custom?: number
    invoice_type?: 'deposit' | 'installment' | 'full_payment' | 'meal_plan' | 'trip' | 'other'
    invoice_due_in_days?: number
    invoice_description?: string
  }

  // Compute amount
  const dealValue = Number(deal.deal_value ?? 0)
  let amount: number
  switch (cfg.invoice_amount_source) {
    case 'percentage': {
      const pct = Number(cfg.invoice_amount_percent ?? 0)
      amount = Math.round((dealValue * pct) / 100 * 100) / 100
      break
    }
    case 'custom':
      amount = Number(cfg.invoice_amount_custom ?? 0)
      break
    case 'deal_value':
    default:
      amount = dealValue
      break
  }

  // Guardrail: refuse to create a £0 invoice. Almost always means the deal
  // landed without a value (deal_creation automation missing default_deal_value).
  if (!amount || amount <= 0) {
    const reason = `Invoice amount resolved to ${amount} for deal ${deal.id} (source=${cfg.invoice_amount_source ?? 'deal_value'}, deal_value=${dealValue}). Set a Default Deal Value on the Deal Creation automation, or configure a custom amount on this Invoice Generation automation.`
    summary.errors.push(`create_invoice: ${reason}`)
    await logStepExecution(supabase, enrollment, step, 'failed', reason)
    return
  }

  const ownerId = deal.deal_owner_id || deal.owner_id
  if (!ownerId) {
    const reason = `create_invoice: deal ${deal.id} has no owner — cannot set invoices.created_by_id`
    summary.errors.push(reason)
    await logStepExecution(supabase, enrollment, step, 'failed', reason)
    return
  }

  // Default due window is 14 days (was 7) — matches the default email
  // cadence of the merged Invoice Generation & Reminders template, where
  // reminder #2 lands at T+14 / on the due date itself.
  const dueDays = Number.isFinite(Number(cfg.invoice_due_in_days))
    ? Number(cfg.invoice_due_in_days)
    : 14
  const dueDate = new Date()
  dueDate.setUTCDate(dueDate.getUTCDate() + dueDays)
  const dueDateStr = dueDate.toISOString().slice(0, 10)

  const description =
    cfg.invoice_description?.trim() ||
    `${automationMeta?.name || 'Invoice'} — ${deal.title}`

  const nowIso = new Date().toISOString()

  // Insert with status='sent' so on_invoice_sent (migration 109) chains
  // into the Deposit Invoice automation. invoice_number is filled by the
  // generate_invoice_number BEFORE INSERT trigger.
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      contact_id: deal.contact_id,
      deal_id: deal.id,
      type: cfg.invoice_type || 'deposit',
      description,
      amount,
      status: 'sent',
      due_date: dueDateStr,
      sent_at: nowIso,
      created_by_id: ownerId,
    })
    .select('id, invoice_number')
    .single()

  if (invoiceError || !invoice) {
    const msg = `Failed to create invoice for deal ${deal.id}: ${invoiceError?.message || 'no data'}`
    summary.errors.push(msg)
    await logStepExecution(supabase, enrollment, step, 'failed', msg)
    return
  }

  // Send the system-baked Stripe-payment-link email — same one the manual
  // "Send Invoice" button uses (app/api/invoices/[id]/send-with-link).
  // This is the FIRST email in the merged Invoice Generation & Reminders
  // flow; subsequent reminders use the user-picked templates from the
  // automation's email steps.
  //
  // Failures here only log a warning — the invoice row already landed
  // and is recoverable manually from the Invoices page if needed.
  await sendInvoicePaymentLinkEmail(supabase, {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    amount,
    description,
    dealId: deal.id,
    contactId: deal.contact_id,
    dueDateStr,
  }).catch((err) => {
    summary.errors.push(`create_invoice email: ${err instanceof Error ? err.message : String(err)}`)
  })

  await logStepExecution(supabase, enrollment, step, 'sent')

  // Surface in the deal's activity feed so recruiters can see the automation
  // issued the invoice (mirrors how processMoveToStageStep logs).
  await supabase.from('deal_activities').insert({
    deal_id: deal.id,
    activity_type: 'invoice_created',
    description: `Invoice ${invoice.invoice_number} (£${amount.toFixed(2)}) created and sent by automation`,
  })
}

/**
 * Build a Stripe Checkout Session for an invoice and email the contact the
 * Stripe-payment-link email. Mirrors the hardcoded HTML used by the manual
 * "Send invoice" route handler (app/api/invoices/[id]/send-with-link/route.ts)
 * so a contact who receives an automation-sent invoice gets the exact same
 * "Pay Now" button experience as one whose recruiter clicked Send manually.
 *
 * Stamps stripe_checkout_session_id back on the invoice row on success so
 * the `/pay/<id>` redirect (used by reminder emails' {{invoice_payment_link}}
 * merge tag) can re-use the same session if it's still valid, or mint a
 * fresh one if it isn't.
 */
async function sendInvoicePaymentLinkEmail(
  supabase: ReturnType<typeof createClient>,
  args: {
    invoiceId: string
    invoiceNumber: string
    amount: number
    description: string
    dealId: string
    contactId: string
    dueDateStr: string
  },
) {
  // Recipient resolution — guardian fallback mirrors the manual send route.
  const { data: invoice } = await supabase
    .from('invoices')
    .select('recipient_type, currency')
    .eq('id', args.invoiceId)
    .single()

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, email, first_name, last_name, parent_email, parent_name')
    .eq('id', args.contactId)
    .single()

  if (!contact) {
    throw new Error(`contact ${args.contactId} not found`)
  }

  const recipientType = (invoice as { recipient_type?: string } | null)?.recipient_type || 'player'
  const recipientEmail =
    recipientType === 'guardian'
      ? contact.parent_email || contact.email
      : contact.email
  const recipientName =
    recipientType === 'guardian'
      ? contact.parent_name || `${contact.first_name} ${contact.last_name}`
      : `${contact.first_name} ${contact.last_name}`

  if (!recipientEmail) {
    throw new Error('no recipient email available')
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured')
  if (!resendKey) throw new Error('RESEND_API_KEY not configured')

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
  const resend = new Resend(resendKey)
  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://ifg-crm.vercel.app'
  const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'
  const currency = ((invoice as { currency?: string } | null)?.currency || 'GBP').toUpperCase()

  const formattedAmount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(args.amount)
  const dueDateDisplay = new Date(args.dueDateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: `Invoice ${args.invoiceNumber}`,
            description: args.description || undefined,
          },
          unit_amount: Math.round(args.amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${appUrl}/portal/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/portal/payments/cancelled?invoice_id=${args.invoiceId}`,
    customer_email: recipientEmail,
    metadata: {
      invoice_id: args.invoiceId,
      invoice_number: args.invoiceNumber,
      contact_id: contact.id,
    },
  })

  const playerName = `${contact.first_name} ${contact.last_name}`

  const sendResult = await resend.emails.send({
    from: `IFG <${fromEmail}>`,
    to: [recipientEmail],
    subject: `Invoice ${args.invoiceNumber} - ${formattedAmount} Due`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Invoice from IFG</h1>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${args.invoiceNumber}</p>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
          <p>Hi ${recipientName},</p>
          ${
            recipientType === 'guardian'
              ? `<p style="color: #64748b; font-size: 13px;">This invoice is for ${playerName}.</p>`
              : ''
          }
          <p>You have a new invoice from The International Football Group. Please find the details below:</p>
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Invoice Number</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${args.invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Description</td>
                <td style="padding: 8px 0; text-align: right;">${args.description || '-'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Due Date</td>
                <td style="padding: 8px 0; text-align: right;">${dueDateDisplay}</td>
              </tr>
              <tr style="border-top: 2px solid #e2e8f0;">
                <td style="padding: 16px 0 8px; color: #64748b; font-weight: bold;">Amount Due</td>
                <td style="padding: 16px 0 8px; text-align: right; font-weight: bold; font-size: 28px; color: #1e40af;">${formattedAmount}</td>
              </tr>
            </table>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${session.url}" style="display: inline-block; background: #1e40af; color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
              Pay Now
            </a>
          </div>
          <p style="color: #64748b; font-size: 13px; text-align: center;">
            Click the button above to make a secure payment via Stripe.<br/>
            This link will expire in 24 hours.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            The International Football Group<br/>
            If you have any questions, please contact us at info@theinternationalfootballgroup.com
          </p>
        </div>
      </div>
    `,
  })

  if (sendResult.error) {
    throw new Error(
      typeof sendResult.error === 'object' && sendResult.error !== null && 'message' in sendResult.error
        ? String((sendResult.error as { message: unknown }).message)
        : 'Resend send failed',
    )
  }

  // Stamp the Stripe session id so reminders' {{invoice_payment_link}} can
  // re-use it via /pay/<id>.
  await supabase
    .from('invoices')
    .update({
      sent_at: new Date().toISOString(),
      stripe_checkout_session_id: session.id,
    })
    .eq('id', args.invoiceId)
}

/**
 * Log step execution to automation_logs
 */
async function logStepExecution(
  supabase: ReturnType<typeof createClient>,
  enrollment: AutomationEnrollment,
  step: AutomationStep,
  status: 'sent' | 'failed' | 'skipped',
  errorMessage?: string,
  enrolledAtSnapshot?: string | null,
) {
  await supabase.from('automation_logs').insert({
    enrollment_id: enrollment.id,
    step_id: step.id,
    deal_id: enrollment.deal_id,
    status,
    sent_at: new Date().toISOString(),
    error_message: errorMessage || null,
    enrolled_at_snapshot: enrolledAtSnapshot ?? null,
  })
}

/**
 * Reserve an automation_logs slot with status='pending' before calling an
 * external provider (Resend, ClickSend). The partial unique index
 * automation_logs_dedup_active on (enrollment_id, step_id, enrolled_at_snapshot)
 * makes this insert the authoritative lock: if a concurrent worker has
 * already reserved this slot in the same enrolment cycle, we receive a
 * unique-violation (23505) and return 'conflict' so the caller can bail
 * out before double-sending.
 */
async function reserveLogSlot(
  supabase: ReturnType<typeof createClient>,
  enrollment: AutomationEnrollment,
  step: AutomationStep,
  enrolledAtSnapshot: string | null,
  logType: string = 'step_executed',
): Promise<{ logId: string } | 'conflict'> {
  const { data, error } = await supabase
    .from('automation_logs')
    .insert({
      enrollment_id: enrollment.id,
      step_id: step.id,
      deal_id: enrollment.deal_id,
      status: 'pending',
      log_type: logType,
      sent_at: new Date().toISOString(),
      enrolled_at_snapshot: enrolledAtSnapshot,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return 'conflict'
    throw error
  }
  return { logId: data.id }
}

/**
 * Reclaim logs stuck in 'pending' status. A pending row is written just
 * before we call an external provider; if the function crashes or times
 * out between the reservation and the status update, the row sits at
 * 'pending' forever and the unique index blocks retries. A 10-minute
 * cutoff is well beyond any normal send latency, so anything older is
 * safely considered abandoned.
 */
async function sweepStalePending(supabase: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { error } = await supabase
    .from('automation_logs')
    .update({
      status: 'failed',
      error_message: 'Pending log reclaimed (process crash or timeout before completion)',
    })
    .eq('status', 'pending')
    .lt('sent_at', cutoff)
  if (error) {
    console.error('Failed to sweep stale pending logs:', error)
  }
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
 * Format a meeting date/time for human-readable rendering inside emails.
 * Returns e.g. "Mon, 15 Jan 2026 at 3:00 PM". Falls back to the raw ISO
 * if the input can't be parsed (so the merge still produces something).
 */
function formatMeetingDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}

/**
 * Calculate when the next step should execute.
 *
 * For most step types, this is "now + delay". For wait_until_before_date,
 * it's "<deal field value> - delay" — used to schedule reminders relative
 * to a future date stored on the deal (e.g. interview_date).
 *
 * Returns null for wait_until_before_date when the deal's field hasn't
 * been set yet; the caller stores that as a parked enrollment which
 * sweepBeforeDateWaits() will revisit on later cron runs.
 */
function calculateNextStepTime(
  step: AutomationStep,
  dealFields?: Record<string, unknown> | null,
  meetingEndTime?: string | null,
): Date | null {
  if (step.step_type === 'wait_until_before_date') {
    const field = (step.conditions as { field?: string } | null)?.field
    if (!field || !dealFields) return null
    const raw = dealFields[field]
    if (!raw || typeof raw !== 'string') return null
    const target = new Date(raw)
    if (isNaN(target.getTime())) return null
    const offsetMs =
      (step.delay_days || 0) * 24 * 60 * 60 * 1000 +
      (step.delay_hours || 0) * 60 * 60 * 1000
    return new Date(target.getTime() - offsetMs)
  }

  if (step.step_type === 'wait_until_meeting_ends') {
    if (!meetingEndTime) return null
    const target = new Date(meetingEndTime)
    if (isNaN(target.getTime())) return null
    // delay_days/hours act as a positive buffer here ("wait N hours after
    // the meeting ends before completing"). Default 0 = complete as soon
    // as the meeting end time has passed.
    const bufferMs =
      (step.delay_days || 0) * 24 * 60 * 60 * 1000 +
      (step.delay_hours || 0) * 60 * 60 * 1000
    return new Date(target.getTime() + bufferMs)
  }

  const now = new Date()
  const delayMs =
    (step.delay_days || 0) * 24 * 60 * 60 * 1000 +
    (step.delay_hours || 0) * 60 * 60 * 1000
  if (delayMs === 0) return now
  return new Date(now.getTime() + delayMs)
}

/**
 * Re-check enrollments parked on a date-relative wait step whose
 * `next_step_at` is NULL because the source data wasn't available when we
 * advanced. Two flavours:
 *   - wait_until_before_date: parked because deals.<field> was null.
 *   - wait_until_meeting_ends: parked because no calendly_events row yet
 *     for this deal (or its end_time hadn't been written).
 * If the source data is set now, compute next_step_at and unstick.
 */
async function sweepBeforeDateWaits(
  supabase: ReturnType<typeof createClient>,
  summary: ProcessingSummary,
) {
  const { data: parked, error } = await supabase
    .from('automation_enrollments')
    .select('id, deal_id, current_step_id')
    .eq('status', 'active')
    .is('next_step_at', null)
    .not('current_step_id', 'is', null)

  if (error) {
    summary.errors.push(`Sweep: failed to fetch parked enrollments: ${error.message}`)
    return
  }
  if (!parked || parked.length === 0) return

  const stepIds = [...new Set(parked.map((e) => e.current_step_id).filter(Boolean) as string[])]
  if (stepIds.length === 0) return

  const { data: steps } = await supabase
    .from('automation_steps')
    .select('id, step_type, delay_days, delay_hours, conditions')
    .in('id', stepIds)
    .in('step_type', ['wait_until_before_date', 'wait_until_meeting_ends'])

  if (!steps || steps.length === 0) return

  const stepMap = new Map(steps.map((s) => [s.id, s]))
  const dealIds = [...new Set(parked.map((e) => e.deal_id))]

  const { data: deals } = await supabase
    .from('deals')
    .select('id, interview_date, programme_start_date, arrival_date')
    .in('id', dealIds)
  const dealMap = new Map((deals || []).map((d) => [d.id, d]))

  // Fetch the most recent scheduled meeting per deal in one round-trip.
  // We pull all candidates and reduce to one-per-deal in JS rather than
  // running N separate queries.
  const { data: meetings } = await supabase
    .from('calendly_events')
    .select('deal_id, start_time, end_time')
    .in('deal_id', dealIds)
    .eq('status', 'scheduled')
    .order('start_time', { ascending: false })
  const meetingByDeal = new Map<string, string>()
  for (const m of meetings || []) {
    if (m.deal_id && !meetingByDeal.has(m.deal_id) && m.end_time) {
      meetingByDeal.set(m.deal_id, m.end_time)
    }
  }

  for (const enrollment of parked) {
    if (!enrollment.current_step_id) continue
    const step = stepMap.get(enrollment.current_step_id)
    if (!step) continue
    const deal = dealMap.get(enrollment.deal_id)
    const meetingEnd = meetingByDeal.get(enrollment.deal_id) ?? null
    const nextAt = calculateNextStepTime(
      step as AutomationStep,
      deal as Record<string, unknown> | undefined,
      meetingEnd,
    )
    if (!nextAt) continue
    await supabase
      .from('automation_enrollments')
      .update({ next_step_at: nextAt.toISOString() })
      .eq('id', enrollment.id)
      .is('next_step_at', null) // only if still parked
  }
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
