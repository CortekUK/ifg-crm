// Supabase Edge Function: Check Replies
// This function checks for email replies and stops automations accordingly
// Can be called via cron or manually

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface ProcessingSummary {
  repliesProcessed: number
  enrollmentsStopped: number
  errors: string[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const summary: ProcessingSummary = {
      repliesProcessed: 0,
      enrollmentsStopped: 0,
      errors: [],
    }

    // Get unprocessed replies that should stop automations
    // Using the pending_reply_stops view created in migration
    const { data: pendingStops, error: fetchError } = await supabase
      .from('pending_reply_stops')
      .select('*')

    if (fetchError) {
      // View might not exist yet, fall back to manual query
      console.log('Falling back to manual query:', fetchError.message)
      await processRepliesManually(supabase, summary)
    } else if (pendingStops && pendingStops.length > 0) {
      // Process each pending stop
      for (const stop of pendingStops) {
        try {
          // Stop the enrollment
          const { error: stopError } = await supabase
            .from('automation_enrollments')
            .update({
              status: 'stopped',
              stopped_reason: 'Contact replied',
              next_step_at: null,
            })
            .eq('id', stop.enrollment_id)

          if (stopError) {
            summary.errors.push(`Failed to stop enrollment ${stop.enrollment_id}: ${stopError.message}`)
            continue
          }

          // Mark the reply as processed
          const { error: markError } = await supabase
            .from('email_replies')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
            })
            .eq('id', stop.reply_id)

          if (markError) {
            summary.errors.push(`Failed to mark reply ${stop.reply_id} as processed: ${markError.message}`)
          }

          summary.enrollmentsStopped++
          summary.repliesProcessed++

          console.log(
            `Stopped enrollment ${stop.enrollment_id} for ${stop.contact_name} - reply detected`
          )
        } catch (err) {
          summary.errors.push(`Error processing stop ${stop.enrollment_id}: ${err}`)
        }
      }
    }

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
    console.error('Error checking replies:', error)
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
 * Fallback manual query if the view doesn't exist
 */
async function processRepliesManually(
  supabase: ReturnType<typeof createClient>,
  summary: ProcessingSummary
) {
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
    .limit(100)

  if (repliesError || !replies || replies.length === 0) {
    return
  }

  for (const reply of replies) {
    try {
      // Get the associated email send and automation
      if (!reply.email_send_id) {
        // Mark as processed since we can't link it to an automation
        await supabase
          .from('email_replies')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', reply.id)
        summary.repliesProcessed++
        continue
      }

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
        summary.repliesProcessed++
        continue
      }

      // Get the automation log to find the enrollment
      const { data: log } = await supabase
        .from('automation_logs')
        .select('enrollment_id, step_id')
        .eq('id', emailSend.automation_log_id)
        .single()

      if (!log?.enrollment_id) {
        await supabase
          .from('email_replies')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', reply.id)
        summary.repliesProcessed++
        continue
      }

      // Get the automation to check exit_on_reply setting
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
        summary.repliesProcessed++
        continue
      }

      // Check if automation should exit on reply
      const automation = enrollment.automation as { exit_on_reply: boolean; config: { exit_on_reply?: boolean } } | null
      const exitOnReply = automation?.exit_on_reply || automation?.config?.exit_on_reply

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
          summary.enrollmentsStopped++
          console.log(`Stopped enrollment ${enrollment.id} - contact replied`)
        }
      }

      // Mark reply as processed
      await supabase
        .from('email_replies')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', reply.id)
      
      summary.repliesProcessed++
    } catch (err) {
      summary.errors.push(`Error processing reply ${reply.id}: ${err}`)
    }
  }
}
