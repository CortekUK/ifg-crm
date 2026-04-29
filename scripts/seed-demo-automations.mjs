// One-shot seed: creates the 8 unused-template automations on the
// "summer residency 2025" pipeline for demo purposes. All are inserted
// with is_active=false (the app's default) so they don't enrol real deals
// until toggled on during the demo.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

fs.readFileSync('.env.local', 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
})

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const PIPELINE_ID = 'ed5db131-8b3f-4452-8e75-e6b164603e94'

const STAGE = {
  application: '24a13d00-cdad-4fdc-9094-d411fea74fdb',
  interview: 'c92f8999-372b-4d8d-b04f-30df30cb5c13',
  conditional_offer: 'd4e90e8a-2aca-402f-8531-d555d370e92d',
  invoice_sent: 'fd86a577-0a32-4339-9e0e-409fafd7e36c',
  deposit_paid: '406bdee8-fd46-4db0-a149-d71cc2687fb8',
  lost: 'fe91cf57-d5c8-4124-b0e0-5526f3e382b7',
}

const TPL = {
  app_received: '6916bf1b-6143-41ca-923f-e3e1f7afe126',
  app_reminder: '1f977de3-0ce5-440f-9133-1f2a1ce466a6',
  interview_1d: '333ec556-fba7-4546-9234-2b4ab32acec7',
  interview_1h: '0926a878-fbbf-4c8c-ab36-95afece09133',
  onboarding: '8056d9a4-dfb0-450d-9ea4-d70b8d3dad03',
  overdue: '8ddb9870-93ad-48eb-8a2a-1df476994204',
  post_interview: 'c179763b-0473-4829-9006-d5dbdf07425d',
  pre_dep_1d: '0ff00a4e-f046-4a32-a759-e7e3d0568819',
  pre_dep_1m: '7c085130-b3b3-4885-9a94-89c09c29de3a',
  pre_dep_1w: '87153eea-7898-4341-a7fb-1ff6adab656b',
  welcome_d0: '637cdbd6-f8f6-4865-9d21-94b4b0a1be86',
  welcome_d3: 'faf11af2-51f1-42c7-948d-0088827fb576',
  welcome_d7: '97154458-dd8f-42b7-b05b-f64708c81ca9',
}

const email = (templateId, delayDays = 0) => ({
  step_type: 'send_email',
  delay_days: delayDays,
  delay_hours: 0,
  email_template_id: templateId,
  sms_content: null,
  target_stage_id: null,
  conditions: null,
})

const wait = (delayDays) => ({
  step_type: 'wait',
  delay_days: delayDays,
  delay_hours: 0,
  email_template_id: null,
  sms_content: null,
  target_stage_id: null,
  conditions: null,
})

const automations = [
  {
    name: 'Summer Residency — List Assignment (Demo)',
    description: 'Adds contact to a list when they submit a form (no deal created).',
    automation_type: 'list_assignment',
    trigger_type: 'form_submission',
    pipeline_id: null,
    trigger_stage_id: null,
    config: { static_list_ids: [] },
    steps: [],
  },
  {
    name: 'Summer Residency — Application Received (Demo)',
    description: 'Sends application confirmation when a deal moves to Application stage.',
    automation_type: 'application_received',
    trigger_type: 'enters_stage',
    pipeline_id: PIPELINE_ID,
    trigger_stage_id: STAGE.application,
    config: { notify_parent: true, exit_on_reply: true },
    steps: [email(TPL.app_received)],
  },
  {
    name: 'Summer Residency — Interview Reminder (Demo)',
    description: '1-day-before reminder once a deal hits the Interview stage.',
    automation_type: 'interview_reminder',
    trigger_type: 'enters_stage',
    pipeline_id: PIPELINE_ID,
    trigger_stage_id: STAGE.interview,
    config: { exit_on_reply: false },
    steps: [email(TPL.interview_1d), wait(1), email(TPL.interview_1h)],
  },
  {
    name: 'Summer Residency — Post-Interview Thank You (Demo)',
    description: 'Thank-you email once a deal moves to Conditional Offer.',
    automation_type: 'post_interview',
    trigger_type: 'stage_change',
    pipeline_id: PIPELINE_ID,
    trigger_stage_id: STAGE.conditional_offer,
    config: { exit_on_reply: true },
    steps: [email(TPL.post_interview)],
  },
  {
    name: 'Summer Residency — Deposit Invoice & Reminders (Demo)',
    description: 'Sends invoice + escalating reminders, stops once paid.',
    automation_type: 'deposit_invoice',
    trigger_type: 'enters_stage',
    pipeline_id: PIPELINE_ID,
    trigger_stage_id: STAGE.invoice_sent,
    config: { stop_on_payment: true, exit_on_reply: false },
    steps: [
      email(TPL.app_reminder),
      wait(3),
      email(TPL.app_reminder),
      wait(5),
      email(TPL.app_reminder),
      wait(7),
      email(TPL.overdue),
    ],
  },
  {
    name: 'Summer Residency — Payment Overdue Escalation (Demo)',
    description: 'Escalating reminders once an invoice flips to overdue.',
    automation_type: 'payment_overdue',
    trigger_type: 'invoice_overdue',
    pipeline_id: PIPELINE_ID,
    trigger_stage_id: null,
    config: { exit_on_reply: false },
    steps: [
      email(TPL.overdue),
      wait(3),
      email(TPL.overdue),
      wait(5),
      email(TPL.overdue),
    ],
  },
  {
    name: 'Summer Residency — Welcome Sequence (Demo)',
    description: 'Welcome pack + portal account when deposit is paid.',
    automation_type: 'welcome_sequence',
    trigger_type: 'enters_stage',
    pipeline_id: PIPELINE_ID,
    trigger_stage_id: STAGE.deposit_paid,
    config: { create_portal_account: true, exit_on_reply: false },
    steps: [
      email(TPL.welcome_d0),
      wait(3),
      email(TPL.welcome_d3),
      wait(4),
      email(TPL.welcome_d7),
    ],
  },
  {
    name: 'Summer Residency — Pre-Departure Sequence (Demo)',
    description: 'Reminders 30 / 14 / 7 days before programme start.',
    automation_type: 'pre_departure',
    trigger_type: 'time_before_date',
    pipeline_id: PIPELINE_ID,
    trigger_stage_id: null,
    config: {
      date_field: 'programme_start_date',
      days_before: 30,
      exit_on_reply: false,
    },
    steps: [
      email(TPL.pre_dep_1m),
      wait(16),
      email(TPL.pre_dep_1w),
      wait(7),
      email(TPL.pre_dep_1d),
    ],
  },
]

async function run() {
  for (const a of automations) {
    const { steps, ...rest } = a
    const { data: inserted, error: insertError } = await sb
      .from('automations')
      .insert({ ...rest, is_active: false })
      .select('id, name')
      .single()

    if (insertError) {
      console.error(`FAIL  ${a.name}: ${insertError.message}`)
      continue
    }

    if (steps.length > 0) {
      const stepRows = steps.map((s, i) => ({
        ...s,
        automation_id: inserted.id,
        step_order: i,
      }))
      const { error: stepError } = await sb.from('automation_steps').insert(stepRows)
      if (stepError) {
        console.error(`FAIL  ${a.name} steps: ${stepError.message}`)
        continue
      }
    }

    console.log(`OK    ${inserted.name}  (${steps.length} steps)`)
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
