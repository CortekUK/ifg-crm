import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Use service role for debugging (bypasses RLS)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Use service role if available, otherwise anon key
  const supabase = createClient(supabaseUrl, serviceRoleKey || anonKey)

  // Get automations with their trigger stages
  const { data: automations, error: automationsError } = await supabase
    .from('automations')
    .select(`
      id,
      name,
      is_active,
      pipeline_id,
      trigger_stage_id,
      trigger_type,
      pipeline:pipelines(id, name),
      trigger_stage:pipeline_stages!trigger_stage_id(id, name)
    `)

  // Get all enrollments
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('automation_enrollments')
    .select(`
      id,
      automation_id,
      deal_id,
      status,
      next_step_at,
      automation:automations(name)
    `)

  // Get recent deals
  const { data: deals, error: dealsError } = await supabase
    .from('deals')
    .select(`
      id,
      title,
      pipeline_id,
      current_stage_id,
      stage:pipeline_stages!current_stage_id(id, name),
      pipeline:pipelines(id, name)
    `)
    .order('created_at', { ascending: false })
    .limit(10)

  // Get automation steps
  const { data: steps, error: stepsError } = await supabase
    .from('automation_steps')
    .select('*')
    .order('automation_id')
    .order('step_order')

  return NextResponse.json({
    usingServiceRole: !!serviceRoleKey,
    automations: automations || [],
    automationsError: automationsError?.message,
    enrollments: enrollments || [],
    enrollmentsError: enrollmentsError?.message,
    recentDeals: deals || [],
    dealsError: dealsError?.message,
    steps: steps || [],
    stepsError: stepsError?.message,
  })
}
