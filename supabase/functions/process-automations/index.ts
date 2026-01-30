// Supabase Edge Function: Process Automations
// This function handles automation triggers, processes the queue, and checks exit conditions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface ProcessingSummary {
  enrollmentsCreated: number
  stepsProcessed: number
  emailsQueued: number
  stagesMoved: number
  enrollmentsCompleted: number
  enrollmentsStopped: number
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
      errors: [],
    }

    // ============================================
    // 1. TRIGGER CHECK - Enroll deals in automations
    // ============================================
    await checkTriggers(supabase, summary)

    // ============================================
    // 2. PROCESS QUEUE - Execute ready steps
    // ============================================
    await processQueue(supabase, summary)

    // ============================================
    // 3. EXIT CONDITIONS - Stop enrollments that should exit
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
      next_step_at
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
      if (!enrollment.current_step_id) {
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
        continue
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
        continue
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
    } catch (err) {
      summary.errors.push(`Error processing enrollment ${enrollment.id}: ${err}`)
    }
  }
}

/**
 * Process an email step - log for later sending
 */
async function processEmailStep(
  supabase: ReturnType<typeof createClient>,
  enrollment: AutomationEnrollment,
  step: AutomationStep,
  summary: ProcessingSummary
) {
  // Log the email action (actual sending will be implemented later via Resend)
  await logStepExecution(supabase, enrollment, step, 'sent')
  summary.emailsQueued++

  // TODO: Implement actual email sending via Resend
  // const { data: deal } = await supabase
  //   .from('deals')
  //   .select('contact:contacts(email, first_name, last_name)')
  //   .eq('id', enrollment.deal_id)
  //   .single()
  //
  // const { data: template } = await supabase
  //   .from('email_templates')
  //   .select('*')
  //   .eq('id', step.email_template_id)
  //   .single()
  //
  // await sendEmail(deal.contact.email, template)
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
